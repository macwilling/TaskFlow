"use client";

import { useTransition } from "react";
import { updateTaskStatusAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "./TaskStatusBadge";

const STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
] as const;

interface TaskStatusControlProps {
  taskId: string;
  currentStatus: string;
}

export function TaskStatusControl({ taskId, currentStatus }: TaskStatusControlProps) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: string) {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, status);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TaskStatusBadge status={currentStatus} />
      {STATUSES.filter((s) => s.value !== currentStatus && currentStatus !== "closed").map((s) => (
        <Button
          key={s.value}
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          disabled={isPending}
          onClick={() => setStatus(s.value)}
        >
          {s.label}
        </Button>
      ))}
      {currentStatus === "closed" && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          disabled={isPending}
          onClick={() => setStatus("in_progress")}
        >
          Reopen
        </Button>
      )}
    </div>
  );
}
