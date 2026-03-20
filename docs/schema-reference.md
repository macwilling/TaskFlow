# Database Schema Reference

Quick reference for all tables, columns, and relationships. See `supabase/migrations/` for the canonical SQL.

---

## Migration files

| File | Contents |
|---|---|
| `20260303000000_initial_schema.sql` | tenants, profiles, tenant_settings, helper functions (`auth_tenant_id`, `auth_role`, `claim_invoice_number`), RLS |
| `20260303000001_clients.sql` | clients |
| `20260303000002_tasks.sql` | tasks, task_attachments, comments, email_log |
| `20260303000003_time_entries.sql` | time_entries |
| _(missing locally)_ `20260303000004_invoices.sql` | invoices, invoice_line_items, payments; FK from time_entries.invoice_id — applied directly to Supabase |
| `20260303000005_task_keys.sql` | clients.client_key, clients.next_task_number, tasks.task_number; `next_task_number_for_client()` function |
| `20260303000006_client_portal.sql` | client_portal_access; client-side RLS on tasks/comments |
| `20260303000007_task_audit_log.sql` | task_audit_log; `log_task_mutation()` trigger |
| `20260303000008_audit_log_content_fields.sql` | Extends trigger to log description_changed + resolution_notes_changed |
| `20260303000009_portal_last_seen.sql` | client_portal_access.last_seen_at |
| `20260303000010_portal_access_nullable_user.sql` | user_id nullable; unique constraint → (tenant_id, client_id) |
| `20260303000011_add_start_time.sql` | time_entries.start_time |
| `20260303000012_portal_tasks_invoices.sql` | client_tasks_insert RLS; client SELECT on invoices + invoice_line_items |
| `20260303000013_saas_infrastructure.sql` | tenants.custom_domain; tenant_settings SMTP columns |
| `20260303000015_task_statuses.sql` | task_statuses table; replaces tasks.status (TEXT) with tasks.status_id (FK); `seed_default_task_statuses()` trigger |

---

## tenants
```
id             UUID PK
slug           TEXT UNIQUE   ← URL-safe, auto-generated from business name, editable in settings
custom_domain  TEXT UNIQUE   ← future bring-your-own-domain (e.g. portal.theirbiz.com); nullable
created_at     TIMESTAMPTZ
```
RLS: service role only (no direct client access). Trigger: `seed_task_statuses_on_tenant_insert` seeds 4 default task statuses on INSERT.

---

## tenant_settings
```
id                       UUID PK
tenant_id                UUID FK tenants UNIQUE
business_name            TEXT
logo_url                 TEXT             ← R2 public URL
address_line1/2          TEXT
city, state, postal_code TEXT
country                  TEXT DEFAULT 'US'
email, phone             TEXT
primary_color            TEXT DEFAULT '#0969da'
accent_color             TEXT DEFAULT '#0550ae'
default_currency         TEXT DEFAULT 'USD'
date_format              TEXT DEFAULT 'MM/DD/YYYY'
default_payment_terms    INT DEFAULT 30
invoice_number_prefix    TEXT DEFAULT 'INV-'
invoice_number_next      INT DEFAULT 1001
tax_label                TEXT DEFAULT 'Tax'
default_tax_rate         NUMERIC(5,4) DEFAULT 0
payment_method_options   TEXT[] DEFAULT ARRAY['Check','ACH','Wire','Credit Card','Other']
portal_welcome_message   TEXT
email_task_closed_subject/body TEXT
email_invoice_subject/body     TEXT
email_comment_subject/body     TEXT
email_signature          TEXT
email_sender_name        TEXT
email_reply_to           TEXT
smtp_host                TEXT   ← nullable; when set, used instead of shared Resend
smtp_port                INTEGER
smtp_username            TEXT
smtp_password            TEXT   ← store encrypted (pgcrypto/Vault planned)
smtp_from_email          TEXT   ← e.g. hello@theircustom.com
smtp_from_name           TEXT   ← e.g. "Acme Co"
created_at, updated_at   TIMESTAMPTZ
```
RLS: admin full CRUD (own tenant). Portal gets limited read (business_name, logo_url, primary_color, portal_welcome_message) via query projection.

---

## profiles
```
id          UUID PK FK auth.users
tenant_id   UUID FK tenants
role        TEXT CHECK ('admin', 'client')
full_name   TEXT
avatar_url  TEXT
created_at, updated_at TIMESTAMPTZ
```
RLS: admin SELECT all in tenant; client SELECT own. INSERT: service role only.

---

