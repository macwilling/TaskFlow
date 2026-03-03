# TaskFlow — Claude Code Planning Prompt

## PHASE 1: PLAN (Do not write any application code yet)

You are acting as a senior full-stack architect. Your job is to produce a comprehensive, detailed technical plan for a consulting business management web app called **TaskFlow**. After I review and approve the plan, we will build it together incrementally.

**Do not write application code in this phase.** Output only the plan documents described at the end.

---

## What TaskFlow Is

TaskFlow is a multi-tenant SaaS platform for independent consultants to manage clients, tasks, time tracking, invoicing, and payments — with an external client-facing portal for task transparency and communication.

---

## Tech Stack (Non-Negotiable)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Database | Supabase (Postgres + Auth) |
| File Storage | Cloudflare R2 (all files: inline images, attachments, PDFs, tenant logos) |
| Admin Auth | Supabase Auth — email/password, password reset, magic link, Google OAuth |
| Client Portal Auth | Supabase Auth — email/password, password reset, magic link, Google OAuth |
| Rich Text Editor | Milkdown (markdown-based, with inline image support) |
| Calendar | FullCalendar |
| Email | Resend |
| PDF Generation | Your recommendation — evaluate React-PDF vs Puppeteer/html-to-pdf and recommend one with justification |
| Hosting | Vercel (free tier) |
| DNS | Cloudflare (domain: taskflow.macwillingham.com) |
| Styling | Tailwind CSS + shadcn/ui |

---

## Feature Requirements (Detailed)

### 1. Multi-Tenancy
- The database must be architected for multi-tenancy from day one using a `tenant_id` on all tables (or Supabase RLS policies scoped to tenant).
- For now, a single admin user per tenant is sufficient. No need for team/role management yet.
- Tenant settings (colors, branding, email copy, memo language, etc.) should live in a `tenant_settings` table so everything configurable is in one place.

### 2. Client Management
- Store: name, company, email, phone, billing address, default hourly rate, payment terms (net 15/30/60/custom), notes, currency preference, and any custom fields.
- Client list view with search/filter.
- Client detail page showing: open tasks, recent time entries, invoice history, payment history.

### 3. Task Management
- Tasks belong to a client.
- Fields: title, description (rich text via Milkdown — **inline images are required, stored in Cloudflare R2**), status (Backlog / In Progress / In Review / Closed), priority, due date, estimated hours, tags/labels, created date, updated date.
- **Inline image behavior must mirror Jira exactly:** paste an image from clipboard or drag-and-drop an image file directly into the editor → it uploads instantly to R2 in the background → the public R2 URL is inserted into the markdown as an inline image without any interruption to the writing flow. No separate upload button or modal. This applies to both the task description field and the resolution notes field.
- Status transitions should be explicit (not just a dropdown — use a Kanban-style board view AND a list view, toggleable).
- **Resolution notes** are a persistent rich text field (Milkdown) visible and editable on the task detail page at all times — not just at close. The consultant may draft, edit, and save resolution notes at any point while working. These notes represent what will ultimately be shared with the client, so they should be treated like a living document throughout the task lifecycle.
- **Closing a task** is a separate explicit action (a "Close Task" button with a confirmation prompt). Closing does NOT open a modal for notes — it simply changes the status to Closed and triggers the client notification email containing whatever is currently saved in the resolution notes field. The consultant should be reminded to review resolution notes before confirming close.
- Tasks can have time entries logged directly from the task detail view.
- Tasks can have file attachments (stored in Cloudflare R2).

