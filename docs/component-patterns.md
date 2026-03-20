# Component Patterns Reference

Recurring patterns and gotchas for building components in this project.

---

## Server vs Client Component decision

| Use Server Component when | Use Client Component when |
|---|---|
| Fetching data from Supabase | Using `useState`, `useEffect`, `useRef` |
| Static UI, no interactivity | Event handlers (`onClick`, `onChange`) |
| Reading URL params/cookies | FullCalendar, Milkdown (browser-only libs) |
| Auth checks | Modals, dialogs, toggling UI state |

**Default to Server Components.** Only add `"use client"` when you actually need it.

---

## `dynamic({ ssr: false })` — must be in a Client Component

Next.js 16 does NOT allow `ssr: false` in Server Components. Create a wrapper:

```tsx
// TimeCalendarWrapper.tsx
"use client";
import dynamic from "next/dynamic";

const LazyCalendar = dynamic(
  () => import("@/components/time/TimeCalendar").then((m) => m.TimeCalendar),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-md bg-muted/30" /> }
);

export function TimeCalendarWrapper(props: Props) {
  return <LazyCalendar {...props} />;
}
```

Then the Server Component imports and uses `TimeCalendarWrapper` (not the dynamic directly).

This pattern applies to: FullCalendar, Milkdown/Crepe, any library that uses `window`/`document` at import time.

---

## Server Action pattern

```ts
// app/actions/foo.ts
"use server";

export async function doSomethingAction(id: string, input: Input): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase.from("foo").update(input).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/foo");
  return {};
}
```

Actions that create something and redirect:
```ts
revalidatePath("/foo");
redirect(`/foo/${data.id}`);  // must be called outside try/catch
```

---

## Calling server actions from dialogs (useTransition pattern)

```tsx
"use client";
import { useState, useTransition } from "react";
import { doSomethingAction } from "@/app/actions/foo";

export function FooDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await doSomethingAction(id, { ... });
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        // optionally: router.refresh()
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      ...
      <Button onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </Dialog>
  );
}
```

Use `useTransition` (not `useState` for loading) — it keeps the UI responsive during the async action.

---

## Form with useActionState (for page-level forms)

```tsx
"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createFooAction } from "@/app/actions/foo";

function SubmitButton() {
  const { pending } = useFormStatus();  // must be inside <form>
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>;
}

export function FooForm() {
  const [state, formAction] = useActionState(createFooAction, null);

  return (
    <form action={formAction}>
      <Input name="title" required />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

For bound actions (edit forms that need an ID):
```ts
const boundAction = updateFooAction.bind(null, fooId);
const [state, formAction] = useActionState(boundAction, null);
```

---

## Refreshing server data after client mutations

After a mutation in a Client Component:
```tsx
import { useRouter } from "next/navigation";

const router = useRouter();

