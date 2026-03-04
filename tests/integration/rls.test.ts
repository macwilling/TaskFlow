/**
 * RLS Integration Tests — Supabase Row Level Security
 *
 * These tests run against a real Supabase project to verify that RLS policies
 * enforce multi-tenant isolation and role-based access at the database level.
 *
 * Prerequisites:
 *   1. Set the following env vars (e.g. in .env.test.local):
 *        SUPABASE_TEST_URL=https://<project>.supabase.co
 *        SUPABASE_TEST_ANON_KEY=<anon key>
 *        SUPABASE_TEST_SERVICE_ROLE_KEY=<service role key>
 *   2. All migrations must be applied to the test project.
 *
 * Tests are skipped automatically when SUPABASE_TEST_URL is not set.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Config ───────────────────────────────────────────────────────────────────

const TEST_URL = process.env.SUPABASE_TEST_URL ?? "";
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

const CONFIGURED = Boolean(TEST_URL && ANON_KEY && SERVICE_KEY);

const itRLS = CONFIGURED ? it : it.skip;

// ── Test state ────────────────────────────────────────────────────────────────

interface TenantFixture {
  tenantId: string;
  adminEmail: string;
  adminPassword: string;
  adminUserId: string;
  clientEmail: string;
  clientPassword: string;
  clientUserId: string;
  clientRecordId: string;
  taskId: string;
  commentId: string;
  timeEntryId: string;
  emailLogId: string;
}

let admin: SupabaseClient; // service-role client (bypasses RLS)
let tenantA: TenantFixture;
let tenantB: TenantFixture;

// ── Setup helpers ─────────────────────────────────────────────────────────────

async function createTenantFixture(suffix: string): Promise<TenantFixture> {
  const adminEmail = `rls-admin-${suffix}@test.invalid`;
  const clientEmail = `rls-client-${suffix}@test.invalid`;
  const password = "Test1234!";

  // Create tenant
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .insert({ slug: `rls-test-tenant-${suffix}-${Date.now()}` })
    .select("id")
    .single();
  if (tenantErr || !tenantRow) throw new Error(`Tenant insert: ${tenantErr?.message}`);
  const tenantId: string = tenantRow.id;

  // Create admin auth user
  const { data: adminAuthData, error: adminAuthErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
  });
  if (adminAuthErr || !adminAuthData.user) throw new Error(`Admin user: ${adminAuthErr?.message}`);
  const adminUserId = adminAuthData.user.id;

  // Create admin profile
  await admin.from("profiles").insert({ id: adminUserId, tenant_id: tenantId, role: "admin", full_name: `Admin ${suffix}` });
  await admin.auth.admin.updateUserById(adminUserId, { app_metadata: { role: "admin", tenant_id: tenantId } });

  // Create client auth user
  const { data: clientAuthData, error: clientAuthErr } = await admin.auth.admin.createUser({
    email: clientEmail,
    password,
    email_confirm: true,
  });
  if (clientAuthErr || !clientAuthData.user) throw new Error(`Client user: ${clientAuthErr?.message}`);
  const clientUserId = clientAuthData.user.id;

  // Create client record in `clients` table
  const { data: clientRecord, error: clientRecordErr } = await admin
    .from("clients")
    .insert({ tenant_id: tenantId, name: `Client ${suffix}`, email: `${clientEmail}` })
    .select("id")
    .single();
  if (clientRecordErr || !clientRecord) throw new Error(`Client record: ${clientRecordErr?.message}`);
  const clientRecordId: string = clientRecord.id;

  // Create client profile (role=client)
  await admin.from("profiles").insert({ id: clientUserId, tenant_id: tenantId, role: "client", full_name: `Portal User ${suffix}` });
  await admin.auth.admin.updateUserById(clientUserId, { app_metadata: { role: "client", tenant_id: tenantId } });

  // Grant portal access to the client user
  await admin
    .from("client_portal_access")
    .insert({ tenant_id: tenantId, client_id: clientRecordId, user_id: clientUserId });

  // Create a task
  const { data: taskRow, error: taskErr } = await admin
    .from("tasks")
    .insert({ tenant_id: tenantId, client_id: clientRecordId, title: `Task ${suffix}`, status: "backlog" })
    .select("id")
    .single();
  if (taskErr || !taskRow) throw new Error(`Task insert: ${taskErr?.message}`);
  const taskId: string = taskRow.id;

  // Create a comment (authored by admin)
  const { data: commentRow, error: commentErr } = await admin
    .from("comments")
    .insert({ tenant_id: tenantId, task_id: taskId, author_id: adminUserId, author_role: "admin", body: `Comment ${suffix}` })
    .select("id")
    .single();
  if (commentErr || !commentRow) throw new Error(`Comment insert: ${commentErr?.message}`);
  const commentId: string = commentRow.id;

  // Create a time entry
  const { data: teRow, error: teErr } = await admin
    .from("time_entries")
    .insert({ tenant_id: tenantId, client_id: clientRecordId, description: `Work ${suffix}`, entry_date: "2026-03-01", duration_hours: 1 })
    .select("id")
    .single();
  if (teErr || !teRow) throw new Error(`Time entry insert: ${teErr?.message}`);
  const timeEntryId: string = teRow.id;

  // Create an email log entry
  const { data: emailRow, error: emailErr } = await admin
    .from("email_log")
    .insert({ tenant_id: tenantId, to_email: clientEmail, subject: `Log ${suffix}`, type: "task_closed", related_id: taskId, status: "sent" })
    .select("id")
    .single();
  if (emailErr || !emailRow) throw new Error(`Email log insert: ${emailErr?.message}`);
  const emailLogId: string = emailRow.id;

  return {
    tenantId, adminEmail, adminPassword: password, adminUserId,
    clientEmail, clientPassword: password, clientUserId, clientRecordId,
    taskId, commentId, timeEntryId, emailLogId,
  };
}

async function anonClientFor(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(TEST_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!CONFIGURED) return;
  admin = createClient(TEST_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  tenantA = await createTenantFixture("A");
  tenantB = await createTenantFixture("B");
});

afterAll(async () => {
  if (!CONFIGURED) return;
  // Delete auth users first (cascades to profiles via ON DELETE CASCADE)
  for (const userId of [tenantA?.adminUserId, tenantA?.clientUserId, tenantB?.adminUserId, tenantB?.clientUserId]) {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
  // Delete tenants (cascades to all business data)
  for (const tenantId of [tenantA?.tenantId, tenantB?.tenantId]) {
    if (tenantId) await admin.from("tenants").delete().eq("id", tenantId);
  }
});

// ── Helper functions ──────────────────────────────────────────────────────────

/** Assert that a SELECT query returns zero rows (not an error). */
async function expectZeroRows(
  db: SupabaseClient,
  table: string,
  column: string,
  value: string
) {
  const { data, error } = await db.from(table).select("id").eq(column, value);
  expect(error, `${table} query error`).toBeNull();
  expect(data, `${table} should return [] for cross-tenant read`).toHaveLength(0);
}