### 4. Client Portal (External-Facing)
- Separate route: `/portal/[tenantSlug]/[taskId]` or similar.
- Clients authenticate via **Supabase Auth** — supporting email/password, password reset, magic link (passwordless email), and Google OAuth. The consultant does not manually set a client password; instead, the consultant invites a client by email, which triggers a Supabase invite/magic link flow.
- Client accounts are scoped to a tenant — a client user can only see their own tasks within the correct tenant's portal.
- Both admin and client auth use Supabase Auth, but with distinct roles/metadata to separate access. A client user hitting an admin route should be rejected, and vice versa.
- Plan auth implementation in phases — basic email/password first, then magic link, then Google OAuth — so each can be its own commit/PR.
- Portal shows: task title, status, description, resolution notes (when closed), and a comment thread.
- Both consultant and client can post comments in the thread. Consultant is notified of client comments via email.
- Consultant can also post questions/updates to the thread from the admin side.
- Portal should be clean, minimal, and brandable (uses tenant's color settings).
- Consider: a client dashboard at `/portal/[tenantSlug]` showing all their tasks at a glance.

### 5. Time Tracking
- Two modes:
  - **Task-linked:** Log time from within a task (description auto-populates task title, but is editable).
  - **Ad hoc / General:** Log time against a client with no task — just a description, duration, date, and billable flag.
- Fields per time entry: client, task (optional), description, date, duration (hours/minutes), billable (yes/no), billed (yes/no — set automatically when included in an invoice).
- **Calendar view** (FullCalendar) showing all time entries as events. Must support:
  - Drag and drop to change date/time of entries.
  - Click on empty slot to create a new time entry, with a modal to associate it with a task or just a client.
  - Color-coded by client.
- **List view** of all time for a client, filterable by date range, billable status, billed status.

### 6. Invoicing
- Invoice builder screen:
  - Select a client.
  - Auto-populate with all unbilled, billable time entries (task-linked + ad hoc).
  - Allow manual selection/deselection of individual time entries.
  - Show line items grouped by task (or ungrouped for ad hoc).
  - Editable fields per invoice: invoice number (auto-incremented, editable), issue date, due date, memo/notes (configurable default text from tenant settings), subtotal, discount (flat $ or %), tax (optional %), total.
  - Individual line item rates can be overridden per invoice.
  - Line items can be manually added (not from time entries) for things like expenses.
- Invoice statuses: Draft / Sent / Viewed / Paid / Overdue.
- **PDF version** accessible in the platform — clean, professional layout with tenant branding (logo, colors, address).
- Send invoice via email (Resend) — beautiful, modern HTML email template with the PDF attached.
- Invoices mark all included time entries as `billed = true` upon sending.

### 7. Payment Tracking
- Manual entry only — no Stripe or payment processor.
- Record payments against an invoice: amount, date, payment method (check/ACH/wire/other — configurable list), notes.
- Partial payments supported (invoice can have multiple payment records).
- Invoice is marked "Paid" when total payments >= invoice total.
- Payment history visible on client detail page and invoice detail page.
- Simple reporting: total revenue by client, by month, by year — for tax purposes.

### 8. Email (Resend)
- All emails use a clean, modern HTML template branded with tenant colors and logo.
- Triggered emails:
  - **Task closed notification** — sent to client with resolution notes included in the body. Includes a link to the portal to view/comment.
  - **Invoice email** — sent to client with a summary in the body + PDF attached. Subject, intro text, and footer are configurable in tenant settings.
  - **New comment notification** — sent to consultant when client comments on portal.
- All email copy (subject lines, body templates, signatures) must be configurable in tenant settings.
- Consider: email log table to track what was sent, to whom, and when.

### 9. Settings / Configurability
Everything a future client (tenant) might want to customize should live in `tenant_settings`. At minimum:
- Business name, logo (uploaded to Cloudflare R2), address, email, phone
- Primary and accent brand colors (used in portal, emails, PDF)
- Default invoice memo text
- Default payment terms
- Email templates (subject, greeting, body, signature) for each email type
- Invoice number prefix and starting number
- Currency and date format
- Payment method options (configurable list)
- Tax label and default tax rate
- Portal welcome message

---

## Plan Output Required

Please produce the following documents in your response:

### Document 1: Architecture Overview
- High-level diagram description (text-based, use ASCII or describe component relationships)
- Data flow: admin → Supabase → Vercel → client portal
- Auth strategy for both admin and client portal
- File storage strategy: Cloudflare R2 bucket structure, folder conventions, public vs private access, how presigned URLs or public CDN URLs will work for inline images in the editor
- PDF generation recommendation with justification
- Domain/DNS setup: `taskflow.macwillingham.com` on Cloudflare DNS pointing to Vercel via CNAME — note any Cloudflare proxy (orange cloud) considerations with Vercel

### Document 2: Full Database Schema
- Every table with columns, types, constraints, and foreign keys
- RLS policy strategy per table
- Indexes worth calling out
- Tenant settings table with every configurable field

### Document 3: Next.js Route Map
- Every route in the app (admin + portal)
- Whether each is a Server Component, Client Component, or API Route
- Middleware requirements (auth guards, tenant resolution)

### Document 4: Component Architecture
- Major shared components and where they live
- Milkdown editor wrapper component requirements — **the inline image upload flow is critical:** on paste or drag-drop, intercept the image, POST to a Next.js API route, upload to R2, return the public URL, and insert it into the editor. Must feel instantaneous like Jira (show a placeholder/spinner inline while uploading). This wrapper should be reusable across task description and resolution notes fields.
- FullCalendar integration notes
- PDF template component

### Document 5: Implementation Phases
Break the build into logical, incremental phases (e.g., 6–8 phases) that can each be executed in a single Claude Code session. Each phase should:
- Be independently deployable/testable
- List exactly what gets built
- List dependencies on prior phases
- Estimate relative complexity (S/M/L)

Auth should be broken into sub-phases within the plan: (1) email/password + password reset, (2) magic link, (3) Google OAuth — each as a discrete, committable unit.

### Document 6: Third-Party Integration Notes
- Supabase setup checklist (RLS, auth config — no storage buckets needed). Auth checklist must cover: email/password, magic link, Google OAuth (Google Cloud Console OAuth app setup, authorized redirect URIs), and Supabase invite flow for client onboarding
- **Cloudflare R2 setup checklist:** bucket creation, CORS policy for browser uploads, public access vs presigned URLs, R2 custom domain setup, env vars needed (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`)
- **Cloudflare DNS:** CNAME record for `taskflow.macwillingham.com` → Vercel. Note: set to DNS-only (grey cloud), not proxied, to avoid SSL conflicts with Vercel
- Resend setup (domain, API key, sender address — recommend `noreply@macwillingham.com` or similar)
- Vercel deployment config (all env vars needed across all services)
- FullCalendar license note (free vs commercial)
- Milkdown packages needed

---

## Design Direction

The UI should feel like **GitHub's interface** — clean, neutral, information-dense without feeling cluttered, with strong typographic hierarchy. Specific guidance:

- **Typography:** Use Geist Sans (already default in Next.js) — clean and modern
- **Color palette:** Neutral gray base (slate or zinc scale from Tailwind) with a single accent color used sparingly for CTAs, active states, and links. Avoid colorful gradients or decorative elements.
- **Component style:** Subtle borders, low-elevation shadows, tight spacing. Inputs, tables, and cards should feel compact and functional like GitHub's issue tracker.
- **Dark mode:** Plan for it from day one — shadcn/ui supports it natively. The app should look excellent in both light and dark.
- **Sidebar navigation:** Fixed left sidebar like GitHub's project/repo layout — not a top nav.
- **Data density:** Prefer showing more information per screen over large cards with lots of whitespace. Think GitHub issues list, not a Trello board with big chunky cards.
- **Accent color:** A single configurable brand color (from `tenant_settings`) should be used for primary buttons, links, and highlights. Default to a professional blue similar to GitHub's `#0969da`.
- **No Bootstrap, no generic SaaS template look.** If a component looks like it came from a free admin template, redesign it.

Claude Code should reference GitHub's UI (github.com) as the visual north star throughout the entire build.

---



This repository will be **public on GitHub**. Claude Code must treat secrets hygiene as a first-class concern throughout the entire build:

- **Never hardcode** API keys, connection strings, secrets, or credentials anywhere in the codebase
- All secrets must live in environment variables — `.env.local` for local dev, Vercel environment variables for production
- A `.env.example` file must be committed to the repo with all required variable names but **no values** — just placeholders like `SUPABASE_URL=your_supabase_url_here`
- `.env.local` and any `.env*` files (except `.env.example`) must be in `.gitignore` from the very first commit
- No secrets in comments, commit messages, console logs, or error messages
- Supabase anon key is safe to expose (it's public by design) — but the service role key is not and must only be used server-side in API routes, never in client components
- R2 credentials must only be used server-side (API routes / server actions) — never in client-side code
- Resend API key server-side only
- Client portal authentication is handled entirely by Supabase Auth — no custom password hashing needed. Never store client passwords manually.
- Include a thorough `README.md` with setup instructions referencing `.env.example` so anyone cloning the repo can get running without needing hardcoded values

Document 6 should include a complete `.env.example` template with every variable the app needs.

---



- Be thorough and precise. This plan will be handed directly to a developer (Claude Code) to execute.
- Flag any ambiguities or decisions I need to make before building begins.
- If you see a better approach than what's specified, note it as an alternative but default to the specified choice.
- Use markdown with clear headers and tables where appropriate.

---

*Once I review and approve this plan, I will provide a Phase 2 prompt to begin execution phase by phase.*