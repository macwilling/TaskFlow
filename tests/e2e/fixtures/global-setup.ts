/**
 * Playwright global setup — runs once before all tests.
 *
 * 1. Uses the Supabase service-role key to reset the E2E test user's password.
 * 2. Signs in via the Supabase auth REST API to get session tokens.
 * 3. Writes the session as Playwright storageState (cookies) to ADMIN_STATE.
 *
 * This avoids a fragile browser-based login flow in CI.
 *
 * Required env vars (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   E2E_ADMIN_EMAIL    (default: sampleuser@example.com)
 *   E2E_ADMIN_PASSWORD (default: E2eTestPassword!)
 */
import fs from "fs";
import path from "path";

// Load .env.local so we have Supabase credentials available in Node.js
function loadEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const raw = fs.readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // In CI env vars are injected directly
  }
}

/** Chunk session JSON into ≤3180-char cookie values (mirrors @supabase/ssr). */
function buildSessionCookies(
  key: string,
  sessionJson: string,
  baseUrl: string
): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax" | "Strict" | "None";
}> {
  const url = new URL(baseUrl);
  const domain = url.hostname;
  const secure = url.protocol === "https:";

  const encoded = encodeURIComponent(sessionJson);
  const MAX = 3180;

  const buildCookie = (name: string, value: string) => ({
    name,
    value,
    domain,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 400 * 24 * 60 * 60,
    httpOnly: false,
    secure,
    sameSite: "Lax" as const,
  });

  if (encoded.length <= MAX) {
    return [buildCookie(key, sessionJson)];
  }

  const cookies = [];
  let remaining = encoded;
  let i = 0;
  while (remaining.length > 0) {
    let chunk = remaining.slice(0, MAX);
    // Don't split in the middle of a percent-encoded sequence
    const lastPct = chunk.lastIndexOf("%");
    if (lastPct > MAX - 3) chunk = chunk.slice(0, lastPct);
    cookies.push(buildCookie(`${key}.${i}`, decodeURIComponent(chunk)));
    remaining = remaining.slice(chunk.length);
    i++;
  }
  return cookies;
}

export default async function globalSetup() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "sampleuser@example.com";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "E2eTestPassword!";

  // ── 1. Reset test user password via service-role ────────────────────────────
  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const { users } = (await listRes.json()) as { users: Array<{ id: string; email: string }> };
  const user = users.find((u) => u.email === adminEmail);
  if (!user) {
    throw new Error(`E2E admin user "${adminEmail}" not found in Supabase.`);
  }

  await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: adminPassword }),
  });

  console.log(`✓ E2E test user "${adminEmail}" password reset.`);

  // ── 2. Sign in to get session tokens ────────────────────────────────────────
  const tokenRes = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    }
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Supabase sign-in failed: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
    user: object;
  };

  // Build the session object exactly as @supabase/auth-js does
  const session = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type ?? "bearer",
    expires_in: tokenData.expires_in,
    expires_at: tokenData.expires_at ?? Math.floor(Date.now() / 1000) + tokenData.expires_in,
    refresh_token: tokenData.refresh_token,
    user: tokenData.user,
  };

  // Derive the storage key: sb-<project-ref>-auth-token
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieKey = `sb-${projectRef}-auth-token`;

  // ── 3. Write storageState for the app's base URL ────────────────────────────
  const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const cookies = buildSessionCookies(cookieKey, JSON.stringify(session), appBaseUrl);

  const authDir = path.join(__dirname, ".auth");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const statePath = path.join(authDir, "admin.json");
  fs.writeFileSync(
    statePath,
    JSON.stringify({ cookies, origins: [] }, null, 2)
  );

  console.log(`✓ Admin storageState written to ${statePath} (${cookies.length} cookie chunk(s)).`);
}
