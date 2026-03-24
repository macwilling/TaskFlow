"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateTaskFieldAction, reassignTaskClientAction } from "@/app/actions/tasks";

// ─── Priority ─────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900" },
  high: { label: "High", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900" },
  urgent: { label: "Urgent", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
} as const;

type Priority = keyof typeof PRIORITY_CONFIG;

export function PriorityEditor({
  taskId,
  priority,
  disabled,
}: {
  taskId: string;
  priority: string;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(priority as Priority);
  const [isPending, startTransition] = useTransition();

  const config = PRIORITY_CONFIG[current] ?? PRIORITY_CONFIG.medium;

  function select(p: Priority) {
    if (p === current) return;
    const prev = current;
    setCurrent(p);
    startTransition(async () => {
      const res = await updateTaskFieldAction(taskId, "priority", p);
      if (res.error) setCurrent(prev);
    });
  }

  if (disabled) {
    return (
      <Badge variant="outline" className={cn("text-xs", config.className)}>
        {config.label}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isPending && "opacity-60"
          )}
        >
          <Badge
            variant="outline"
            className={cn("text-xs cursor-pointer hover:opacity-80 transition-opacity", config.className)}
          >
            {config.label}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-32">
        {(Object.entries(PRIORITY_CONFIG) as [Priority, (typeof PRIORITY_CONFIG)[Priority]][]).map(
          ([p, cfg]) => (
            <DropdownMenuItem key={p} onSelect={() => select(p)} className="gap-2">
              <Badge
                variant="outline"
                className={cn("text-xs pointer-events-none", cfg.className)}
              >
                {cfg.label}
              </Badge>
              {p === current && (
                <span className="ml-auto text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Due date ─────────────────────────────────────────────────────────────────

export function DueDateEditor({
  taskId,
  dueDate,
  isOverdue,
  disabled,
}: {
  taskId: string;
  dueDate: string | null;
  isOverdue: boolean;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(dueDate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dueDate ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) return;
    setDraft(current ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const newVal = draft || null;
    if (newVal === current) return;
    const prev = current;
    setCurrent(newVal);
    startTransition(async () => {
      const res = await updateTaskFieldAction(taskId, "due_date", newVal);
      if (res.error) setCurrent(prev);
    });
  }

  function formatDisplay(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(current ?? "");
          }
        }}
        className="h-6 rounded border border-input bg-background px-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <div className={cn("group flex items-center gap-1.5", isPending && "opacity-60")}>
      <span
        className={cn(
          "text-sm",
          isOverdue && !disabled ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"
        )}
      >
        {formatDisplay(current)}
      </span>
      {!disabled && (
        <button
          onClick={startEdit}
          title="Edit due date"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Estimated hours ──────────────────────────────────────────────────────────

export function EstHoursEditor({
  taskId,
  estimatedHours,
  disabled,
}: {
  taskId: string;
  estimatedHours: number | null;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState(estimatedHours);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(estimatedHours != null ? String(estimatedHours) : "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) return;
    setDraft(current != null ? String(current) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const newVal = draft.trim() || null;
    const newNum = newVal ? parseFloat(newVal) : null;
    if (newNum === current) return;
    const prev = current;
    setCurrent(newNum);
    startTransition(async () => {
      const res = await updateTaskFieldAction(taskId, "estimated_hours", newVal);
      if (res.error) setCurrent(prev);
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.25"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(current != null ? String(current) : "");
          }
        }}
        className="h-6 w-20 rounded border border-input bg-background px-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="0"
      />
    );
  }

  return (
    <div className={cn("group flex items-center gap-1.5", isPending && "opacity-60")}>
      <span className="text-sm text-foreground">
        {current != null ? `${current}h` : "—"}
      </span>
      {!disabled && (
        <button
          onClick={startEdit}
          title="Edit estimated hours"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Client reassignment ─────────────────────────────────────────────────────

export interface ClientOption {
  id: string;
  name: string;
  color: string | null;
  client_key: string | null;
}

export function ClientEditor({
  taskId,
  clientId,
  clientName,
  clientColor,
  clientKey,
  clients,
  disabled,
}: {
  taskId: string;
  clientId: string;
  clientName: string;
  clientColor: string | null;
  clientKey: string | null;
  clients: ClientOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(clientId);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  function handleConfirm() {
    if (selectedId === clientId) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await reassignTaskClientAction(taskId, selectedId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (res.newSlug) {
        router.push(`/app/tasks/${res.newSlug}`);
      }
    });
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      setSelectedId(clientId);
      setError(null);
    }
    setOpen(o);
  }

  return (
    <>
      <div className="group flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: clientColor ?? "#0969da" }}
        />
        <Link
          href={`/app/clients/${clientKey ?? clientId}`}
          className="text-sm hover:underline text-foreground"
        >
          {clientName}
        </Link>
        {!disabled && (
          <button
            onClick={() => setOpen(true)}
            title="Reassign client"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign task client</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Reassigning moves this task to a different client. A few things to know:
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
              <li>The task ID will change to reflect the new client&apos;s key.</li>
              <li>All task details, attachments, and time entries will be visible to the new client via their portal.</li>
              <li>Any comments left by the original client will be permanently deleted.</li>
            </ul>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                New client
              </label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0 inline-block"
                          style={{ backgroundColor: c.color ?? "#0969da" }}
                        />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedId !== clientId && selectedClient && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                Moving from <strong>{clientName}</strong> to <strong>{selectedClient.name}</strong>. This cannot be undone.
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending || selectedId === clientId}
            >
              {isPending ? "Saving…" : "Confirm reassignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
