import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGetUser = vi.hoisted(() => vi.fn());
const mockS3Send = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  // Use classes so `new S3Client(...)` and `new PutObjectCommand(...)` work in Vitest v4
  S3Client: class {
    send = mockS3Send;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const MAX_SIZE = 10 * 1024 * 1024;

/**
 * Creates a NextRequest whose formData() is patched to avoid jsdom/undici
 * File incompatibility. The route accesses file.size, file.type, file.name,
 * and file.arrayBuffer() — all of which are provided by the plain mock object.
 */
function makeUploadRequest(opts: {
  path?: string;
  file?: {
    name: string;
    size: number;
    type: string;
    content?: string;
  } | null;
}) {
  const url = opts.path
    ? `http://localhost:3000/api/upload?path=${encodeURIComponent(opts.path)}`
    : "http://localhost:3000/api/upload";

  const req = new NextRequest(url, { method: "POST" });

  // Patch formData() so the route receives our controlled mock File object
  if (opts.file !== undefined) {
    const mockFile =
      opts.file === null
        ? null
        : {
            name: opts.file.name,
            size: opts.file.size,
            type: opts.file.type,
            arrayBuffer: () =>
              Promise.resolve(
                new ArrayBuffer(Math.min(opts.file!.size, 64)) // small real buffer for upload
              ),
          };

    const fd = { get: (key: string) => (key === "file" ? mockFile : null) } as unknown as FormData;
    Object.defineProperty(req, "formData", { value: () => Promise.resolve(fd), writable: true });
  }

  return req;
}

const authenticatedUser = { id: "user-1", app_metadata: { role: "admin" } };

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/upload", () => {
  const r2Env = {
    R2_ACCOUNT_ID: "test-account",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_BUCKET_NAME: "test-bucket",
    R2_PUBLIC_URL: "https://files.example.com",
  };

  beforeEach(() => {
    // clearAllMocks resets call history but preserves mockImplementation,
    // which is needed so S3Client() still returns { send: mockS3Send }.
    vi.clearAllMocks();
    Object.assign(process.env, r2Env);
  });

  afterEach(() => {
    for (const key of Object.keys(r2Env)) {
      delete process.env[key];
    }
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const { POST } = await import("./route");
    const res = await POST(makeUploadRequest({ path: "tenant-1/tasks/t1/inline" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("returns 503 when R2 env vars are not configured", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authenticatedUser } });
    delete process.env.R2_ACCOUNT_ID;

    const { POST } = await import("./route");
    const res = await POST(makeUploadRequest({ path: "tenant-1/tasks/t1/inline" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });

  it("returns 400 when path param is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authenticatedUser } });

    const { POST } = await import("./route");
    const res = await POST(makeUploadRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/path/i);
  });

  it("returns 400 when no file is provided in form data", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authenticatedUser } });

    const { POST } = await import("./route");
    const res = await POST(makeUploadRequest({ path: "test/path", file: null }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no file/i);
  });

  it("returns 413 when file exceeds 10 MB", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authenticatedUser } });

    const { POST } = await import("./route");
    const res = await POST(
      makeUploadRequest({
        path: "test/path",
        file: { name: "big.png", size: MAX_SIZE + 1, type: "image/png" },
      })
    );
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toMatch(/10 mb/i);
  });

  it("returns 415 when file type is not allowed", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authenticatedUser } });

    const { POST } = await import("./route");
    const res = await POST(
      makeUploadRequest({
        path: "test/path",
        file: { name: "script.exe", size: 1024, type: "application/octet-stream" },
      })
    );
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.error).toMatch(/type not allowed/i);
  });

  it("returns 502 when R2 send fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authenticatedUser } });
    mockS3Send.mockRejectedValueOnce(new Error("R2 connection refused"));

    const { POST } = await import("./route");
    const res = await POST(
      makeUploadRequest({
        path: "test/path",
        file: { name: "doc.pdf", size: 1024, type: "application/pdf" },
      })
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/R2 connection refused/);
  });

  it("returns 200 with url and key on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authenticatedUser } });
    mockS3Send.mockResolvedValueOnce({});

    const { POST } = await import("./route");
    const res = await POST(
      makeUploadRequest({
        path: "tenant-1/tasks/t1/inline",
        file: { name: "photo.png", size: 4096, type: "image/png" },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/^https:\/\/files\.example\.com\//);
    expect(json.key).toMatch(/^tenant-1\/tasks\/t1\/inline\//);
  });
});