## clients
```
id               UUID PK
tenant_id        UUID FK tenants
name             TEXT NOT NULL
company          TEXT
email            TEXT
phone            TEXT
billing_address  JSONB   ← {line1, line2, city, state, postal_code, country}
default_rate     NUMERIC(10,2)
payment_terms    INT DEFAULT 30
currency         TEXT DEFAULT 'USD'
color            TEXT DEFAULT '#0969da'   ← used in FullCalendar and sidebar dots
notes            TEXT
custom_fields    JSONB DEFAULT '{}'
is_archived      BOOLEAN DEFAULT false
client_key       TEXT   ← short uppercase prefix for task IDs (e.g. "AC"); nullable
next_task_number INTEGER NOT NULL DEFAULT 1   ← atomic counter for task_number allocation
created_at, updated_at TIMESTAMPTZ
```
RLS: admin full CRUD. Indexes: (tenant_id), (tenant_id, is_archived), UNIQUE (tenant_id, client_key) WHERE client_key IS NOT NULL.

---

## task_statuses
```
id          UUID PK
tenant_id   UUID FK tenants ON DELETE CASCADE
name        TEXT NOT NULL
color       TEXT NOT NULL DEFAULT '#6b7280'
position    INTEGER NOT NULL DEFAULT 0
is_default  BOOLEAN NOT NULL DEFAULT false   ← exactly one per tenant (partial unique index)
is_closed   BOOLEAN NOT NULL DEFAULT false   ← exactly one per tenant (partial unique index)
created_at  TIMESTAMPTZ
```
RLS: admin full CRUD; client SELECT (own tenant — for badge display in portal).
Default seed: Backlog (#6b7280), In Progress (#3b82f6), In Review (#f59e0b), Closed (#22c55e).
New tenants are seeded automatically via the `seed_task_statuses_on_tenant_insert` trigger on tenants.

---

## tasks
```
id                UUID PK
tenant_id         UUID FK tenants
client_id         UUID FK clients
title             TEXT NOT NULL
description       TEXT   ← Milkdown markdown, may contain R2 image URLs
resolution_notes  TEXT   ← Milkdown markdown
status_id         UUID NOT NULL FK task_statuses ON DELETE RESTRICT   ← replaces old TEXT status column
priority          TEXT CHECK ('low','medium','high','urgent')
due_date          DATE
estimated_hours   NUMERIC(6,2)
tags              TEXT[]
task_number       INTEGER   ← sequential integer portion of task key (e.g. 1 in "AC-1"); nullable for old rows
closed_at         TIMESTAMPTZ
created_at, updated_at TIMESTAMPTZ
```
RLS: admin full CRUD; client SELECT own client's tasks + INSERT new task requests (portal). Indexes: (tenant_id, status_id), UNIQUE (client_id, task_number) WHERE task_number IS NOT NULL.
Trigger: `task_audit_log_trigger` → `log_task_mutation()` on INSERT/UPDATE.

---

## task_attachments
```
id           UUID PK
tenant_id    UUID FK tenants
task_id      UUID FK tasks
file_name    TEXT NOT NULL
file_size    INT
mime_type    TEXT
r2_key       TEXT NOT NULL   ← full R2 object key for deletion
public_url   TEXT NOT NULL
uploaded_by  UUID FK auth.users
created_at   TIMESTAMPTZ
```
RLS: admin CRUD; client SELECT (portal).

---

## comments
```
id          UUID PK
tenant_id   UUID FK tenants
task_id     UUID FK tasks
author_id   UUID FK auth.users
author_role TEXT CHECK ('admin','client')
body        TEXT NOT NULL
created_at, updated_at TIMESTAMPTZ
```
RLS: admin full CRUD; client SELECT + INSERT + UPDATE/DELETE own comments (portal). Index: (task_id, created_at).

---

## task_audit_log
```
id          UUID PK
tenant_id   UUID FK tenants ON DELETE CASCADE
task_id     UUID FK tasks ON DELETE CASCADE
actor_id    UUID FK auth.users ON DELETE SET NULL   ← nullable (system events)
actor_role  TEXT CHECK ('admin','client','system') DEFAULT 'system'
event_type  TEXT NOT NULL
  ← 'created' | 'status_changed' | 'title_changed' | 'comment_added'
     | 'attachment_added' | 'attachment_deleted'
     | 'description_changed' | 'resolution_notes_changed'
old_value   TEXT   ← status name / title before change
new_value   TEXT   ← status name / title after change
metadata    JSONB NOT NULL DEFAULT '{}'   ← e.g. {snippet: "..."} for content changes
created_at  TIMESTAMPTZ
```
RLS: admin SELECT all (own tenant); client SELECT subset of event types for their tasks (portal).
Indexes: (task_id, created_at DESC), (tenant_id, created_at DESC).
Populated automatically by the `log_task_mutation()` trigger on tasks.

---

## time_entries
```
id             UUID PK
tenant_id      UUID FK tenants
client_id      UUID FK clients
task_id        UUID FK tasks (nullable, ON DELETE SET NULL)
description    TEXT NOT NULL
entry_date     DATE NOT NULL
start_time     TIME   ← nullable; NULL = all-day/legacy entry
duration_hours NUMERIC(6,2) NOT NULL   ← billing source of truth even when start_time is set
billable       BOOLEAN DEFAULT true
billed         BOOLEAN DEFAULT false   ← set true when included in a sent invoice
hourly_rate    NUMERIC(10,2)           ← rate snapshot at time of entry
invoice_id     UUID   ← FK to invoices added in Phase 5 migration
created_at, updated_at TIMESTAMPTZ
```
RLS: admin only. Indexes: (tenant_id, client_id), (tenant_id, entry_date), (tenant_id, billable, billed).

---

## invoices _(Phase 5 — no local migration file)_
```
id              UUID PK
tenant_id       UUID FK tenants
client_id       UUID FK clients
invoice_number  TEXT NOT NULL   ← prefix + sequence, claimed atomically via claim_invoice_number()
status          TEXT CHECK ('draft','sent','viewed','paid')   ← 'overdue' is computed, never stored
issue_date      DATE DEFAULT CURRENT_DATE
due_date        DATE
memo            TEXT
subtotal        NUMERIC(12,2)
discount_type   TEXT CHECK ('flat','percent')
discount_value  NUMERIC(10,2)
tax_rate        NUMERIC(5,4)
tax_amount      NUMERIC(12,2)
total           NUMERIC(12,2)
amount_paid     NUMERIC(12,2)
sent_at         TIMESTAMPTZ
viewed_at       TIMESTAMPTZ
created_at, updated_at TIMESTAMPTZ
UNIQUE (tenant_id, invoice_number)
```
RLS: admin full CRUD; client SELECT sent/viewed/paid (portal, excludes drafts).

---

## invoice_line_items _(Phase 5)_
```
id            UUID PK
tenant_id     UUID FK tenants
invoice_id    UUID FK invoices ON DELETE CASCADE
time_entry_id UUID FK time_entries (nullable — null for manual items)
description   TEXT NOT NULL
quantity      NUMERIC(8,2)   ← hours for time entries
unit_price    NUMERIC(10,2)  ← rate, overridable per invoice
amount        NUMERIC(12,2)  ← quantity * unit_price
sort_order    INT DEFAULT 0
created_at    TIMESTAMPTZ
```
RLS: admin full CRUD; client SELECT (for invoices they can see, portal).

---

## payments _(Phase 5)_
```
id             UUID PK
tenant_id      UUID FK tenants
invoice_id     UUID FK invoices ON DELETE CASCADE
amount         NUMERIC(12,2) NOT NULL
payment_date   DATE NOT NULL
payment_method TEXT   ← from tenant_settings.payment_method_options
notes          TEXT
created_at     TIMESTAMPTZ
```

---

## email_log
```
id            UUID PK
tenant_id     UUID FK tenants
to_email      TEXT NOT NULL
subject       TEXT NOT NULL
type          TEXT   ← 'task_closed' | 'invoice' | 'comment' | 'invite'
related_id    UUID   ← task_id, invoice_id, etc.
resend_id     TEXT   ← Resend message ID
status        TEXT DEFAULT 'sent'   ← 'sent' | 'failed'
error_message TEXT
sent_at       TIMESTAMPTZ
```
RLS: admin SELECT only.

---

## client_portal_access
```
id           UUID PK
tenant_id    UUID FK tenants
client_id    UUID FK clients ON DELETE CASCADE
user_id      UUID FK auth.users ON DELETE CASCADE   ← nullable; NULL until client first signs in
invited_at   TIMESTAMPTZ
accepted_at  TIMESTAMPTZ
last_seen_at TIMESTAMPTZ   ← updated on each portal login; displayed in admin UI
created_at   TIMESTAMPTZ
UNIQUE (tenant_id, client_id)   ← one portal-access record per client per tenant
```
RLS: admin CRUD; client SELECT own row.
Flow: admin creates row with user_id = NULL (invite); `auth/callback` fills in user_id + accepted_at on first sign-in.

---

## DB functions

| Function | Description |
|---|---|
| `auth_tenant_id()` | Returns `profiles.tenant_id` for the current user — used in RLS |
| `auth_role()` | Returns `profiles.role` for the current user — used in RLS |
| `claim_invoice_number(p_tenant_id)` | Atomically increments `tenant_settings.invoice_number_next`; call via admin client to bypass RLS |
| `next_task_number_for_client(p_client_id)` | Atomically increments `clients.next_task_number`; returns the allocated number |
| `log_task_mutation()` | Trigger function: writes to task_audit_log on task INSERT/UPDATE |
| `seed_default_task_statuses()` | Trigger function: seeds 4 default statuses when a new tenant is created |
