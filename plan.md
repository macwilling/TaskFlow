# TaskFlow — Technical Architecture Plan

---

## Document 1: Architecture Overview

### High-Level Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare DNS                           │
│         taskflow.macwillingham.com → Vercel (CNAME)             │
│                   [DNS-only, grey cloud]                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     Vercel (Next.js)                            │
│                                                                 │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │   Admin App          │  │     Client Portal                │  │
│  │  /app/(admin)/*     │  │  /app/portal/[tenantSlug]/*      │  │
│  │                     │  │                                  │  │
│  │  Server Components  │  │  Server Components               │  │
│  │  Client Components  │  │  Client Components               │  │
│  │  Server Actions     │  │  Server Actions                  │  │
│  └─────────┬───────────┘  └────────────────┬─────────────────┘  │
│            │                               │                    │
│  ┌─────────▼───────────────────────────────▼─────────────────┐  │
│  │               Next.js API Routes (/app/api/*)              │  │
│  │  - /api/upload          (R2 image/file upload)             │  │
│  │  - /api/pdf/[invoiceId] (PDF generation)                   │  │
│  │  - /api/email/*         (Resend triggers)                  │  │
│  └─────────┬──────────────────────────────────────────────────┘  │
└────────────┼────────────────────────────────────────────────────┘
             │
    ┌────────┼────────────────────────────────────┐
    │        │                                    │
    ▼        ▼                                    ▼
┌────────┐ ┌──────────────────────┐  ┌───────────────────────────┐
│Supabase│ │  Cloudflare R2       │  │  Resend                   │
│        │ │                      │  │                           │
│Postgres│ │ /tenant-{id}/        │  │ Transactional emails      │
│  Auth  │ │   logos/             │  │ (task closed, invoice,    │
│  RLS   │ │   tasks/{taskId}/    │  │  comments, invites)       │
│        │ │   invoices/{invId}/  │  └───────────────────────────┘
└────────┘ └──────────────────────┘
```

### Data Flow

**Admin flow:**
1. Consultant authenticates via Supabase Auth (`app_metadata.role === 'admin'`)
2. Next.js middleware validates session token and role → else redirect to `/auth/login`
3. Server Components fetch data directly from Supabase using the service role client (server-only)
4. Mutations go via Server Actions or API routes — never exposing service role to client
5. File uploads POST to `/api/upload` → server uploads to R2 → returns public URL

**Client portal flow:**
1. Client receives invite email → clicks magic link → Supabase Auth sets session
2. Middleware validates `role === 'client'` and `tenant_id` matches route slug → else redirect to portal login
3. Server Components query Supabase with RLS-scoped client (anon key + user JWT) — RLS enforces tenant isolation
4. Client comments on tasks → API route sends email notification to consultant via Resend

### Auth Strategy

Two roles, one Supabase Auth project per deployment:

| | Admin | Client |
|---|---|---|
| `app_metadata.role` | `admin` | `client` |
| `app_metadata.tenant_id` | tenant UUID | tenant UUID |
| Auth methods | email/password, magic link, Google OAuth | email/password, magic link, Google OAuth |
| Invite flow | Self-registration (guarded by `ALLOW_REGISTRATION` env var) | Consultant triggers Supabase invite → magic link email |
| Route guard | Middleware: must have `role === 'admin'` | Middleware: must have `role === 'client'` AND correct tenant slug |

- Admin routes (`/(admin)/*`) reject any session without `role === 'admin'`
- Portal routes (`/portal/[tenantSlug]/*`) reject any session without `role === 'client'` matching that tenant
- A client hitting an admin route is redirected to `/auth/login`; an admin hitting portal is rejected

### File Storage Strategy (Cloudflare R2)

**Bucket structure:**
```
taskflow-files/
  tenant-{tenantId}/
    logo/
      logo.{ext}                      ← single file, overwritten on update
    tasks/
      {taskId}/
        inline/{uuid}.{ext}           ← inline images (pasted/dragged into editor)
        attachments/{uuid}-{name}     ← file attachments
    invoices/
      {invoiceId}/
        {invoiceId}.pdf               ← generated PDF (regenerated on each request)
```

**Access model:**
- Public bucket — all files accessible via R2 custom domain (`https://files.taskflow.macwillingham.com`)
- Required so inline images render in the Milkdown editor and in emails without auth friction
- R2 credentials live only in server-side API routes — never in client code
- Upload always goes through `/api/upload` — browser never gets R2 credentials
- Deletion on task/tenant wipe: API route calls R2 `DeleteObject`, listing by prefix

**CORS policy on R2 bucket:**
```json
[{
  "AllowedOrigins": ["https://taskflow.macwillingham.com", "http://localhost:3000"],
  "AllowedMethods": ["GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}]
```
GET only for public reads — all writes are server-to-server via API routes.

### PDF Generation Recommendation

**Chosen: `@react-pdf/renderer` (React-PDF)**

Justification:
- Pure JavaScript — no headless browser, no Chromium binary. Vercel free tier has a 50 MB function size limit; Puppeteer's Chromium binary alone exceeds this and cannot run on Vercel without workarounds.
- Renders to a real PDF spec (not HTML-to-image): crisp vector text, proper fonts, small file sizes.
- Runs in a standard Next.js API Route as a streaming response.
- The invoice layout (logo, line items table, totals, memo) is well within React-PDF's capabilities.
- PDFs are regenerated on every request — always reflect the latest invoice data.

**Alternative noted:** `@sparticuz/chromium` + Puppeteer if pixel-perfect HTML rendering is ever needed. Avoided here due to bundle size and Vercel constraints.

### Domain / DNS Setup

```
Cloudflare DNS:
  taskflow.macwillingham.com        CNAME  cname.vercel-dns.com        [DNS-only / grey cloud]
  files.taskflow.macwillingham.com  →      Managed by R2 Custom Domain
```

**Critical:** Cloudflare proxy must be **DNS-only (grey cloud)** for the Vercel CNAME. Orange cloud breaks Vercel's automatic SSL certificate provisioning (ACME requires bare domain visibility). Grey cloud = pure DNS passthrough; Vercel handles TLS end-to-end.

For `files.taskflow.macwillingham.com`: use Cloudflare's R2 Custom Domain feature — this enables Cloudflare CDN caching on R2 automatically. Do not add a manual DNS record.

---

## Document 2: Full Database Schema

### Design Principles
- `tenant_id UUID NOT NULL` on every business table
- All RLS policies use `auth.uid()` → resolved via `auth_tenant_id()` / `auth_role()` helper functions
- UUID primary keys throughout
- `created_at` / `updated_at` on all tables; `updated_at` managed by trigger

### Helper Functions (created once, used by all RLS policies)

```sql
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

### Tables

#### `tenants`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
slug        TEXT NOT NULL UNIQUE   -- auto-generated from business name, URL-safe, editable in settings
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: No direct client access. Service role only.

---

#### `tenant_settings`
```sql
id                          UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE
business_name               TEXT
logo_url                    TEXT                        -- R2 public URL
address_line1               TEXT
address_line2               TEXT
city                        TEXT
state                       TEXT
postal_code                 TEXT
country                     TEXT DEFAULT 'US'
email                       TEXT
phone                       TEXT
primary_color               TEXT DEFAULT '#0969da'      -- hex
accent_color                TEXT DEFAULT '#0550ae'      -- hex
default_currency            TEXT DEFAULT 'USD'
date_format                 TEXT DEFAULT 'MM/DD/YYYY'
default_payment_terms       INT DEFAULT 30              -- net days
invoice_number_prefix       TEXT DEFAULT 'INV-'
invoice_number_next         INT DEFAULT 1001
tax_label                   TEXT DEFAULT 'Tax'
default_tax_rate            NUMERIC(5,4) DEFAULT 0      -- e.g. 0.0875
payment_method_options      TEXT[] DEFAULT ARRAY['Check','ACH','Wire','Credit Card','Other']
portal_welcome_message      TEXT DEFAULT 'Welcome to your client portal.'
email_task_closed_subject   TEXT DEFAULT 'Your task has been completed'
email_task_closed_body      TEXT   -- supports {{task_title}}, {{resolution_notes}}, {{portal_link}}
email_invoice_subject       TEXT DEFAULT 'Invoice {{invoice_number}} from {{business_name}}'
email_invoice_body          TEXT
email_comment_subject       TEXT DEFAULT 'New comment on your task'
email_comment_body          TEXT
email_signature             TEXT
email_sender_name           TEXT
email_reply_to              TEXT
created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS:
- Admin: full CRUD where `tenant_id = auth_tenant_id()` AND `auth_role() = 'admin'`
- Client portal gets a limited read-only view (colors, business_name, logo_url, portal_welcome_message) via a DB view or function

---

#### `profiles`
```sql
id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
role        TEXT NOT NULL CHECK (role IN ('admin', 'client'))
full_name   TEXT
avatar_url  TEXT
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS:
- Admin: SELECT all profiles in their tenant
- Client: SELECT own profile only
- INSERT: service role only (during registration and invite flows)

---

#### `clients`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
name             TEXT NOT NULL
company          TEXT
email            TEXT
phone            TEXT
billing_address  JSONB                  -- {line1, line2, city, state, postal_code, country}
default_rate     NUMERIC(10,2)          -- hourly rate
payment_terms    INT DEFAULT 30         -- net days
currency         TEXT DEFAULT 'USD'
color            TEXT                   -- hex, used in FullCalendar
notes            TEXT
custom_fields    JSONB DEFAULT '{}'
is_archived      BOOLEAN NOT NULL DEFAULT false
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: Admin only — full CRUD where `tenant_id = auth_tenant_id()`

Indexes: `(tenant_id)`, `(tenant_id, is_archived)`

---

#### `client_portal_users`
Links a Supabase Auth user (`role = 'client'`) to a client record.
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
invited_at   TIMESTAMPTZ
accepted_at  TIMESTAMPTZ
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (tenant_id, client_id, user_id)
```
RLS: Admin CRUD; Client SELECT own row.

---

#### `tasks`
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
title             TEXT NOT NULL
description       TEXT                 -- Milkdown markdown (may contain R2 image URLs)
resolution_notes  TEXT                 -- Milkdown markdown; living doc, editable at any time
status            TEXT NOT NULL DEFAULT 'backlog'
                  CHECK (status IN ('backlog','in_progress','in_review','closed'))
priority          TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent'))
due_date          DATE
estimated_hours   NUMERIC(6,2)
tags              TEXT[] DEFAULT ARRAY[]::TEXT[]
closed_at         TIMESTAMPTZ          -- set when status transitions to 'closed'
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS:
- Admin: full CRUD where `tenant_id = auth_tenant_id()`
- Client: SELECT only where `tenant_id = auth_tenant_id()` AND `client_id` matches their linked client

Indexes: `(tenant_id)`, `(tenant_id, client_id)`, `(tenant_id, status)`, `(tenant_id, due_date)`

---

#### `task_attachments`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
file_name    TEXT NOT NULL
file_size    INT
mime_type    TEXT
r2_key       TEXT NOT NULL             -- full R2 object key
public_url   TEXT NOT NULL
uploaded_by  UUID REFERENCES auth.users(id)
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: Admin CRUD; Client SELECT where linked to task's client.

---

#### `comments`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
author_id    UUID NOT NULL REFERENCES auth.users(id)
author_role  TEXT NOT NULL CHECK (author_role IN ('admin', 'client'))
body         TEXT NOT NULL
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS:
- Admin: full CRUD where `tenant_id = auth_tenant_id()`
- Client: SELECT all comments on their tasks; INSERT/UPDATE/DELETE their own comments

Index: `(task_id, created_at)`

---

#### `time_entries`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL  -- nullable for ad hoc entries
description     TEXT NOT NULL
entry_date      DATE NOT NULL
duration_hours  NUMERIC(6,2) NOT NULL
billable        BOOLEAN NOT NULL DEFAULT true
billed          BOOLEAN NOT NULL DEFAULT false    -- set true when included in a sent invoice
hourly_rate     NUMERIC(10,2)                     -- rate snapshot at time of entry
invoice_id      UUID REFERENCES invoices(id)      -- set when invoiced
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: Admin only.

Indexes: `(tenant_id, client_id)`, `(tenant_id, entry_date)`, `(tenant_id, billable, billed)`, `(invoice_id)`

---

#### `invoices`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE
invoice_number  TEXT NOT NULL
status          TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','viewed','paid','overdue'))
issue_date      DATE NOT NULL DEFAULT CURRENT_DATE
due_date        DATE
memo            TEXT
subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0
discount_type   TEXT CHECK (discount_type IN ('flat','percent'))
discount_value  NUMERIC(10,2) DEFAULT 0
tax_rate        NUMERIC(5,4) DEFAULT 0
tax_amount      NUMERIC(12,2) DEFAULT 0
total           NUMERIC(12,2) NOT NULL DEFAULT 0
amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0
sent_at         TIMESTAMPTZ
viewed_at       TIMESTAMPTZ
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (tenant_id, invoice_number)
```

**Overdue logic:** Status is computed dynamically on read. A query or view treats an invoice as overdue when `status = 'sent'` AND `due_date < CURRENT_DATE`. This is the industry-standard approach (used by FreshBooks, Wave, Harvest) — no cron job needed, always accurate.

RLS: Admin only.

Indexes: `(tenant_id, client_id)`, `(tenant_id, status)`, `(tenant_id, due_date)`

---

#### `invoice_line_items`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE
time_entry_id   UUID REFERENCES time_entries(id) ON DELETE SET NULL  -- null for manual items
description     TEXT NOT NULL
quantity        NUMERIC(8,2) NOT NULL DEFAULT 1   -- hours for time entries
unit_price      NUMERIC(10,2) NOT NULL            -- rate, overridable per invoice
amount          NUMERIC(12,2) NOT NULL            -- quantity * unit_price
sort_order      INT NOT NULL DEFAULT 0
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: Admin only.

Index: `(invoice_id, sort_order)`

---

#### `payments`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE
amount          NUMERIC(12,2) NOT NULL
payment_date    DATE NOT NULL
payment_method  TEXT    -- from tenant_settings.payment_method_options
notes           TEXT
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: Admin only.

Indexes: `(invoice_id)`, `(tenant_id, payment_date)`

---

#### `email_log`
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
to_email       TEXT NOT NULL
subject        TEXT NOT NULL
type           TEXT NOT NULL   -- 'task_closed' | 'invoice' | 'comment' | 'invite'
related_id     UUID            -- task_id, invoice_id, etc.
resend_id      TEXT            -- Resend message ID for delivery tracking
status         TEXT DEFAULT 'sent'  -- 'sent' | 'failed'
error_message  TEXT
sent_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```
RLS: Admin SELECT only.

---

### RLS Summary

| Table | Admin | Client |
|---|---|---|
| `tenants` | service role only | — |
| `tenant_settings` | full CRUD (own tenant) | limited SELECT via view |
| `profiles` | SELECT all in tenant | SELECT own |
| `clients` | full CRUD | — |
| `client_portal_users` | full CRUD | SELECT own |
| `tasks` | full CRUD | SELECT (own client's tasks) |
| `task_attachments` | full CRUD | SELECT |
| `comments` | full CRUD | SELECT + INSERT/UPDATE/DELETE own |
| `time_entries` | full CRUD | — |
| `invoices` | full CRUD | — |
| `invoice_line_items` | full CRUD | — |
| `payments` | full CRUD | — |
| `email_log` | SELECT | — |

---

## Document 3: Next.js Route Map

### App Directory Structure

```
app/
  (admin)/
    layout.tsx                        SC: admin shell (sidebar + auth guard)
    page.tsx                          redirect → /dashboard
    dashboard/
      page.tsx                        SC: overview stats
    clients/
      page.tsx                        SC: client list + search
      new/
        page.tsx                      CC: new client form
      [clientId]/
        page.tsx                      SC: client detail
        edit/
          page.tsx                    CC: edit client form
    tasks/
      page.tsx                        SC+CC: task list/board (all clients)
      new/
        page.tsx                      CC: new task form
      [taskId]/
        page.tsx                      SC+CC: task detail (editors, comments, time)
    time/
      page.tsx                        CC: FullCalendar view (default)
      list/
        page.tsx                      SC: time entries list view
    invoices/
      page.tsx                        SC: invoice list
      new/
        page.tsx                      CC: invoice builder
      [invoiceId]/
        page.tsx                      SC+CC: invoice detail
        edit/
          page.tsx                    CC: edit invoice
    settings/
      page.tsx                        CC: tenant settings form
    reports/
      page.tsx                        SC: revenue reports
  portal/
    [tenantSlug]/
      layout.tsx                      SC: portal shell + client auth guard
      page.tsx                        SC: client task dashboard
      login/
        page.tsx                      CC: client login (email/password, magic link, Google)
      tasks/
        [taskId]/
          page.tsx                    SC+CC: task view + comment thread
  auth/
    login/
      page.tsx                        CC: admin login
    register/
      page.tsx                        CC: admin registration (creates tenant)
    reset-password/
      page.tsx                        CC: request password reset
    update-password/
      page.tsx                        CC: set new password (from email link)
    callback/
      route.ts                        Route Handler: Supabase PKCE code exchange
  api/
    upload/
      route.ts                        Route Handler: multipart → R2 upload
    pdf/
      [invoiceId]/
        route.ts                      Route Handler: generate + stream PDF
    email/
      task-closed/
        route.ts                      Route Handler: send task closed email
      invoice/
        route.ts                      Route Handler: send invoice email + PDF
      comment/
        route.ts                      Route Handler: send comment notification
  layout.tsx                          Root layout (fonts, ThemeProvider)
  not-found.tsx
  error.tsx
```

### Route Classification Table

| Route | Type | Auth | Notes |
|---|---|---|---|
| `/(admin)/dashboard` | SC | Admin | Stats server-fetched |
| `/(admin)/clients` | SC | Admin | Search via URL params |
| `/(admin)/clients/[clientId]` | SC+CC | Admin | CC for inline interactions |
| `/(admin)/tasks` | SC+CC | Admin | Board/list toggle = CC |
| `/(admin)/tasks/[taskId]` | SC+CC | Admin | Editors = CC |
| `/(admin)/time` | CC | Admin | FullCalendar requires CC |
| `/(admin)/invoices/new` | CC | Admin | Invoice builder |
| `/(admin)/settings` | CC | Admin | Settings form |
| `/portal/[tenantSlug]` | SC | Client | Task list |
| `/portal/[tenantSlug]/tasks/[taskId]` | SC+CC | Client | Comments = CC |
| `/portal/[tenantSlug]/login` | CC | None | Portal auth |
| `/auth/login` | CC | None | Admin auth |
| `/auth/register` | CC | None | Guarded by `ALLOW_REGISTRATION` |
| `/auth/callback` | Route Handler | None | PKCE exchange |
| `/api/upload` | Route Handler | Admin (server check) | POST multipart |
| `/api/pdf/[invoiceId]` | Route Handler | Admin | Streams PDF |
| `/api/email/*` | Route Handler | Admin | Server-side only |

### Middleware (`middleware.ts`)

Runs on every matched request:

1. **Session refresh** — `@supabase/ssr` refreshes cookies on every request
2. **Admin guard** (`/(admin)/*`) — verify session + `role === 'admin'` → else redirect to `/auth/login`
3. **Portal guard** (`/portal/[tenantSlug]/*` except `/login`) — verify session + `role === 'client'` + tenant matches slug → else redirect to portal login
4. **Registration guard** (`/auth/register`) — check `ALLOW_REGISTRATION === 'true'` env var → else 404
5. **Public passthrough** — `/auth/callback`, `/portal/[tenantSlug]/login`, `/auth/login`, `/api/*`

---

## Document 4: Component Architecture

### Directory Structure

```
components/
  ui/                           shadcn/ui primitives (auto-generated, do not edit)
  layout/
    Sidebar.tsx                 Fixed left nav, collapse, active state
    SidebarNav.tsx              Nav item definitions
    TopBar.tsx                  Page header with breadcrumb + action slot
    PageContainer.tsx           Max-width wrapper + consistent padding
  editor/
    MilkdownEditor.tsx          Reusable rich text editor (CC)
    ImageUploadPlugin.ts        Milkdown ProseMirror plugin: paste/drop interception
    EditorToolbar.tsx           Formatting controls
  tasks/
    TaskCard.tsx                Kanban card
    TaskBoard.tsx               Kanban column layout + drag-drop (CC)
    TaskList.tsx                Table/list view
    TaskStatusBadge.tsx
    TaskPriorityBadge.tsx
    TaskDetail.tsx              Full task detail (CC)
    CloseTaskDialog.tsx         Confirmation dialog for close action
    AttachmentList.tsx
    AttachmentUpload.tsx
  comments/
    CommentThread.tsx           Thread display + new comment form (CC)
    CommentItem.tsx
  time/
    TimeCalendar.tsx            FullCalendar wrapper (CC)
    TimeEntryModal.tsx          Create/edit time entry modal (CC)
    TimeEntryList.tsx           List view
    TimeEntryRow.tsx
  invoices/
    InvoiceBuilder.tsx          Invoice creation CC
    LineItemRow.tsx
    InvoicePDF.tsx              React-PDF document component
    InvoiceStatusBadge.tsx
  clients/
    ClientList.tsx
    ClientForm.tsx              CC: create/edit
  portal/
    PortalLayout.tsx            Branded portal shell
    PortalTaskCard.tsx
    PortalCommentThread.tsx
  shared/
    FileUploadButton.tsx        Generic file input → /api/upload
    DataTable.tsx               Reusable sortable/filterable table
    EmptyState.tsx
    LoadingSpinner.tsx
    DatePicker.tsx              shadcn Calendar wrapper
    CurrencyInput.tsx
    ColorPicker.tsx             For tenant settings brand colors
    ConfirmDialog.tsx
```

### Milkdown Editor — Inline Image Upload (Critical)

The `MilkdownEditor` component handles paste/drag-drop image uploads with zero interruption to the writing flow, mirroring Jira's behavior exactly.

**Flow:**
1. User pastes from clipboard or drags an image file into the editor
2. `ImageUploadPlugin` intercepts the `paste` or `drop` event before the default handler
3. Plugin immediately inserts a `Decoration.widget` placeholder (inline spinner) at the cursor position
4. Plugin POSTs the `File`/`Blob` as `multipart/form-data` to `/api/upload?path={uploadPath}`
5. API route uploads to R2, returns `{ url: "https://files.taskflow.macwillingham.com/..." }`
6. Plugin replaces the placeholder decoration with a standard Markdown image node: `![image](url)`
7. Perceived latency = network time only. Editor is never blocked or interrupted.

**Implementation notes:**
- Use Milkdown's `$prose` plugin system to register a ProseMirror plugin
- `handlePaste` and `handleDrop` in the plugin `props` spec intercept image files
- `Decoration.widget` renders a `<span>` with a CSS spinner as the placeholder
- The component accepts an `uploadPath` prop so it's reusable across all rich text contexts

**Props interface:**
```typescript
interface MilkdownEditorProps {
  value: string
  onChange: (value: string) => void
  uploadPath: string       // R2 folder prefix, e.g. "tenant-{id}/tasks/{taskId}/inline"
  placeholder?: string
  readOnly?: boolean
  minHeight?: string
}
```

**Usage on task detail page:**
- Description field: `<MilkdownEditor uploadPath="tenant-{id}/tasks/{taskId}/inline" />`
- Resolution notes field: same component, same `uploadPath`
- Both instances live on the same page simultaneously — fully independent

### FullCalendar Integration

**Packages (all MIT licensed — no commercial license required):**
```
@fullcalendar/react
@fullcalendar/daygrid
@fullcalendar/timegrid
@fullcalendar/interaction
```

- Wrapped in `TimeCalendar.tsx` — must be a Client Component (browser-only)
- Events color-coded by client using the `color` field stored in the `clients` table
- `eventDrop` → server action to update `time_entries.entry_date`
- `dateClick` → opens `TimeEntryModal` with date pre-filled
- `eventClick` → opens `TimeEntryModal` in edit mode
- Events fetched via SWR keyed to visible date range — re-fetches when calendar navigates

### PDF Template (`InvoicePDF.tsx`)

Rendered server-side in the API route:

```
GET /api/pdf/[invoiceId]
  1. Fetch invoice + line items + client + tenant_settings (service role)
  2. import { renderToBuffer } from '@react-pdf/renderer'
  3. Render <InvoicePDF /> with fetched data
  4. Stream buffer as Response with Content-Type: application/pdf
```

`InvoicePDF` uses React-PDF primitives (`Document`, `Page`, `View`, `Text`, `Image`):
- Header: tenant logo, business name, address
- Bill-to: client name, company, address
- Invoice metadata: number, issue date, due date, payment terms
- Line items table: description, quantity, rate, amount
- Subtotal / discount / tax / total block
- Memo/notes section
- Footer: payment instructions

Fonts: bundle Geist or Inter as a TTF file in the project for consistent cross-platform rendering.

---

## Document 5: Implementation Phases

### Phase 0 — Project Bootstrap (S)
**What gets built:**
- `create-next-app` with TypeScript, Tailwind, App Router
- shadcn/ui installation and configuration
- `@supabase/ssr` and `@supabase/supabase-js` installed
- `.env.example` with all required variable names (no values)
- `.gitignore` including `.env.local`, `.env*.local`
- `README.md` with setup instructions referencing `.env.example`
- Static sidebar layout shell (no auth yet)
- Vercel project connected, domain configured
- Cloudflare DNS CNAME record set (grey cloud)

**Dependencies:** None
**Complexity:** S

---

### Phase 1a — Auth: Email/Password + Admin Setup (M)
**What gets built:**
- Supabase: `tenants`, `profiles` tables with RLS
- `auth_tenant_id()` and `auth_role()` helper functions
- Admin registration page (`/auth/register`) — creates tenant (auto-slug from business name) + profile row via service role API route; guarded by `ALLOW_REGISTRATION` env var
- Admin login page (`/auth/login`)
- Password reset flow (`/auth/reset-password`, `/auth/update-password`)
- Auth callback route (`/auth/callback`) for PKCE
- Middleware: admin route guard, registration guard
- Authenticated admin layout with sidebar
- Supabase client utilities (server / browser / middleware variants)

**Dependencies:** Phase 0
**Complexity:** M

---

### Phase 1b — Auth: Magic Link (S)
**What gets built:**
- "Email me a sign-in link" option on admin login page
- End-to-end test of magic link flow

**Dependencies:** Phase 1a
**Complexity:** S

---

### Phase 1c — Auth: Google OAuth (S)
**What gets built:**
- Google Cloud Console: OAuth app created, authorized redirect URIs set
- Google provider enabled in Supabase Auth dashboard
- "Continue with Google" button on admin login page
- Callback already handles OAuth (no new route needed)

**Dependencies:** Phase 1b
**Complexity:** S

---

### Phase 2 — Client Management (M)
**What gets built:**
- DB: `clients` table with RLS
- Client list page with search and filter (archive toggle)
- New client form
- Client detail page (scaffold — task/invoice sections populated later)
- Edit client form
- Archive/unarchive client action

**Dependencies:** Phase 1a
**Complexity:** M

---

### Phase 3 — Task Management (L)
**What gets built:**
- DB: `tasks`, `task_attachments`, `comments` tables with RLS
- Cloudflare R2: bucket, CORS policy, env vars configured
- `/api/upload` route (server-side multipart → R2)
- `MilkdownEditor` + `ImageUploadPlugin` (inline image upload — the core critical piece)
- Task list view (table)
- Task board view (Kanban), toggleable with list view
- New task form
- Task detail page:
  - Description field (Milkdown, editable)
  - Resolution notes field (Milkdown, always visible, always editable)
  - Status transition buttons
  - "Close Task" button + `CloseTaskDialog` confirmation (reminds consultant to review notes)
  - File attachments section
  - Time entries stub (populated in Phase 4)
- Task close → calls `/api/email/task-closed` → Resend email with resolution notes + portal link
- DB: `email_log` table
- Resend: domain verified, API key configured, task-closed email template

**Dependencies:** Phase 2
**Complexity:** L

---

### Phase 4 — Time Tracking (M)
**What gets built:**
- DB: `time_entries` table with RLS
- `TimeCalendar.tsx` (FullCalendar) with drag-drop, date-click, event-click
- `TimeEntryModal` for create/edit
- Time entry list view (filter by client, date range, billable, billed status)
- "Log Time" button on task detail page (pre-fills task + client)
- Ad hoc time entry (client only, no task)
- Client color stored in `clients` table and reflected in calendar events

**Dependencies:** Phase 3
**Complexity:** M

---

### Phase 5 — Invoicing + PDF (L)
**What gets built:**
- DB: `invoices`, `invoice_line_items`, `payments` tables with RLS
- Invoice builder UI:
  - Select client → auto-populate unbilled billable time entries
  - Select/deselect individual line items
  - Override rates per line item
  - Manual line items (expenses, etc.)
  - Discount (flat or %) + tax fields
  - Auto-incremented invoice number (from `tenant_settings`)
  - Memo field
- Invoice list view with status filter
- Invoice detail page
- `InvoicePDF` React-PDF component
- `/api/pdf/[invoiceId]` streaming route
- Send invoice email (Resend) — HTML email + PDF attached
- Sending marks included time entries as `billed = true`
- Payment recording UI (partial payments supported)
- Auto-mark invoice as Paid when `amount_paid >= total`
- Overdue computed on read (`status = 'sent'` AND `due_date < today`)

**Dependencies:** Phase 4
**Complexity:** L

---

### Phase 6a — Client Portal (M)
**What gets built:**
- DB: `client_portal_users` table with RLS
- Portal layout shell (uses tenant `primary_color`, `logo_url`, `portal_welcome_message`)
- Consultant invite flow: "Invite Client" button → `supabase.auth.admin.inviteUserByEmail()` → creates `profiles` row with `role = 'client'`
- Client portal login page (email/password)
- Client task dashboard (`/portal/[tenantSlug]`)
- Portal task detail: title, status, description, resolution notes (read-only), comment thread
- Comment thread: both admin and client can post; client can edit/delete their own comments
- New client comment → `/api/email/comment` → Resend notification to consultant

**Dependencies:** Phase 5
**Complexity:** M

---

### Phase 6b — Portal Auth: Magic Link (S)
**What gets built:**
- Magic link option on portal login page

**Dependencies:** Phase 6a
**Complexity:** S

---

### Phase 6c — Portal Auth: Google OAuth (S)
**What gets built:**
- Google OAuth button on portal login page
- Post-OAuth hook/trigger ensures `role = 'client'` and `tenant_id` are set correctly in `profiles`

**Dependencies:** Phase 6b
**Complexity:** S

---

### Phase 7 — Settings + Reports (M)
**What gets built:**
- DB: `tenant_settings` table with RLS (seeded on tenant creation in Phase 1a)
- Settings page: all tenant settings (branding, email templates, invoice config, payment methods)
- Logo upload → R2
- Brand color pickers
- Tenant slug editor (with uniqueness validation)
- Reports page:
  - Revenue by client
  - Revenue by month / by year
  - Unbilled hours summary

**Dependencies:** Phase 6a
**Complexity:** M

---

### Phase 8 — Polish + Production Hardening (M)
**What gets built:**
- Dark mode (shadcn/ui theme toggle, CSS variable based)
- Empty states for all list views
- Error boundaries and error pages
- Loading skeletons throughout
- Mobile responsiveness audit
- Email log page in admin
- Security audit: no secrets in client bundles, full RLS coverage check
- Final README update

**Dependencies:** Phase 7
**Complexity:** M

---

## Document 6: Third-Party Integration Notes

### Supabase Setup Checklist

**Project:**
- [ ] Create Supabase project, note region
- [ ] Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**Auth providers (Dashboard → Authentication → Providers):**
- [ ] Email/password: enabled (default)
- [ ] Email confirmation: disabled for dev, enabled for production
- [ ] Magic link: enabled by default
- [ ] Google OAuth:
  - Google Cloud Console → New project → APIs & Services → Credentials → OAuth 2.0 Client ID (Web)
  - Authorized JavaScript origins: `https://taskflow.macwillingham.com`
  - Authorized redirect URIs: `https://{project-ref}.supabase.co/auth/v1/callback`
  - Copy Client ID + Secret → Supabase → Auth → Google provider → enable

**Auth email templates (Dashboard → Authentication → Email Templates):**
- [ ] Customize Invite email (used for client portal invitations)
- [ ] Customize Magic Link email
- [ ] Customize Password Reset email
- [ ] Optional: configure Resend as custom SMTP for auth emails (better deliverability)

**Database:**
- [ ] Enable RLS on all tables
- [ ] Create `auth_tenant_id()` and `auth_role()` SECURITY DEFINER functions
- [ ] Apply all RLS policies per Document 2
- [ ] Seed `tenant_settings` row on tenant creation (via service role in registration API route)

---

### Cloudflare R2 Setup Checklist

- [ ] Cloudflare Dashboard → R2 → Create bucket: `taskflow-files`
- [ ] Bucket Settings → Public Access: **Allow** (make bucket public)
- [ ] R2 → Manage R2 API Tokens → Create token: Object Read & Write, scoped to `taskflow-files`
- [ ] Note: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] R2 Custom Domain: bucket → Settings → Custom Domains → Add `files.taskflow.macwillingham.com` (Cloudflare handles DNS automatically)
- [ ] Note: `R2_PUBLIC_URL=https://files.taskflow.macwillingham.com`
- [ ] Apply CORS policy via Cloudflare dashboard or `wrangler`:
```json
[{
  "AllowedOrigins": ["https://taskflow.macwillingham.com", "http://localhost:3000"],
  "AllowedMethods": ["GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}]
```

**SDK:** `@aws-sdk/client-s3` — R2 is S3-compatible. Endpoint: `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

---

### Cloudflare DNS Setup

- [ ] DNS → Add record:
  - Type: `CNAME`
  - Name: `taskflow`
  - Target: `cname.vercel-dns.com`
  - Proxy status: **DNS only (grey cloud)** ← required for Vercel SSL
- [ ] In Vercel: Project → Settings → Domains → Add `taskflow.macwillingham.com`
- [ ] Do NOT manually add a DNS record for `files.taskflow.macwillingham.com` — let R2 Custom Domain manage it

---

### Resend Setup Checklist

- [ ] Resend account → Domains → Add `macwillingham.com`
- [ ] Add DNS records in Cloudflare: SPF, DKIM, DMARC (Resend provides exact values)
- [ ] Wait for domain verification
- [ ] API Keys → Create key with Send access only
- [ ] Note: `RESEND_API_KEY`
- [ ] Recommended sender address: `noreply@macwillingham.com`
- [ ] Install: `npm install resend`

---

### FullCalendar License

FullCalendar v6 is split-licensed:
- **MIT (free):** `@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `@fullcalendar/list`
- **Commercial:** Resource views, Scheduler plugin (not needed here)

**This project uses MIT plugins only. No license purchase required.**

---

### Milkdown Packages

```bash
npm install @milkdown/react @milkdown/core @milkdown/preset-commonmark \
  @milkdown/plugin-history @milkdown/plugin-upload \
  @milkdown/theme-nord @milkdown/utils
```

`@milkdown/plugin-upload` provides upload interception hooks. The inline placeholder/spinner behavior is layered on top using ProseMirror `Decoration.widget`.

---

### Vercel Deployment Config

- [ ] Connect GitHub repo → Vercel project
- [ ] Framework preset: Next.js (auto-detected)
- [ ] Root directory: `.` (default)
- [ ] Add all environment variables under Project → Settings → Environment Variables

---

### `.env.example` (Commit This File — No Values)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=taskflow-files
R2_PUBLIC_URL=https://files.taskflow.macwillingham.com

# Resend
RESEND_API_KEY=your_resend_api_key_here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature flags
ALLOW_REGISTRATION=true
```

---

### Secrets Hygiene Checklist (Applies to Every Phase)

- [ ] No API keys, connection strings, or credentials anywhere in source code
- [ ] All secrets in `.env.local` for dev, Vercel environment variables for production
- [ ] `.env.local` and `.env*.local` in `.gitignore` from first commit
- [ ] `.env.example` committed with placeholder values only
- [ ] `SUPABASE_SERVICE_ROLE_KEY` used only in server-side API routes and Server Actions — never in Client Components or passed to the browser
- [ ] `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` used only in `/api/upload` and other server-side routes
- [ ] `RESEND_API_KEY` used only in server-side email routes
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose (public by Supabase design)
- [ ] No secrets in comments, commit messages, console logs, or error messages

---

## Decisions Made

| # | Decision |
|---|---|
| 1 | Tenant slug auto-generated from business name (URL-safe), editable later in settings |
| 2 | `ALLOW_REGISTRATION=true` env var guards `/auth/register` — prevents arbitrary signups |
| 3 | Invoice PDFs regenerated on every request (always fresh, no R2 caching) |
| 4 | Client color stored in `clients.color` column — consultant controls calendar appearance |
| 5 | Clients can edit and delete their own portal comments |
| 6 | "Overdue" computed dynamically on read (`status = 'sent'` AND `due_date < today`) — industry standard, no cron required |
