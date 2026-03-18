"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { TaskStatus } from "@/app/actions/task-statuses";

interface TaskFiltersProps {
  q: string;
  status: string;
  statuses: TaskStatus[];
  onQChange: (q: string) => void;
  onStatusChange: (status: string) => void;
}

export function TaskFilters({ q, status, statuses, onQChange, onStatusChange }: TaskFiltersProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onQChange(e.target.value);
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
        <button
          onClick={() => onStatusChange("")}
          className={`h-7 rounded-md px-2.5 text-xs transition-colors ${
            status === ""
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All
        </button>
        {statuses.map((s) => (
          <button
            key={s.id}
            onClick={() => onStatusChange(s.id)}
            className={`h-7 rounded-md px-2.5 text-xs transition-colors ${
              status === s.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
