"use client";

import { useState, useOptimistic, useTransition } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { updateTaskStatusAction } from "@/app/actions/tasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CloseTaskDialog } from "./CloseTaskDialog";

const STATUS_CONFIG = {
  backlog: {
    label: "Backlog",
    className:
      "bg-muted text-muted-foreground border-border",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900",
  },
  in_review: {
    label: "In Review",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
  },
  closed: {
    label: "Closed",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
  },
} as const;

const OPEN_STATUSES: Array<keyof typeof STATUS_CONFIG> = [
  "backlog",
  "in_progress",
  "in_review",
];

interface TaskStatusControlProps {
  taskId: string;
  currentStatus: string;
  currentResolutionNotes: string;
}

export function TaskStatusControl({
  taskId,
  currentStatus,
  currentResolutionNotes,
}: TaskStatusControlProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  function setStatus(status: string) {
    startTransition(async () => {
      setOptimisticStatus(status);
      await updateTaskStatusAction(taskId, status);
    });
  }

  const config =
    STATUS_CONFIG[optimisticStatus as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.backlog;

  const isClosed = optimisticStatus === "closed";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:opacity-50",
            config.className
          )}
        >
          {config.label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-40">
          {isClosed ? (
            <DropdownMenuItem onClick={() => setStatus("in_progress")}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reopen
            </DropdownMenuItem>
          ) : (
            <>
              {OPEN_STATUSES.filter((s) => s !== optimisticStatus).map((s) => (
                <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                  {STATUS_CONFIG[s].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCloseDialogOpen(true)}
                className="text-emerald-700 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-400"
              >
                Close task…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CloseTaskDialog
        taskId={taskId}
        currentResolutionNotes={currentResolutionNotes}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
      />
    </>
  );
}
