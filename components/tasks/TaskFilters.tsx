"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const STATUSES = [
  { value: "", label: "All" },
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "closed", label: "Closed" },
];

export function TaskFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`/tasks?${params.toString()}`);
    },
    [router, searchParams]
  );

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateParam("q", e.target.value);
    }, 300);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          defaultValue={q}
          onChange={handleSearch}
          placeholder="Search tasks…"
          className="h-8 pl-8 text-xs"
        />
      </div>
      <div className="flex items-center gap-1">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => updateParam("status", s.value)}
            className={`h-7 rounded-md px-2.5 text-xs transition-colors ${
              status === s.value
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
