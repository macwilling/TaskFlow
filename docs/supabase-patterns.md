# Supabase Patterns Reference

This file documents recurring patterns and gotchas when working with Supabase in this project.

---

## Three clients — when to use which

| File | Use when |
|---|---|
| `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers (RLS applies) |
| `lib/supabase/admin.ts` | Service-role ops that must bypass RLS (registration, invite flow, seeding) |
| `lib/supabase/client.ts` | Client Components only (browser) |
| `lib/supabase/middleware.ts` | Only in `proxy.ts` for session cookie refresh |

**Never** import `admin.ts` in a Client Component or pass its client to the browser.

---

## Join typing — the array cast problem

Supabase types every joined relation as an array, even `*:1` FK relationships:

```ts
// This will type entry.clients as { name: string; color: string }[] (not a single object)
const { data } = await supabase
  .from("time_entries")
  .select("*, clients(name, color)")

// Fix: cast at the call site
const client = entry.clients as unknown as { name: string; color: string | null } | null;
```

Use `as unknown as T` — a direct `as T` will fail TypeScript's overlap check.

---

## Auth — reading the role

**In middleware / server code:** Read from JWT without a DB round-trip:
```ts
const { data: { user } } = await supabase.auth.getUser();
user.app_metadata.role   // 'admin' | 'client'
user.app_metadata.tenant_id  // UUID string
```

**In RLS policies:** Use the helper functions (these make a single DB lookup):
```sql
auth_role()       -- returns profiles.role for current user
auth_tenant_id()  -- returns profiles.tenant_id for current user
```

---

## RLS policy pattern (standard)

```sql
CREATE POLICY "table_name: admin full access"
  ON table_name FOR ALL TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'admin'
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'admin'
  );
```

Client read-only example:
```sql
CREATE POLICY "table_name: client read own"
  ON table_name FOR SELECT TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'client'
    AND client_id IN (
      SELECT client_id FROM client_portal_access WHERE user_id = auth.uid()
    )
  );
```

---

## Migration ordering rules

1. `tenants` table
2. `profiles` table (references `tenants`)
3. `auth_tenant_id()` and `auth_role()` functions (reference `profiles`)
4. RLS policies (call those functions)
5. All other tables and their policies

**The `set_updated_at()` trigger function** is defined in `20260303000000_initial_schema.sql`. Do not redefine it — just call it in new migrations:
```sql
CREATE TRIGGER set_foo_updated_at
  BEFORE UPDATE ON foo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Service role operations (admin client)

Used for operations that must bypass RLS:
- Creating tenant + profile rows on registration
- Sending invite emails (`supabase.auth.admin.inviteUserByEmail`)
- Seeding `tenant_settings` on registration
- Wiping tenant data

```ts
// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

Only ever call this from server-side code (Route Handlers, Server Actions).

---

## Invoice number incrementing (atomic)

`tenant_settings.invoice_number_next` must be read and incremented atomically. Use the `claim_invoice_number` SECURITY DEFINER function (defined in initial schema):

```ts
// Call via service role to bypass RLS
const { data } = await adminClient.rpc('claim_invoice_number', { p_tenant_id });
```

---

## Task number incrementing (atomic)

`clients.next_task_number` is incremented atomically for human-readable Jira-style keys (e.g. `AC-1`).

`client_key` is the short uppercase prefix set per client (e.g. `"AC"`). The full display key is `${client.client_key}-${task.task_number}`.

```ts
// Allocate next number — call via service role
const { data: taskNumber } = await adminClient.rpc('next_task_number_for_client', {
  p_client_id: clientId,
});
// Then insert task with task_number: taskNumber
```

When displaying a task key: `client_key` and `task_number` must both be non-null (old tasks may have `task_number = null` if created before migration 000005).

---

## Overdue invoice status

**Never** store `overdue` as a DB status. Always compute on read:

```sql
-- In queries, use CASE to derive effective status:
CASE
  WHEN status = 'sent' AND due_date < CURRENT_DATE THEN 'overdue'
  ELSE status
END AS effective_status
```

Or handle in TypeScript:
```ts
function effectiveStatus(invoice: { status: string; due_date: string | null }) {
  if (invoice.status === 'sent' && invoice.due_date && new Date(invoice.due_date) < new Date()) {
    return 'overdue';
  }
  return invoice.status;
}
```

---

## Task statuses

Statuses are per-tenant rows in `task_statuses`, not a hardcoded enum. Tasks have `status_id UUID FK task_statuses` (NOT a `status TEXT` column — that was removed in migration 000015).

When fetching tasks, join `task_statuses` to get name/color:
```ts
const { data } = await supabase
  .from("tasks")
  .select("*, task_statuses(id, name, color, is_closed)")
```

Each tenant has exactly one `is_default` status (for new tasks) and one `is_closed` status (for `closed_at` timestamping). Seeded automatically on tenant creation via trigger.
