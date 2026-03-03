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

`tenant_settings.invoice_number_next` must be read and incremented atomically to avoid duplicate invoice numbers across concurrent requests. Use a Postgres function:

```sql
CREATE OR REPLACE FUNCTION claim_invoice_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix TEXT;
  v_next INT;
BEGIN
  SELECT invoice_number_prefix, invoice_number_next
    INTO v_prefix, v_next
    FROM tenant_settings
   WHERE tenant_id = p_tenant_id
     FOR UPDATE;  -- row lock

  UPDATE tenant_settings
     SET invoice_number_next = invoice_number_next + 1
   WHERE tenant_id = p_tenant_id;

  RETURN v_prefix || v_next::TEXT;
END;
$$;
```

Call via service role: `adminClient.rpc('claim_invoice_number', { p_tenant_id })`.

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
