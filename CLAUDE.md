# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Commands

```bash
npm run dev        # Start development server (localhost:3000)
npm run build      # Production build — also runs TypeScript type-check
npm run lint       # ESLint (flat config, eslint.config.mjs)
npm run test       # All tests (unit + integration)
npm run test:unit  # Vitest unit/integration tests
npm run test:e2e   # Playwright E2E tests (requires dev server running)
```

## Workflow rules

**Definition of done:** a feature or fix is not complete until `npm run build` passes **and** relevant tests pass. When adding or modifying logic in server actions, API routes, auth flows, or RLS-dependent queries, write or update the corresponding test. Do not leave tests as a follow-up — ship them with the change.

**Parallel work:** each task or issue group is developed in its own git worktree on a dedicated branch, then merged via PR. When starting a new task, work in a worktree unless told otherwise.

**PR on sign-off:** When the user declares that a feature or fix is ready (e.g. "ready to go", "ship it", "looks good"), immediately and without asking: (1) create a branch if not on one, (2) commit all changes, (3) push, (4) open a PR on GitHub. Return the PR URL. Never wait for a separate "go ahead to push".

## Next.js 16 quirks

- **Middleware is `proxy.ts`**, not `middleware.ts`. Export is `proxy`, not `middleware`.
- **`params` and `searchParams` are Promises** in all pages/layouts — always `await` them before use.
- **`dynamic({ ssr: false })` must live in a `"use client"` component**, not a Server Component.
- **ESLint uses flat config** (`eslint.config.mjs`) — no `.eslintrc`.

## Route groups

```
app/
  (admin)/          Admin app — protected by proxy.ts + layout auth check
  portal/           Client-facing portal — tenant-scoped via /portal/[tenantSlug]
  auth/             Public auth pages + /auth/callback PKCE handler
  api/              upload, email/*, auth/register, time-entries
```

## Auth architecture

Two roles (`admin` / `client`), stored in `app_metadata.role` (JWT) and `profiles.role` (DB). `app_metadata` is set server-side via service-role client — middleware reads it from the JWT without a DB round-trip.

- `proxy.ts` — session refresh + route guards
- `app/(admin)/layout.tsx` — secondary server-side auth check
- `app/auth/callback/route.ts` — PKCE exchange for magic link + Google OAuth; creates tenant/profile/settings on first sign-in; handles portal OAuth (matches email → `clients`, creates profile + portal_access)
- `app/api/auth/register/route.ts` — email/password registration via service role; rolls back auth user on failure

## Supabase clients

| File | When to use |
|---|---|
| `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers |
| `lib/supabase/admin.ts` | Bypass RLS (registration, invites) — server-side only |
| `lib/supabase/client.ts` | Client Components (browser) |

`lib/supabase/middleware.ts` — only in `proxy.ts`. See `docs/supabase-patterns.md` for join typing, RLS templates, atomic counters, and overdue status pattern.

## Multi-tenancy + RLS

Every business table has `tenant_id`. RLS policies use two `SECURITY DEFINER` helpers:
- `auth_tenant_id()` — returns `profiles.tenant_id` for the current user
- `auth_role()` — returns `profiles.role` for the current user

Tasks use `status_id UUID FK task_statuses` (not a text status column). Task statuses are per-tenant rows seeded automatically on tenant creation.

## Tenant URLs

Use `lib/url.ts` — never build tenant URLs inline:
- `tenantUrl(slug, path?)` → `https://{slug}.{BASE_DOMAIN}{path}` (prod) or `http://localhost:3000{path}` (dev)
- `portalUrl(slug, path?)` → same base, `/portal/{slug}{path}` path

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server-side only
NEXT_PUBLIC_BASE_DOMAIN        # e.g. billabledesk.com (no leading dot)
NEXT_PUBLIC_APP_URL            # e.g. http://localhost:3000
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL                  # e.g. https://files.taskflow.macwillingham.com
RESEND_API_KEY
ALLOW_REGISTRATION             # "true" to allow /auth/register
```

## Implementation status

Phases 0–7 complete. SaaS migration (issues #87–#103) complete. **Phase 8 (Polish + hardening) is next.**

| Phase | Description | Status |
|---|---|---|
| 0 | Bootstrap | ✅ |
| 1a–1c | Auth (email, magic link, Google OAuth) | ✅ |
| 2 | Client management | ✅ |
| 3 | Task management + Milkdown + R2 | ✅ |
| 4 | Time tracking + FullCalendar | ✅ |
| 5 | Invoicing + React-PDF | ✅ |
| 6a–6c | Client portal (task view, magic link, Google OAuth) | ✅ |
| 7 | Settings + Reports | ✅ |
| 8 | Polish + hardening | Pending |

Full technical plan is in `plan.md`.

## Testing conventions

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
- Server actions must assert `revalidatePath` is called on success and `{ error }` returned on failure

### E2E test rules
- Use `storageState` fixtures to cache authenticated sessions — never re-login in every test
- Mock `/api/upload` in CI to return a fixture URL (avoid real R2 calls)
- Set `RESEND_API_KEY=test` or intercept with `page.route()` — never send real emails in tests
- Seed test data via Supabase admin API before suites; clean up after

### File structure
```
src/lib/                    # Unit tests co-located with source
  supabase/__mocks__/       # Shared Supabase mock client
tests/
  e2e/                      # Playwright specs
    fixtures/               # storageState, shared helpers
vitest.config.ts
playwright.config.ts
```

## Reference docs (`docs/`)

Read these when working on the relevant area — don't load all of them upfront.

| File | Read when… |
|---|---|
| `docs/local-dev-setup.md` | Onboarding a new contributor or troubleshooting the dev environment |
| `docs/schema-reference.md` | You need table columns, FK relationships, RLS summary, or migration history |
| `docs/supabase-patterns.md` | Writing queries, RLS policies, migrations, or using atomic counters |
| `docs/component-patterns.md` | Building UI — SC/CC decision, server actions, Milkdown, FullCalendar, R2 upload, shadcn list |
