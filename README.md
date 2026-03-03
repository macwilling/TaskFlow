# TaskFlow

A multi-tenant SaaS platform for independent consultants to manage clients, tasks, time tracking, and invoicing — with a dedicated client-facing portal.

Built with Next.js 16 App Router, Supabase, and a fully type-safe stack. Each tenant (consultant) gets their own isolated workspace with row-level security enforced at the database layer.

## Features

### Client & Task Management
- **Client workspace** — manage clients with color coding, contact info, and per-client task lists
- **Task management** — Jira-style scoped task keys (`PROJ-1`, `PROJ-2`), status workflow, and full rich-text descriptions
- **Milkdown Crepe editor** — WYSIWYG markdown editor with slash commands (`/`), floating toolbar, inline image upload to R2, and file attachments
- **Inline time entry editing** — edit log entries directly on the task detail page without leaving context

### Time Tracking
- **FullCalendar view** — monthly/weekly calendar of all logged time entries
- **Drag-and-drop rescheduling** — move entries across days directly on the calendar
- **Client + billable filters** — slice time entries by client or billing status

### Invoicing
- **Invoice builder** — select unbilled time entries per client, set rates, add line items
- **PDF generation** — server-rendered PDF via `@react-pdf/renderer`, streamed on demand (no caching)
- **Status lifecycle** — draft → sent → viewed → paid; overdue computed dynamically
- **Atomic invoice numbers** — `claim_invoice_number()` Postgres function prevents race conditions

### Auth & Multi-tenancy
- **Three auth methods** — email/password, magic link, Google OAuth
- **Two-role model** — `admin` (consultant) and `client` (portal access), stored in JWT `app_metadata`
- **Full RLS isolation** — every table scoped by `tenant_id`; policies use `SECURITY DEFINER` helpers to avoid per-row DB joins

### UX
- **Optimistic UI** — instant feedback on status changes with background server sync
- **Loading skeletons** — skeleton screens on all data-heavy pages for perceived performance
- **Dark mode** — first-class dark mode via CSS variables throughout

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| Database + Auth | Supabase (Postgres + RLS + Auth) |
| File Storage | Cloudflare R2 (S3-compatible, public bucket) |
| Email | Resend |
| PDF Generation | `@react-pdf/renderer` v4 |
| Calendar | FullCalendar (MIT plugins) |
| Rich Text Editor | Milkdown Crepe |
| Styling | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |
| DNS | Cloudflare |

## Architecture Highlights

- **Middleware as `proxy.ts`** — Next.js 16 renames `middleware.ts`; exports `proxy` instead of `middleware`
- **Three Supabase clients** — browser client, server client (cookies), and admin client (service role / bypass RLS)
- **`params` / `searchParams` are Promises** in all pages and layouts — always awaited before use
- **`ssr: false` must live in a `"use client"` wrapper** — Next.js 16 forbids `next/dynamic` with `ssr: false` in Server Components
- **R2 checksum fix** — `requestChecksumCalculation: "WHEN_REQUIRED"` on the S3Client (AWS SDK v3 sends CRC32 by default, which R2 rejects)
- **Hydration-safe dates** — all `toLocaleString` calls pin to `"en-US"` to keep server/client output identical

## Project Structure

```
app/
  (admin)/          Admin app — dashboard, clients, tasks, time, invoices, settings, reports
  portal/           Client-facing portal — scoped by /portal/[tenantSlug]
  auth/             Auth pages + PKCE callback handler
  api/              File upload, PDF generation, email, auth registration
components/
  layout/           Sidebar, TopBar, PageContainer
  ui/               shadcn/ui components
  editor/           Milkdown Crepe rich text editor
  tasks/            Task list, detail, and status components
  time/             Time tracking + FullCalendar wrapper
  invoices/         Invoice builder + PDF renderer
  portal/           Portal-specific components
lib/
  supabase/         Browser, server, admin, and middleware clients
  utils.ts          cn() and shared utilities
supabase/
  migrations/       SQL migrations (schema, RLS, SECURITY DEFINER functions)
docs/               Schema reference, Supabase patterns, component patterns
```

## Local Development

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket (public access enabled)
- A [Resend](https://resend.com) account with a verified sending domain

### 1. Clone the repository

```bash
git clone https://github.com/macwilling/TaskFlow.git
cd TaskFlow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-side only, never expose** |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | R2 bucket name (e.g. `taskflow-files`) |
| `R2_PUBLIC_URL` | Public base URL for your R2 bucket (e.g. `https://files.yourdomain.com`) |
| `RESEND_API_KEY` | Resend API key (Send access only) |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `http://localhost:3000` for local dev) |
| `ALLOW_REGISTRATION` | Set to `"true"` to enable new tenant sign-up |

### 4. Run database migrations

Apply the migrations in `supabase/migrations/` to your Supabase project in order. You can do this via the Supabase CLI or by pasting each file into the SQL editor.

The initial migration (`20260303000000_initial_schema.sql`) creates the `profiles` table and the `auth_tenant_id()` / `auth_role()` SECURITY DEFINER functions that all RLS policies depend on — it must run first.

### 5. Enable auth providers

In the Supabase dashboard under **Authentication → Providers**, enable the methods you want:
- Email (for email/password and magic link)
- Google (requires a Google Cloud OAuth app)

### 6. Set up Cloudflare R2

1. Create a bucket and enable public access
2. Optionally configure a custom domain for the bucket
3. Create an R2 API token with **Object Read & Write** permissions
4. Add a CORS policy allowing `POST` from your app's origin

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register a new account (requires `ALLOW_REGISTRATION=true`).

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build + TypeScript type-check
npm run lint     # ESLint
npm run start    # Serve production build
```

> There are no automated tests. `npm run build` is the primary correctness check — always run it after changes.

## Deployment

The app is deployed on Vercel. Set all environment variables under **Project → Settings → Environment Variables**.

DNS is managed on Cloudflare with a grey-cloud (DNS-only) CNAME pointing to Vercel.

## Secrets

- `.env.local` is in `.gitignore` — it will never be committed
- `.env.example` contains only placeholder values
- `SUPABASE_SERVICE_ROLE_KEY`, R2 credentials, and `RESEND_API_KEY` are **server-side only** and must never appear in client-side code or `NEXT_PUBLIC_*` variables

## Implementation Status

| Phase | Description | Status |
|---|---|---|
| 0 | Project bootstrap | ✅ Done |
| 1a | Auth: email/password | ✅ Done |
| 1b | Auth: magic link | ✅ Done |
| 1c | Auth: Google OAuth | ✅ Done |
| 2 | Client management | ✅ Done |
| 3 | Task management + Milkdown editor + R2 uploads | ✅ Done |
| 4 | Time tracking + FullCalendar | ✅ Done |
| 5 | Invoicing + React-PDF | ✅ Done |
| 6a | Client portal | Pending |
| 6b | Portal: magic link auth | Pending |
| 6c | Portal: Google OAuth | Pending |
| 7 | Settings + reports | Pending |
| 8 | Polish + hardening | Pending |
