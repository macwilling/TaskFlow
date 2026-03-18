"use client";

import { useState, useOptimistic, useTransition } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { updateTaskStatusAction } from "@/app/actions/tasks";
import type { TaskStatus } from "@/app/actions/task-statuses";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CloseTaskDialog } from "./CloseTaskDialog";

interface TaskStatusControlProps {
  taskId: string;
  statuses: TaskStatus[];
  currentStatusId: string;
  currentResolutionNotes: string;
}

export function TaskStatusControl({
  taskId,
  statuses,
  currentStatusId,
  currentResolutionNotes,
}: TaskStatusControlProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticStatusId, setOptimisticStatusId] = useOptimistic(currentStatusId);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  function setStatus(statusId: string) {
    startTransition(async () => {
      setOptimisticStatusId(statusId);
      await updateTaskStatusAction(taskId, statusId);
    });
  }

  const currentStatus = statuses.find((s) => s.id === optimisticStatusId) ?? statuses[0];
  const isClosed = currentStatus?.is_closed ?? false;
  const defaultStatus = statuses.find((s) => s.is_default);
  const openStatuses = statuses.filter((s) => !s.is_closed && s.id !== optimisticStatusId);
  const closedStatus = statuses.find((s) => s.is_closed);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
        >
          {currentStatus && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: currentStatus.color }}
            />
          )}
          {currentStatus?.name ?? "—"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-44">
          {isClosed ? (
            <DropdownMenuItem onClick={() => setStatus(defaultStatus?.id ?? statuses[0]?.id)}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reopen
            </DropdownMenuItem>
          ) : (
            <>
              {openStatuses.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => setStatus(s.id)}>
                  <span
                    className="mr-2 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                </DropdownMenuItem>
              ))}
              {closedStatus && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setCloseDialogOpen(true)}
                    style={{ color: closedStatus.color }}
                    className="focus:opacity-90"
                  >
                    Close task…
                  </DropdownMenuItem>
                </>
              )}
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
