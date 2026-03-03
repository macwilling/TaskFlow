# Database Schema Reference

Quick reference for all tables, columns, and relationships. See `supabase/migrations/` for the canonical SQL.

---

## Migration files

| File | Contents |
|---|---|
| `20260303000000_initial_schema.sql` | tenants, profiles, tenant_settings, helper functions, RLS |
| `20260303000001_clients.sql` | clients |
| `20260303000002_tasks.sql` | tasks, task_attachments, comments, email_log |
| `20260303000003_time_entries.sql` | time_entries |
| _(Phase 5)_ `20260303000004_invoices.sql` | invoices, invoice_line_items, payments; FK from time_entries.invoice_id |
| _(Phase 6)_ `20260303000005_client_portal.sql` | client_portal_access; client-side RLS on tasks/comments |

---

## tenants
```
id          UUID PK
slug        TEXT UNIQUE   ← URL-safe, auto-generated from business name, editable in settings
created_at  TIMESTAMPTZ
```
RLS: service role only (no direct client access).

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
created_at, updated_at TIMESTAMPTZ
```
RLS: admin full CRUD. Indexes: (tenant_id), (tenant_id, is_archived).

---

## tasks
```
id                UUID PK
tenant_id         UUID FK tenants
client_id         UUID FK clients
title             TEXT NOT NULL
description       TEXT   ← Milkdown markdown, may contain R2 image URLs
resolution_notes  TEXT   ← Milkdown markdown
status            TEXT CHECK ('backlog','in_progress','in_review','closed')
priority          TEXT CHECK ('low','medium','high','urgent')
due_date          DATE
estimated_hours   NUMERIC(6,2)
tags              TEXT[]
closed_at         TIMESTAMPTZ
created_at, updated_at TIMESTAMPTZ
```
RLS: admin full CRUD; client SELECT (own client's tasks) — client policy added in Phase 6.

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
RLS: admin CRUD; client SELECT (Phase 6).

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
RLS: admin full CRUD; client SELECT + INSERT/UPDATE/DELETE own (Phase 6). Index: (task_id, created_at).

---

## time_entries
```
id             UUID PK
tenant_id      UUID FK tenants
client_id      UUID FK clients
task_id        UUID FK tasks (nullable, ON DELETE SET NULL)
description    TEXT NOT NULL
entry_date     DATE NOT NULL
duration_hours NUMERIC(6,2) NOT NULL
billable       BOOLEAN DEFAULT true
billed         BOOLEAN DEFAULT false   ← set true when included in a sent invoice
hourly_rate    NUMERIC(10,2)           ← rate snapshot at time of entry
invoice_id     UUID   ← FK to invoices added in Phase 5 migration
created_at, updated_at TIMESTAMPTZ
```
RLS: admin only. Indexes: (tenant_id, client_id), (tenant_id, entry_date), (tenant_id, billable, billed).

---

## invoices _(Phase 5)_
```
id              UUID PK
tenant_id       UUID FK tenants
client_id       UUID FK clients
invoice_number  TEXT NOT NULL   ← prefix + sequence, claimed atomically
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

## client_portal_access _(Phase 6)_
```
id           UUID PK
tenant_id    UUID FK tenants
client_id    UUID FK clients ON DELETE CASCADE
user_id      UUID FK auth.users ON DELETE CASCADE
invited_at   TIMESTAMPTZ
accepted_at  TIMESTAMPTZ
created_at   TIMESTAMPTZ
UNIQUE (tenant_id, client_id, user_id)
```
RLS: admin CRUD; client SELECT own row.
