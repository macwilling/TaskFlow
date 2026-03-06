# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (localhost:3000)
npm run build      # Production build — also runs TypeScript type-check
npm run lint       # ESLint (flat config, eslint.config.mjs)
npm run start      # Serve production build
npm run test       # All tests (unit + integration)
npm run test:unit  # Vitest unit/integration tests
npm run test:e2e   # Playwright E2E tests (requires dev server running)
```

**Definition of done:** a feature or fix is not complete until `npm run build` passes **and** relevant tests pass. When adding or modifying logic in server actions, API routes, auth flows, or RLS-dependent queries, write or update the corresponding test. Do not leave tests as a follow-up — ship them with the change.

**Parallel work:** each task or issue group is developed in its own git worktree on a dedicated branch, then merged via PR. When starting a new task, work in a worktree unless told otherwise.

**PR workflow on sign-off:** When the user declares that a feature or fix is ready (e.g. "ready to go", "ship it", "looks good"), immediately and without asking for extra permissions: (1) create a branch if not already on one, (2) commit all changes, (3) push, (4) open a PR on GitHub. Return the PR URL as the final step. Never wait for a separate "go ahead to push" — sign-off is the trigger.

## Architecture

### Framework quirks (Next.js 16)

- **Middleware is `proxy.ts`**, not `middleware.ts`. Export is `proxy`, not `middleware`. This is a Next.js 16 rename.
- **`params` and `searchParams` are Promises** in all pages/layouts — always `await` them before use.
- **ESLint uses flat config** (`eslint.config.mjs`) — no `.eslintrc`.

### Route groups

```
app/
  (admin)/          Admin app — protected by proxy.ts + layout auth check
  portal/           Client-facing portal — tenant-scoped via /portal/[tenantSlug]
  auth/             Public auth pages + /auth/callback PKCE handler
  api/              upload, email/task-closed, auth/register
```

### Auth architecture

Two roles, one Supabase project. Role is stored in `app_metadata.role` (either `"admin"` or `"client"`) and in `profiles.role`. **`app_metadata` is set server-side via the service-role client** — it's what the middleware reads from the JWT without a DB round-trip.

- `proxy.ts` — session refresh + route guards (reads `user.app_metadata.role`)
- `app/(admin)/layout.tsx` — secondary server-side auth check (belt-and-suspenders)
- `app/auth/callback/route.ts` — handles both magic link and Google OAuth PKCE exchange; creates tenant/profile/settings on first OAuth sign-in
- `app/api/auth/register/route.ts` — email/password registration via service role; cleans up auth user if any downstream step fails

### Three Supabase clients

| File | When to use |
|---|---|
| `lib/supabase/client.ts` | Client Components (`createBrowserClient`) |
| `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers |
| `lib/supabase/admin.ts` | Service-role ops (bypass RLS) — server-side only |

`lib/supabase/middleware.ts` is used only by `proxy.ts` to refresh the session cookie.

### Multi-tenancy + RLS

Every business table has `tenant_id`. RLS policies use two `SECURITY DEFINER` helper functions defined in the initial migration:

- `auth_tenant_id()` — returns `profiles.tenant_id` for the current user
- `auth_role()` — returns `profiles.role` for the current user

**Migration ordering matters**: `profiles` table must exist before these functions. Functions must exist before policies that call them. See `supabase/migrations/20260303000000_initial_schema.sql` for the canonical order.

Client portal RLS policies that join `client_portal_access` are deferred to Phase 6 — that table and migration (`20260303000006_client_portal.sql`) will be created then.

### Supabase join typing

When selecting a related table (e.g. `clients(name, color)`), Supabase types the result as an array even for `*:1` FK relationships. Cast with `as unknown as T` or `as any` at the call site.

### Server Actions pattern

```ts
// Bound actions (for edit pages that need an ID):
const action = updateClientAction.bind(null, clientId);

// Form state:
const [state, formAction] = useActionState(action, null);

// Submit button:
const { pending } = useFormStatus(); // must be inside the <form> tree
```

Actions return `{ error?: string }`. They call `revalidatePath()` then `redirect()` on success.

### Milkdown Crepe editor

`components/editor/MilkdownEditor.tsx` — always dynamically imported with `ssr: false`:

```ts
const MilkdownEditor = dynamic(() => import("@/components/editor/MilkdownEditor"), { ssr: false });
```

Uses **`@milkdown/crepe`** (not the lower-level `@milkdown/core` / `@milkdown/react` API). Crepe is the all-in-one editor with slash commands (`/`), floating formatting toolbar, image blocks, and link tooltips built in.

The component uses `useEffect` + `useRef` to create/destroy the `Crepe` instance imperatively. Image upload is configured via `featureConfigs[Crepe.Feature.ImageBlock].onUpload`. `readOnly` changes are applied via a separate `useEffect` that calls `crepe.setReadonly()`.

CSS is imported in `globals.css` (`@import "@milkdown/crepe/theme/common/style.css"` + `frame.css` at the top, before `@tailwind`). Crepe color tokens are overridden in `globals.css` under `.milkdown { --crepe-color-* }` to match our design-system variables — dark mode adapts automatically since our Tailwind vars change under `.dark { }`.

