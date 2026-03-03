import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TaskStatusBadge, TaskPriorityBadge } from "./TaskStatusBadge";

interface Task {
  id: string;
  task_number: number | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  clients: { name: string; color: string | null; client_key: string | null } | null;
}

function taskHref(task: Task) {
  const key = task.clients?.client_key;
  if (key && task.task_number != null) return `/tasks/${key}-${task.task_number}`;
  return `/tasks/${task.id}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPastDue(due: string | null, status: string) {
  if (!due || status === "closed") return false;
  return new Date(due) < new Date();
}

export function TaskListView({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium">No tasks yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first task to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-20">ID</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Title</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Client</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Priority</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Due</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tasks.map((task) => (
            <tr key={task.id} className="group hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                {task.clients?.client_key && task.task_number != null ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {task.clients.client_key}-{task.task_number}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={taskHref(task)}
                  className="font-medium text-foreground hover:underline"
                >
                  {task.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {task.clients ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: task.clients.color ?? "#0969da" }}
                    />
                    {task.clients.name}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3">
                <TaskStatusBadge status={task.status} />
              </td>
              <td className="px-4 py-3">
                <TaskPriorityBadge priority={task.priority} />
              </td>
              <td className={`px-4 py-3 text-sm ${isPastDue(task.due_date, task.status) ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                {formatDate(task.due_date)}
              </td>
              <td className="pr-3">
                <Link href={taskHref(task)}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