// After successful action:
router.refresh();  // re-runs Server Components on this route, re-fetches data
```

For FullCalendar specifically, also call `calendarRef.current?.getApi().refetchEvents()` to trigger the events callback.

---

## Milkdown Crepe editor

`components/editor/MilkdownEditor.tsx` — always dynamically imported with `ssr: false` (via a `"use client"` wrapper):

```ts
const MilkdownEditor = dynamic(() => import("@/components/editor/MilkdownEditor"), { ssr: false });
```

Uses **`@milkdown/crepe`** (not the lower-level `@milkdown/core` / `@milkdown/react` API). Crepe is the all-in-one editor with slash commands (`/`), floating formatting toolbar, image blocks, and link tooltips built in.

**Implementation details:**
- Uses `useEffect` + `useRef` to create/destroy the `Crepe` instance imperatively
- Image upload: `featureConfigs[Crepe.Feature.ImageBlock].onUpload` — calls `POST /api/upload` and returns the public URL
- `readOnly` changes applied via a separate `useEffect` that calls `crepe.setReadonly()`
- CSS imported in `globals.css`: `@import "@milkdown/crepe/theme/common/style.css"` + `frame.css` at the top, before `@tailwind`
- Crepe color tokens overridden in `globals.css` under `.milkdown { --crepe-color-* }` — dark mode adapts automatically via `.dark { }` Tailwind vars

---

## FullCalendar

`components/time/TimeCalendar.tsx` — always dynamically imported via a `"use client"` wrapper (see pattern above).

**Event fetching:** FullCalendar's `events` callback prop calls `GET /api/time-entries?start=...&end=...`. Also supports `?client=<id>&billed=false&billable=true` (no date range) — returns raw entry objects for invoice builder.

**Drag-drop:** calls `updateTimeEntryDateAction` server action. After: `calendarRef.current?.getApi().refetchEvents()`.

**Import sources:**
- `EventDropArg` — from `@fullcalendar/core` (NOT `@fullcalendar/interaction`)
- `DateClickArg` — from `@fullcalendar/interaction`

---

## File uploads (Cloudflare R2)

`POST /api/upload?path=<r2-prefix>` with `multipart/form-data`. Returns `{ url, key }`.

Path convention:
- `tenant-{tenantId}/tasks/{taskId}/inline` — editor inline images
- `tenant-{tenantId}/tasks/{taskId}/attachments` — file attachments

**R2 gotcha:** requires `requestChecksumCalculation: "WHEN_REQUIRED"` on the S3Client. AWS SDK v3 sends CRC32 checksums by default which R2 rejects.

---

## Email

API routes in `app/api/email/`:
- `task-closed` — triggered from `closeTaskAction` (fire-and-forget, non-blocking)
- `comment` — triggered from comment server action
- `invoice` — triggered when invoice is sent

All use Resend and log to the `email_log` table. Pattern: call the route in a fire-and-forget `fetch()` from the server action — do not `await`.

---

## TopBar — breadcrumbs (preferred for detail/edit pages)

Use `breadcrumbs` instead of `title`/`description` on any page that sits below a list page. The last breadcrumb is the current page (non-linked, bold); earlier ones are links.

```tsx
<TopBar
  breadcrumbs={[
    { label: "Tasks", href: "/tasks" },
    { label: "AC-42" },          // current page — no href
  ]}
  actions={<DeleteTaskButton ... />}
/>
```

Naming convention by section:
- Tasks detail/edit: `Tasks > AC-42`
- Client detail: `Clients > Acme Corp`
- Client edit: `Clients > Acme Corp > Edit`
- Invoice detail/edit: `Invoices > INV-001`

Top-level list pages (Tasks, Clients, Invoices…) continue to use `title` + optional `actions` — no breadcrumbs needed.

## TopBar — title/description (top-level list pages)

```tsx
<TopBar
  title="Page title"
  description="Optional subtitle"
  actions={
    <Button size="sm" className="h-7 gap-1 text-xs">
      <PlusIcon className="h-3.5 w-3.5" />
      New item
    </Button>
  }
/>
```

Button sizing convention: `size="sm" className="h-7 gap-1 text-xs"` for TopBar actions.

---

## Hydration — locale-safe date formatting

**Never** use `toLocaleString(undefined)` in Client Components — server and client may render different locales, causing hydration mismatch.

```ts
// ❌ Bad — hydration mismatch
new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })

// ✅ Good — pinned locale
new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
```

Note the `+ "T00:00:00"` for `DATE` columns — without it, JS parses as UTC and may show the previous day.

---

## useSearchParams() — must be in Suspense

```tsx
// In the page:
<Suspense>
  <FiltersComponent />
</Suspense>

// In the component:
"use client";
import { useSearchParams } from "next/navigation";
export function FiltersComponent() {
  const searchParams = useSearchParams();
  // ...
}
```

Without `<Suspense>`, Next.js will throw at build time.

---

## shadcn/ui components installed

| Component | Notes |
|---|---|
| Alert | built-in |
| Badge | built-in |
| Button | built-in |
| Checkbox | `npx shadcn@latest add checkbox` |
| Dialog | `@radix-ui/react-dialog` |
| Dropdown Menu | `@radix-ui/react-dropdown-menu` |
| Input | built-in |
| Label | `@radix-ui/react-label` |
| Select | `@radix-ui/react-select` |
| Separator | `@radix-ui/react-separator` |
| Textarea | built-in |

To add more shadcn components: `npx shadcn@latest add [component]`. Do not manually create component files in `components/ui/` — use the CLI.