### FullCalendar (Phase 4)

`components/time/TimeCalendar.tsx` — always dynamically imported via a `"use client"` wrapper:

```ts
// TimeCalendarWrapper.tsx ("use client")
const TimeCalendarDynamic = dynamic(
  () => import("@/components/time/TimeCalendar").then((m) => m.TimeCalendar),
  { ssr: false }
);
```

`ssr: false` in `next/dynamic` is NOT allowed in Server Components in Next.js 16 — must live in a Client Component wrapper. This applies to any library that requires the browser (FullCalendar, Milkdown, etc.).

Event fetching: FullCalendar's `events` callback prop calls `GET /api/time-entries?start=...&end=...`. Drag-drop calls `updateTimeEntryDateAction` server action. `calendarRef.current?.getApi().refetchEvents()` refreshes calendar after mutations.

`EventDropArg` is in `@fullcalendar/core`, not `@fullcalendar/interaction`. `DateClickArg` is in `@fullcalendar/interaction`.

### File uploads (Cloudflare R2)

`POST /api/upload?path=<r2-prefix>` with `multipart/form-data`. Returns `{ url, key }`. Path convention: `tenant-{tenantId}/tasks/{taskId}/inline` for editor images, `tenant-{tenantId}/tasks/{taskId}/attachments` for file attachments.

R2 requires `requestChecksumCalculation: "WHEN_REQUIRED"` on the S3Client — AWS SDK v3 sends CRC32 checksums by default which R2 rejects.

### Email

`POST /api/email/task-closed` — triggered from the `closeTaskAction` server action (fire-and-forget, non-blocking). Uses Resend. Logs to `email_log` table.

### Hydration

- Never use `toLocaleString(undefined)` or `toLocaleDateString(undefined)` in Client Components — pin to `"en-US"` to keep server/client output identical.
- Components that use `useSearchParams()` must be wrapped in `<Suspense>` in their parent page.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server-side only
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL                  # e.g. https://files.taskflow.macwillingham.com
RESEND_API_KEY
NEXT_PUBLIC_APP_URL            # e.g. http://localhost:3000
ALLOW_REGISTRATION             # "true" to allow /auth/register
```

## Implementation status

Phases 0–5 complete. Phase 6a (Client portal) is next.

| Phase | Description | Status |
|---|---|---|
| 0 | Bootstrap | ✅ Done |
| 1a–1c | Auth (email, magic link, Google OAuth) | ✅ Done |
| 2 | Client management | ✅ Done |
| 3 | Task management + Milkdown + R2 | ✅ Done |
| 4 | Time tracking + FullCalendar | ✅ Done |
| 5 | Invoicing + React-PDF | ✅ Done |
| 6a–6c | Client portal | Pending |
| 7 | Settings + Reports | Pending |
| 8 | Polish + hardening | Pending |

Full technical plan (DB schema, route map, component architecture, integration notes) is in `plan.md`.

## Testing conventions

Infrastructure is set up in issue #28. Follow these rules for all subsequent work:

### What to test
| Code changed | Required test |
|---|---|
| Server action (`app/actions/`) | Vitest unit test — mock Supabase, assert success + error paths |
| API route (`app/api/`) | Vitest integration test — mock external services (Resend, R2) |
| Auth / middleware logic | Vitest unit test — mock session, assert redirects and role gates |
| RLS policy added/changed | Vitest integration test against Supabase test project |
| New page or user flow | Playwright E2E spec |

### Unit test rules
- **Never hit real Supabase** — use the mock client at `lib/supabase/__mocks__/`
- Mock `lib/supabase/server.ts`, `lib/supabase/admin.ts`, and `lib/supabase/client.ts` via Vitest's module mocking
- Mock external services: Resend (`resend`), AWS S3Client (`@aws-sdk/client-s3`)
- Assert both the happy path and the primary error path for every action
- Server actions must assert `revalidatePath` is called on success and an `{ error }` object is returned on failure

### E2E test rules
- Use `storageState` fixtures to cache authenticated sessions — never re-login in every test
- Mock `/api/upload` in CI to return a fixture URL (avoid real R2 calls)
- Set `RESEND_API_KEY=test` or intercept with `page.route()` — never send real emails in tests
- Seed test data via Supabase admin API before suites; clean up after

### File structure
```
src/lib/                    # Unit tests co-located with source
  example.test.ts
  supabase/__mocks__/       # Shared Supabase mock client
tests/
  e2e/                      # Playwright specs
    fixtures/               # storageState, shared helpers
vitest.config.ts
playwright.config.ts
```

## Reference docs (`docs/`)

| File | Contents |
|---|---|
| `docs/schema-reference.md` | All tables, columns, FK relationships, RLS summary — quick lookup without reading migrations |
| `docs/supabase-patterns.md` | Client selection, join typing, RLS policy templates, atomic invoice number, overdue status pattern |
| `docs/component-patterns.md` | SC vs CC decision, `dynamic(ssr:false)` wrapper pattern, server action patterns, `useTransition` for dialogs, hydration-safe date formatting, shadcn components installed |
