# TaskFlow

A multi-tenant SaaS platform for independent consultants to manage clients, tasks, time tracking, invoicing, and payments — with an external client-facing portal.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database + Auth:** Supabase (Postgres + RLS + Auth)
- **File Storage:** Cloudflare R2
- **Email:** Resend
- **PDF Generation:** React-PDF (`@react-pdf/renderer`)
- **Calendar:** FullCalendar
- **Rich Text Editor:** Milkdown
- **Styling:** Tailwind CSS + shadcn/ui
- **Hosting:** Vercel
- **DNS:** Cloudflare

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/TaskFlow.git
cd TaskFlow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API (keep secret) |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_BUCKET_NAME` | Your R2 bucket name (default: `taskflow-files`) |
| `R2_PUBLIC_URL` | Your R2 custom domain (e.g. `https://files.yourdomain.com`) |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |
| `ALLOW_REGISTRATION` | `true` to enable new tenant sign-up |

### 4. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database migrations (see `supabase/migrations/` — added in Phase 1a)
3. Enable the Auth providers you need (email/password, magic link, Google OAuth)
4. Configure your auth email templates in Supabase Dashboard → Authentication → Email Templates

### 5. Set up Cloudflare R2

1. Create a bucket named `taskflow-files` (or whatever you set in `R2_BUCKET_NAME`)
2. Enable public access on the bucket
3. Set up a custom domain for the bucket
4. Create an R2 API token with Object Read & Write permissions
5. Apply the CORS policy (see `plan.md` → Document 6)

### 6. Set up Resend

1. Add and verify your sending domain in [resend.com](https://resend.com)
2. Create an API key with Send access only
3. Use a sender address on your verified domain (e.g. `noreply@yourdomain.com`)

### 7. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Secrets Hygiene

This repository is public. **Never commit secrets.**

- `.env.local` is in `.gitignore` — it will never be committed
- `.env.example` contains only placeholder values — it is safe to commit
- `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `RESEND_API_KEY` are used **server-side only** and must never appear in client-side code
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally public (Supabase design)

## Project Structure

```
app/
  (admin)/          Admin app (dashboard, clients, tasks, time, invoices, settings, reports)
  portal/           Client-facing portal
  auth/             Authentication pages
  api/              API routes (file upload, PDF generation, email)
components/
  layout/           Sidebar, TopBar, PageContainer
  ui/               shadcn/ui components
  editor/           Milkdown rich text editor
  tasks/            Task components
  time/             Time tracking + FullCalendar
  invoices/         Invoice builder + PDF
  portal/           Portal-specific components
  shared/           Reusable utilities
lib/
  utils.ts          cn() and other utilities
```

## Deployment

This app is deployed on Vercel. Set all environment variables under Project → Settings → Environment Variables in the Vercel dashboard.

DNS is managed on Cloudflare with a grey-cloud (DNS-only) CNAME pointing to Vercel. See `plan.md` → Document 6 for full DNS setup instructions.

## Implementation Status

| Phase | Description | Status |
|---|---|---|
| 0 | Project bootstrap | ✅ Done |
| 1a | Auth: email/password | ✅ Done |
| 1b | Auth: magic link | ✅ Done |
| 1c | Auth: Google OAuth | ✅ Done |
| 2 | Client management | ✅ Done |
| 3 | Task management | 🔄 In Progress |
| 4 | Time tracking | Pending |
| 5 | Invoicing + PDF | Pending |
| 6a | Client portal | Pending |
| 6b | Portal: magic link | Pending |
| 6c | Portal: Google OAuth | Pending |
| 7 | Settings + reports | Pending |
| 8 | Polish + hardening | Pending |
