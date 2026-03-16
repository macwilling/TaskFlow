"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface ReportsFilterFormProps {
  defaultStart: string;
  defaultEnd: string;
}

export function ReportsFilterForm({ defaultStart, defaultEnd }: ReportsFilterFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const start = (form.elements.namedItem("start") as HTMLInputElement).value;
    const end = (form.elements.namedItem("end") as HTMLInputElement).value;
    startTransition(() => {
      router.push(`?start=${start}&end=${end}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="start" className="text-xs font-medium text-muted-foreground">
          From
        </label>
        <input
          id="start"
          name="start"
          type="date"
          defaultValue={defaultStart}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="end" className="text-xs font-medium text-muted-foreground">
          To
        </label>
        <input
          id="end"
          name="end"
          type="date"
          defaultValue={defaultEnd}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Loading…" : "Apply"}
      </button>
    </form>
  );
}
