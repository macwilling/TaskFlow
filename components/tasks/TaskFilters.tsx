"use client";

import { useRef } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/app/actions/task-statuses";

const PRIORITY_CONFIG = {
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900" },
  high: { label: "High", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900" },
  urgent: { label: "Urgent", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
} as const;

type Priority = keyof typeof PRIORITY_CONFIG;

interface TaskFiltersProps {
  q: string;
  status: string;
  statuses: TaskStatus[];
  client: string;
  clients: { id: string; name: string; color: string | null }[];
  priority: string;
  view: string;
  onQChange: (q: string) => void;
  onStatusChange: (status: string) => void;
  onClientChange: (client: string) => void;
  onPriorityChange: (priority: string) => void;
}

function FilterPill({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap cursor-pointer select-none transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-muted/50 text-foreground hover:bg-muted"
      )}
    >
      {children}
    </div>
  );
}

export function TaskFilters({
  q,
  status,
  statuses,
  client,
  clients,
  priority,
  view,
  onQChange,
  onStatusChange,
  onClientChange,
  onPriorityChange,
}: TaskFiltersProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onQChange(e.target.value), 300);
  }

  const isBoard = view === "board";
  const currentStatus = statuses.find((s) => s.id === status);
  const currentClient = clients.find((c) => c.id === client);
  const currentPriority = priority ? PRIORITY_CONFIG[priority as Priority] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          defaultValue={q}
          onChange={handleSearch}
          placeholder="Search tasks…"
          className="h-8 pl-8 text-xs w-44"
        />
      </div>

      {/* Status — hidden on board view */}
      {!isBoard && (
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
            <FilterPill active={!!currentStatus}>
              {currentStatus ? (
                <>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: currentStatus.color }}
                  />
                  {currentStatus.name}
                </>
              ) : (
                "Status"
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </FilterPill>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onSelect={() => onStatusChange("")} className="gap-2">
              All statuses
              {!status && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {statuses.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => onStatusChange(s.id)} className="gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
                {status === s.id && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Priority */}
      <DropdownMenu>
        <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
          <FilterPill active={!!currentPriority}>
            {currentPriority ? (
              <Badge
                variant="outline"
                className={cn("text-xs pointer-events-none py-0 h-4 border-0 bg-transparent px-0", currentPriority.className)}
              >
                {currentPriority.label}
              </Badge>
            ) : (
              "Priority"
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </FilterPill>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuItem onSelect={() => onPriorityChange("")} className="gap-2">
            Any priority
            {!priority && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(Object.entries(PRIORITY_CONFIG) as [Priority, (typeof PRIORITY_CONFIG)[Priority]][]).map(
            ([p, cfg]) => (
              <DropdownMenuItem key={p} onSelect={() => onPriorityChange(p)} className="gap-2">
                <Badge variant="outline" className={cn("text-xs pointer-events-none", cfg.className)}>
                  {cfg.label}
                </Badge>
                {priority === p && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Client */}
      {clients.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
            <FilterPill active={!!currentClient}>
              {currentClient ? (
                <>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: currentClient.color ?? "#0969da" }}
                  />
                  {currentClient.name}
                </>
              ) : (
                "Client"
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </FilterPill>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onSelect={() => onClientChange("")} className="gap-2">
              All clients
              {!client && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {clients.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => onClientChange(c.id)} className="gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color ?? "#0969da" }}
                />
                {c.name}
                {client === c.id && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
