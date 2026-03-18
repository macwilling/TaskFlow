"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskPriorityBadge, type TaskStatusShape } from "./TaskStatusBadge";

export type { TaskStatusShape };

export interface Task {
  id: string;
  task_number: number | null;
  title: string;
  status_id: string;
  task_statuses: TaskStatusShape | null;
  priority: string;
  due_date: string | null;
  created_at?: string;
  clients: { name: string; color: string | null; client_key: string | null } | null;
}

export function taskHref(task: Task) {
  const key = task.clients?.client_key;
  if (key && task.task_number != null) return `/app/tasks/${key}-${task.task_number}`;
  return `/app/tasks/${task.id}`;
}

function isPastDue(due: string | null, isClosed: boolean) {
  if (!due || isClosed) return false;
  return new Date(due) < new Date();
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

/** Plain card — used inside DragOverlay as the floating ghost */
export function TaskCard({ task, isOverlay }: TaskCardProps) {
  const overdue = isPastDue(task.due_date, task.task_statuses?.is_closed ?? false);
  return (
    <Link
      href={taskHref(task)}
      className={[
        "block rounded-md border border-border bg-card p-3 shadow-sm space-y-2",
        "hover:shadow-md hover:border-accent transition-all",
        isOverlay ? "shadow-xl rotate-1 cursor-grabbing" : "cursor-grab active:cursor-grabbing",
      ].join(" ")}
      // Prevent navigation when used as overlay ghost
      onClick={isOverlay ? (e) => e.preventDefault() : undefined}
    >
      {task.clients?.client_key && task.task_number != null && (
        <p className="font-mono text-[10px] text-muted-foreground">
          {task.clients.client_key}-{task.task_number}
        </p>
      )}
      <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <TaskPriorityBadge priority={task.priority} />
        {task.clients && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[100px]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: task.clients.color ?? "#0969da" }}
            />
            {task.clients.name}
          </span>
        )}
      </div>
      {task.due_date && (
        <p className={`text-xs ${overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
          Due {formatDate(task.due_date)}
        </p>
      )}
    </Link>
  );
}

/** Sortable wrapper — used inside a column's SortableContext */
export function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} />
    </div>
  );
}
