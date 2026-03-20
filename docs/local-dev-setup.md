# Local Development Setup

Getting the app running locally for the first time.

---

## Prerequisites

- Node.js 20+
- Access to the shared Supabase project (ask the project owner for credentials)
- A Cloudflare R2 API token with read/write access to the dev bucket

---

## 1. Clone and install

```bash
git clone https://github.com/macwilling/TaskFlow.git
cd TaskFlow
npm install
```

---

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role (secret) |
| `NEXT_PUBLIC_BASE_DOMAIN` | Use `localhost:3000` for local dev |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → R2 → Overview |
| `R2_ACCESS_KEY_ID` | Cloudflare dashboard → R2 → Manage R2 API tokens |
| `R2_SECRET_ACCESS_KEY` | Generated when you create the R2 API token |
| `R2_BUCKET_NAME` | The dev bucket name (ask project owner) |
| `R2_PUBLIC_URL` | Public base URL for the dev bucket |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `ALLOW_REGISTRATION` | Set to `"true"` to create a new tenant account locally |

> **Never commit `.env.local`** — it's in `.gitignore`.

---

## 3. Database migrations

Migrations are already applied to the shared dev Supabase project — you don't need to run them unless you're adding a new one.

If you need to apply a new migration:
1. Write the migration file in `supabase/migrations/` following the naming convention (`YYYYMMDDHHMMSS_description.sql`)
2. Paste it into the Supabase SQL editor, or use the Supabase CLI:
   ```bash
   supabase db push
   ```
3. Update `docs/schema-reference.md` to reflect the new tables/columns

**Migration ordering matters** — see `docs/supabase-patterns.md` for the required order (`tenants` → `profiles` → helper functions → RLS policies → everything else).

---

## 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To create a new tenant account, set `ALLOW_REGISTRATION=true` in `.env.local` and register at `/auth/register`.

---

## 5. Running tests

```bash
npm run test:unit   # Vitest — no external services needed (all mocked)
npm run test:e2e    # Playwright — requires dev server running in another terminal
```

E2E tests use cached auth sessions (`tests/e2e/fixtures/`). If sessions expire, delete the fixture files and re-run — Playwright will re-authenticate and cache them.

E2E tests mock `/api/upload` (no real R2 calls) and set `RESEND_API_KEY=test` (no real emails sent).

---

## Common gotchas

**`params` / `searchParams` must be awaited**
All Next.js 16 pages receive `params` and `searchParams` as Promises. Forgetting `await` causes a runtime error that can look like a missing route.

**`ssr: false` in a Server Component throws at build**
Wrap browser-only imports (Milkdown, FullCalendar) in a `"use client"` component first, then use `dynamic(..., { ssr: false })` inside that wrapper. See `docs/component-patterns.md`.

**Hydration mismatch on dates**
Use `"en-US"` as the locale arg to `toLocaleDateString` — never pass `undefined`. For `DATE` columns, append `"T00:00:00"` before parsing to avoid UTC off-by-one. See `docs/component-patterns.md`.

**R2 upload fails with checksum error**
The S3Client must include `requestChecksumCalculation: "WHEN_REQUIRED"`. AWS SDK v3 sends CRC32 by default; R2 rejects it.

**Supabase join typed as array**
`supabase.from("tasks").select("*, clients(...)")` types the join as an array even for `*:1` FK relationships. Cast with `as unknown as T` at the call site. See `docs/supabase-patterns.md`.