// ── auth_tenant_id() and auth_role() ─────────────────────────────────────────

describe("SECURITY DEFINER helper functions", () => {
  itRLS("auth_tenant_id() returns the caller's tenant_id", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db.rpc("auth_tenant_id");
    expect(error).toBeNull();
    expect(data).toBe(tenantA.tenantId);
  });

  itRLS("auth_role() returns 'admin' for admin users", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db.rpc("auth_role");
    expect(error).toBeNull();
    expect(data).toBe("admin");
  });

  itRLS("auth_role() returns 'client' for portal users", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { data, error } = await db.rpc("auth_role");
    expect(error).toBeNull();
    expect(data).toBe("client");
  });
});

// ── clients table ─────────────────────────────────────────────────────────────

describe("clients table — RLS", () => {
  itRLS("admin A can read their own clients", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db.from("clients").select("id").eq("id", tenantA.clientRecordId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("admin A cannot read tenant B clients (cross-tenant isolation)", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    await expectZeroRows(db, "clients", "id", tenantB.clientRecordId);
  });

  itRLS("admin A can insert a client in their own tenant", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { error } = await db.from("clients").insert({ tenant_id: tenantA.tenantId, name: "New Client" });
    expect(error).toBeNull();
    // Clean up
    await db.from("clients").delete().eq("tenant_id", tenantA.tenantId).eq("name", "New Client");
  });

  itRLS("admin A cannot insert a client with tenant B's tenant_id", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { error } = await db.from("clients").insert({ tenant_id: tenantB.tenantId, name: "Sneaky Client" });
    expect(error).not.toBeNull();
  });

  itRLS("portal client user cannot read clients table", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    // No SELECT policy for role=client on clients table
    const { data } = await db.from("clients").select("id").eq("id", tenantA.clientRecordId);
    expect(data ?? []).toHaveLength(0);
  });
});

// ── tasks table ───────────────────────────────────────────────────────────────

