# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build — also runs TypeScript type-check
npm run lint     # ESLint (flat config, eslint.config.mjs)
npm run start    # Serve production build
```

There are no tests. The build (`npm run build`) is the primary correctness check — always run it after changes.

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

Client portal RLS policies that join `client_portal_access` are intentionally deferred to Phase 6 — that table doesn't exist yet.

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

### Milkdown editor

`components/editor/MilkdownEditor.tsx` — always dynamically imported with `ssr: false`:

```ts
const MilkdownEditor = dynamic(() => import("@/components/editor/MilkdownEditor"), { ssr: false });
```

The `MilkdownProvider` wraps `useEditor` inside the component itself — do not add another provider externally. Styles live in `app/globals.css` under `.milkdown-wrapper .ProseMirror`.

The upload plugin uploader signature is:
```ts
(files: FileList, schema: Schema, ctx: Ctx, insertPos: number) => Promise<Node | Node[] | Fragment>
```

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

Phases 0–3 complete. Phase 4 (Time Tracking / FullCalendar) is next.

| Phase | Description | Status |
|---|---|---|
| 0 | Bootstrap | ✅ Done |
| 1a–1c | Auth (email, magic link, Google OAuth) | ✅ Done |
| 2 | Client management | ✅ Done |
| 3 | Task management + Milkdown + R2 | ✅ Done |
| 4 | Time tracking + FullCalendar | Pending |
| 5 | Invoicing + React-PDF | Pending |
| 6a–6c | Client portal | Pending |
| 7 | Settings + Reports | Pending |
| 8 | Polish + hardening | Pending |

Full technical plan (DB schema, route map, component architecture, integration notes) is in `plan.md`.
