import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/tasks/TaskStatusBadge";
import { CommentThread } from "@/components/comments/CommentThread";
import { PortalReadOnlyEditor } from "@/components/portal/PortalTaskContent";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PortalTaskPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; taskId: string }>;
}) {
  const { tenantSlug, taskId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Fetch task — RLS client_tasks_select enforces access
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, description, resolution_notes, created_at, closed_at")
    .eq("id", taskId)
    .single();

  if (error || !task) notFound();

  // Fetch comments — RLS client_comments_select enforces access
  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, author_role, author_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  const isClosed = task.status === "closed";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <a
          href={`/portal/${tenantSlug}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to tasks
        </a>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{task.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-muted/20 px-5 py-4 text-sm">
        <div className="flex gap-3">
          <span className="w-24 shrink-0 text-muted-foreground">Due date</span>
          <span
            className={
              task.due_date && !isClosed && new Date(task.due_date) < new Date()
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-foreground"
            }
          >
            {formatDate(task.due_date)}
          </span>
        </div>
        <div className="flex gap-3">
          <span className="w-24 shrink-0 text-muted-foreground">Created</span>
          <span className="text-foreground">{formatDate(task.created_at)}</span>
        </div>
        {task.closed_at && (
          <div className="flex gap-3">
            <span className="w-24 shrink-0 text-muted-foreground">Closed</span>
            <span className="text-foreground">{formatDate(task.closed_at)}</span>
          </div>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </h2>
            <PortalReadOnlyEditor value={task.description} />
          </div>
        </>
      )}

      {/* Resolution notes */}
      {task.resolution_notes && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resolution Notes
            </h2>
            <PortalReadOnlyEditor value={task.resolution_notes} />
          </div>
        </>
      )}

      <Separator />

      {/* Comments */}
      <CommentThread
        taskId={taskId}
        currentUserId={user.id}
        comments={comments ?? []}
      />
    </div>
  );
}
