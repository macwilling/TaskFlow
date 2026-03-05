import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // R2 doesn't support the CRC32 checksums that AWS SDK v3 sends by default.
    // Without these two flags the signature calculation diverges and R2 rejects the request.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const s3 = getS3Client();
  if (!s3 || !process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
    return NextResponse.json(
      { error: "File storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL in your environment." },
      { status: 503 }
    );
  }

  const uploadPath = request.nextUrl.searchParams.get("path");
  if (!uploadPath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const key = `${uploadPath}/${crypto.randomUUID()}.${ext}`;

  const buffer = await file.arrayBuffer();

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: new Uint8Array(buffer),
        ContentType: file.type,
        ContentLength: file.size,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const url = `${process.env.R2_PUBLIC_URL}/${key}`;
  return NextResponse.json({ url, key });
}