describe("tasks table — RLS", () => {
  itRLS("admin A can read their own tasks", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db.from("tasks").select("id").eq("id", tenantA.taskId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("admin A cannot read tenant B tasks", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    await expectZeroRows(db, "tasks", "id", tenantB.taskId);
  });

  itRLS("portal client can read tasks for their linked client", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { data, error } = await db.from("tasks").select("id").eq("id", tenantA.taskId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("portal client cannot read tasks from a different client", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    await expectZeroRows(db, "tasks", "id", tenantB.taskId);
  });
});

// ── comments table ────────────────────────────────────────────────────────────

describe("comments table — RLS", () => {
  itRLS("admin A can read their own tenant comments", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db.from("comments").select("id").eq("id", tenantA.commentId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("admin A cannot read tenant B comments", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    await expectZeroRows(db, "comments", "id", tenantB.commentId);
  });

  itRLS("portal client can read comments on their tasks", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { data, error } = await db.from("comments").select("id").eq("id", tenantA.commentId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("portal client can insert a comment on their task", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { data, error } = await db
      .from("comments")
      .insert({
        tenant_id: tenantA.tenantId,
        task_id: tenantA.taskId,
        author_id: tenantA.clientUserId,
        author_role: "client",
        body: "RLS test comment",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    // Clean up
    if (data?.id) await admin.from("comments").delete().eq("id", data.id);
  });

  itRLS("portal client cannot insert a comment on another tenant's task", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { error } = await db.from("comments").insert({
      tenant_id: tenantB.tenantId,
      task_id: tenantB.taskId,
      author_id: tenantA.clientUserId,
      author_role: "client",
      body: "Cross-tenant sneaky comment",
    });
    expect(error).not.toBeNull();
  });

  itRLS("portal client can update their own comment", async () => {
    // Create a comment as client first
    const { data: inserted } = await admin
      .from("comments")
      .insert({
        tenant_id: tenantA.tenantId,
        task_id: tenantA.taskId,
        author_id: tenantA.clientUserId,
        author_role: "client",
        body: "Original body",
      })
      .select("id")
      .single();

    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { error } = await db
      .from("comments")
      .update({ body: "Updated body" })
      .eq("id", inserted!.id);
    expect(error).toBeNull();

    // Clean up
    await admin.from("comments").delete().eq("id", inserted!.id);
  });

  itRLS("portal client cannot update another user's comment", async () => {
    // Comment authored by admin
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { error } = await db
      .from("comments")
      .update({ body: "Hacked!" })
      .eq("id", tenantA.commentId);
    // Either error or zero rows affected — either way the update should not succeed
    if (!error) {
      // Verify comment is unchanged
      const { data } = await admin.from("comments").select("body").eq("id", tenantA.commentId).single();
      expect(data?.body).not.toBe("Hacked!");
    }
  });
});

// ── time_entries table ────────────────────────────────────────────────────────

describe("time_entries table — RLS", () => {
  itRLS("admin A can read their own time entries", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db.from("time_entries").select("id").eq("id", tenantA.timeEntryId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("admin A cannot read tenant B time entries", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    await expectZeroRows(db, "time_entries", "id", tenantB.timeEntryId);
  });

  itRLS("portal client cannot read time entries", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    await expectZeroRows(db, "time_entries", "id", tenantA.timeEntryId);
  });
});

// ── email_log table ───────────────────────────────────────────────────────────

describe("email_log table — RLS", () => {
  itRLS("admin A can read their own email log", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db.from("email_log").select("id").eq("id", tenantA.emailLogId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("admin A cannot read tenant B email log", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    await expectZeroRows(db, "email_log", "id", tenantB.emailLogId);
  });

  itRLS("portal client cannot read email log", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    await expectZeroRows(db, "email_log", "id", tenantA.emailLogId);
  });
});

// ── client_portal_access table ────────────────────────────────────────────────

describe("client_portal_access table — RLS", () => {
  itRLS("admin A can read portal access records in their tenant", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data, error } = await db
      .from("client_portal_access")
      .select("id")
      .eq("tenant_id", tenantA.tenantId);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  itRLS("admin A cannot read tenant B portal access records", async () => {
    const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
    const { data } = await db
      .from("client_portal_access")
      .select("id")
      .eq("tenant_id", tenantB.tenantId);
    expect(data ?? []).toHaveLength(0);
  });

  itRLS("portal client can read their own portal access record", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { data, error } = await db
      .from("client_portal_access")
      .select("id")
      .eq("user_id", tenantA.clientUserId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  itRLS("portal client cannot read another user's portal access record", async () => {
    const db = await anonClientFor(tenantA.clientEmail, tenantA.clientPassword);
    const { data } = await db
      .from("client_portal_access")
      .select("id")
      .eq("user_id", tenantB.clientUserId);
    expect(data ?? []).toHaveLength(0);
  });
});

// ── cross-tenant SELECT returns zero rows (not errors) ────────────────────────

describe("cross-tenant SELECT returns empty arrays (not auth errors)", () => {
  const tables: Array<{ table: string; idField: string; fixtureKey: keyof TenantFixture }> = [
    { table: "clients", idField: "id", fixtureKey: "clientRecordId" },
    { table: "tasks", idField: "id", fixtureKey: "taskId" },
    { table: "time_entries", idField: "id", fixtureKey: "timeEntryId" },
    { table: "email_log", idField: "id", fixtureKey: "emailLogId" },
  ];

  for (const { table, idField, fixtureKey } of tables) {
    itRLS(`${table}: cross-tenant read yields [] not an error`, async () => {
      const db = await anonClientFor(tenantA.adminEmail, tenantA.adminPassword);
      const { data, error } = await db
        .from(table)
        .select("id")
        .eq(idField, tenantB[fixtureKey] as string);
      // RLS should silently filter, not reject
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  }
});
