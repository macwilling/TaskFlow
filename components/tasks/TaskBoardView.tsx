import Link from "next/link";
import { TaskPriorityBadge } from "./TaskStatusBadge";

interface Task {
  id: string;
  task_number: number | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  clients: { name: string; color: string | null; client_key: string | null } | null;
}

function taskHref(task: Task) {
  const key = task.clients?.client_key;
  if (key && task.task_number != null) return `/tasks/${key}-${task.task_number}`;
  return `/tasks/${task.id}`;
}

const COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "closed", label: "Closed" },
] as const;

function isPastDue(due: string | null, status: string) {
  if (!due || status === "closed") return false;
  return new Date(due) < new Date();
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function TaskCard({ task }: { task: Task }) {
  const overdue = isPastDue(task.due_date, task.status);
  return (
    <Link
      href={taskHref(task)}
      className="block rounded-md border border-border bg-card p-3 shadow-sm hover:shadow-md hover:border-accent transition-all space-y-2"
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

export function TaskBoardView({ tasks }: { tasks: Task[] }) {
  const byStatus = Object.fromEntries(
    COLUMNS.map((col) => [
      col.id,
      tasks.filter((t) => t.status === col.id),
    ])
  );

  return (
    <div className="grid grid-cols-4 gap-3 min-h-[400px]">
      {COLUMNS.map((col) => {
        const colTasks = byStatus[col.id] ?? [];
        return (
          <div key={col.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground">{colTasks.length}</span>
            </div>
            <div className="flex-1 rounded-md bg-muted/30 p-2 space-y-2 min-h-[200px]">
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
