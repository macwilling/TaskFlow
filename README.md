# TaskFlow

A multi-tenant SaaS platform for independent consultants — manage clients, tasks, time tracking, and invoicing with a dedicated client-facing portal.

Built with Next.js 16 App Router, Supabase, and Cloudflare R2. Each tenant gets a fully isolated workspace with row-level security enforced at the database layer.

---

## Features

### Client & Task Management
- **Client workspace** — manage clients with color coding, contact info, and per-client task lists
- **Task management** — Jira-style scoped task keys (`PROJ-1`, `PROJ-2`), full rich-text descriptions, file attachments, and inline time entry editing
- **Custom task statuses** — per-tenant configurable statuses with custom colors and ordering
- **Kanban board** — drag-and-drop card view across all statuses
- **Task audit log** — immutable history of status changes, title edits, and content changes
- **Milkdown Crepe editor** — WYSIWYG markdown with slash commands, floating toolbar, and inline image upload

### Time Tracking
- **FullCalendar view** — monthly/weekly calendar of all logged time entries
- **Drag-and-drop rescheduling** — move entries across days directly on the calendar
- **Client + billable filters** — slice time entries by client or billing status

### Invoicing
- **Invoice builder** — select unbilled time entries per client, set rates, add manual line items
- **PDF generation** — server-rendered PDF via `@react-pdf/renderer`, streamed on demand
- **Status lifecycle** — draft → sent → viewed → paid; overdue computed dynamically
- **Atomic invoice numbers** — `claim_invoice_number()` Postgres function prevents race conditions under concurrent requests

### Client Portal
- **Portal auth** — clients sign in via magic link or Google OAuth; matched to their account by email
- **Task visibility** — clients see their own tasks and can submit new requests
- **Invoice visibility** — clients see sent/viewed/paid invoices and line item breakdowns
- **Comments** — clients can add, edit, and delete their own comments on tasks

### Settings & Reports
- **Business settings** — name, logo, address, contact info, branding colors
- **Invoice settings** — number prefix, default tax rate, payment terms, payment method options
- **Email templates** — customisable subject/body for all outgoing emails; custom SMTP option
- **Reports** — revenue and time summaries by client and date range

### UX
- **Dark mode** — first-class dark mode via CSS variables, respects system preference with no flash
- **Mobile responsive** — hamburger sidebar on mobile, horizontal-scroll tables, single-column kanban
- **Loading skeletons** — skeleton screens on all data-heavy pages
- **Error boundaries** — `error.tsx` and `not-found.tsx` at the route-segment level

---

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

---

## Development

### Prerequisites

- Node.js 20+
- Access to the Supabase project (contact the project owner)
- `.env.local` with credentials (see `.env.example`)

See **[docs/local-dev-setup.md](docs/local-dev-setup.md)** for the full setup guide (credentials, migrations, test setup, common gotchas).

Quick start:

```bash
git clone https://github.com/macwilling/TaskFlow.git
cd TaskFlow
npm install
cp .env.example .env.local  # fill in credentials
npm run dev
```

### Commands

```bash
npm run dev        # Development server
npm run build      # Production build + TypeScript type-check
npm run lint       # ESLint
npm run test       # All tests (unit + integration)
npm run test:unit  # Vitest unit/integration tests
npm run test:e2e   # Playwright E2E (requires dev server running)
```

### Key docs

| File | Contents |
|---|---|
| `docs/local-dev-setup.md` | Full setup guide — credentials, migrations, tests, gotchas |
| `CLAUDE.md` | Architecture, workflow rules, testing conventions |
| `docs/schema-reference.md` | All tables, columns, RLS, migration history |
| `docs/supabase-patterns.md` | Query patterns, RLS templates, atomic counters |
| `docs/component-patterns.md` | SC/CC decision, server actions, Milkdown, FullCalendar |
| `plan.md` | Full technical plan and phase breakdown |

---

## Implementation Status

| Phase | Description | Status |
|---|---|---|
| 0 | Project bootstrap | ✅ |
| 1a–1c | Auth (email/password, magic link, Google OAuth) | ✅ |
| 2 | Client management | ✅ |
| 3 | Task management + Milkdown editor + R2 uploads | ✅ |
| 4 | Time tracking + FullCalendar | ✅ |
| 5 | Invoicing + React-PDF | ✅ |
| 6a–6c | Client portal (task view, magic link, Google OAuth) | ✅ |
| 7 | Settings + reports | ✅ |
| 8 | Polish + hardening | 🔄 In progress |
