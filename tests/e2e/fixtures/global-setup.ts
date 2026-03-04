/**
 * Playwright global setup — runs once before all tests.
 *
 * 1. Uses the Supabase service-role key to reset the E2E test user's password.
 * 2. Signs in via the Supabase auth REST API to get session tokens.
 * 3. Writes the session as Playwright storageState (cookies) to ADMIN_STATE.
 * 4. Seeds a temporary test client user + portal_access row for the admin's tenant.
 * 5. Writes the client session to CLIENT_STATE and seed metadata to seed.json.
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
import { createClient } from "@supabase/supabase-js";

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

  const authDir = path.join(__dirname, ".auth");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieKey = `sb-${projectRef}-auth-token`;

  // ── 1. Reset test user password via service-role ────────────────────────────
  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const { users } = (await listRes.json()) as { users: Array<{ id: string; email: string }> };
  const adminAuthUser = users.find((u) => u.email === adminEmail);
  if (!adminAuthUser) {
    throw new Error(`E2E admin user "${adminEmail}" not found in Supabase.`);
  }

  await fetch(`${supabaseUrl}/auth/v1/admin/users/${adminAuthUser.id}`, {
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
  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

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
    user: { id: string; app_metadata?: Record<string, unknown> };
  };

  const session = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type ?? "bearer",
    expires_in: tokenData.expires_in,
    expires_at: tokenData.expires_at ?? Math.floor(Date.now() / 1000) + tokenData.expires_in,
    refresh_token: tokenData.refresh_token,
    user: tokenData.user,
  };

  // ── 3. Write admin storageState ──────────────────────────────────────────────
  const adminCookies = buildSessionCookies(cookieKey, JSON.stringify(session), appBaseUrl);
  const adminStatePath = path.join(authDir, "admin.json");
  fs.writeFileSync(adminStatePath, JSON.stringify({ cookies: adminCookies, origins: [] }, null, 2));
  console.log(`✓ Admin storageState written to ${adminStatePath} (${adminCookies.length} cookie chunk(s)).`);

  // ── 4. Seed portal test data ─────────────────────────────────────────────────
  // Uses the admin user's own tenant so no extra tenant creation is needed.
  const adminUserId = tokenData.user.id;
  const adminMeta = tokenData.user.app_metadata ?? {};
  const tenantId = adminMeta.tenant_id as string | undefined;
  const tenantSlug = adminMeta.tenant_slug as string | undefined;

  if (!tenantId || !tenantSlug) {
    console.warn(
      "⚠ E2E admin user has no tenant_id/tenant_slug in app_metadata. " +
        "Portal tests will be skipped."
    );
    fs.writeFileSync(path.join(authDir, "client.json"), JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ts = Date.now();
  const clientEmail = `e2e-client-${ts}@test.taskflow.dev`;
  const clientPassword = `E2eClient1!${ts}`;

  // Create or reuse a test client record
  const { data: clientRecord } = await admin
    .from("clients")
    .insert({ tenant_id: tenantId, name: "E2E Portal Client", client_key: "E2P", color: "#6e40c9" })
    .select("id")
    .single();

  if (!clientRecord) {
    console.warn("⚠ Could not create test client record — portal tests will be skipped.");
    fs.writeFileSync(path.join(authDir, "client.json"), JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  const clientId = clientRecord.id as string;

  // Create a test task for this client
  const { data: task } = await admin
    .from("tasks")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      title: "E2E Test Task",
      status: "open",
      priority: "medium",
      task_number: 9001,
    })
    .select("id")
    .single();
  const taskId = (task?.id ?? "") as string;

  // Create the portal auth user
  const { data: clientUserData } = await admin.auth.admin.createUser({
    email: clientEmail,
    password: clientPassword,
    email_confirm: true,
  });
  if (!clientUserData?.user) {
    console.warn("⚠ Could not create test client auth user — portal tests will be skipped.");
    fs.writeFileSync(path.join(authDir, "client.json"), JSON.stringify({ cookies: [], origins: [] }));
    await admin.from("tasks").delete().eq("id", taskId);
    await admin.from("clients").delete().eq("id", clientId);
    return;
  }
  const clientUserId = clientUserData.user.id;

  // Create client profile + portal_access
  await admin.from("profiles").insert({
    id: clientUserId,
    tenant_id: tenantId,
    role: "client",
    full_name: "E2E Portal Client",
  });
  await admin.from("client_portal_access").insert({
    tenant_id: tenantId,
    client_id: clientId,
    user_id: clientUserId,
  });
  await admin.auth.admin.updateUserById(clientUserId, {
    app_metadata: { role: "client", tenant_id: tenantId, tenant_slug: tenantSlug, client_id: clientId },
  });

  // ── 5. Write client storageState (via REST API like admin) ───────────────────
  const clientTokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: clientEmail, password: clientPassword }),
  });

  if (!clientTokenRes.ok) {
    console.warn("⚠ Could not sign in as client user — portal tests will be skipped.");
    fs.writeFileSync(path.join(authDir, "client.json"), JSON.stringify({ cookies: [], origins: [] }));
  } else {
    const clientToken = (await clientTokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      expires_at?: number;
      token_type: string;
      user: object;
    };
    const clientSession = {
      access_token: clientToken.access_token,
      token_type: clientToken.token_type ?? "bearer",
      expires_in: clientToken.expires_in,
      expires_at: clientToken.expires_at ?? Math.floor(Date.now() / 1000) + clientToken.expires_in,
      refresh_token: clientToken.refresh_token,
      user: clientToken.user,
    };
    const clientCookies = buildSessionCookies(cookieKey, JSON.stringify(clientSession), appBaseUrl);
    const clientStatePath = path.join(authDir, "client.json");
    fs.writeFileSync(clientStatePath, JSON.stringify({ cookies: clientCookies, origins: [] }, null, 2));
    console.log(`✓ Client storageState written to ${clientStatePath} (${clientCookies.length} cookie chunk(s)).`);
  }

  // ── 6. Write seed metadata for tests and teardown ────────────────────────────
  const seedPath = path.join(__dirname, "seed.json");
  fs.writeFileSync(
    seedPath,
    JSON.stringify(
      {
        tenantId,
        tenantSlug,
        adminUserId,
        adminEmail,
        adminPassword,
        clientUserId,
        clientEmail,
        clientId,
        taskId,
      },
      null,
      2
    )
  );
  console.log(`✓ Seed metadata written to ${seedPath}`);
}
