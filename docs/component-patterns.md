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

## TopBar actions slot

```tsx
<TopBar
  title="Page title"
  description="Optional subtitle"
  actions={
    <div className="flex items-center gap-2">
      <Button size="sm" className="h-7 gap-1 text-xs">
        <PlusIcon className="h-3.5 w-3.5" />
        New item
      </Button>
    </div>
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

| Component | Package |
|---|---|
| Button | built-in |
| Input | built-in |
| Label | `@radix-ui/react-label` |
| Select | `@radix-ui/react-select` |
| Textarea | built-in |
| Dialog | `@radix-ui/react-dialog` |
| Alert | built-in |
| Badge | built-in |
| Separator | `@radix-ui/react-separator` |

To add more shadcn components: `npx shadcn@latest add [component]`. Do not manually create component files in `components/ui/` — use the CLI.
