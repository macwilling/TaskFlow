import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Separator } from "@/components/ui/separator";
import { TaskStatusControl } from "@/components/tasks/TaskStatusControl";
import { TaskPriorityBadge } from "@/components/tasks/TaskStatusBadge";
import { CloseTaskDialog } from "@/components/tasks/CloseTaskDialog";
import { TaskEditors } from "@/components/tasks/TaskEditors";
import { AttachmentsList } from "@/components/tasks/AttachmentsList";
import { CommentThread } from "@/components/comments/CommentThread";
import { TaskTimeEntries } from "@/components/time/TaskTimeEntries";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const [{ data: task, error }, { data: profile }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, clients(id, name, color, tenant_id, tenants(id))")
      .eq("id", taskId)
      .single(),
    supabase.from("profiles").select("tenant_id").eq("id", user.id).single(),
  ]);

  if (error || !task) notFound();

  const client = task.clients as {
    id: string;
    name: string;
    color: string | null;
    tenant_id: string;
    tenants: { id: string } | null;
  } | null;

  const tenantId = profile?.tenant_id ?? client?.tenant_id ?? "";

  const [
    { data: attachments },
    { data: comments },
    { data: timeEntries },
    { data: allClients },
    { data: openTasks },
  ] = await Promise.all([
    supabase
      .from("task_attachments")
      .select("id, file_name, file_size, mime_type, public_url, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabase
      .from("comments")
      .select("id, body, author_role, author_id, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true }),
    supabase
      .from("time_entries")
      .select("id, description, entry_date, duration_hours, billable, billed, hourly_rate")
      .eq("task_id", taskId)
      .order("entry_date", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name, color, default_rate")
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("tasks")
      .select("id, title, client_id")
      .not("status", "eq", "closed")
      .order("title"),
  ]);

  const isClosed = task.status === "closed";

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <>
      <TopBar
        title={task.title}
        description={client?.name}
        actions={
          !isClosed && (
            <CloseTaskDialog
              taskId={taskId}
              currentResolutionNotes={task.resolution_notes ?? ""}
            />
          )
        }
      />

      <PageContainer>
        <div className="max-w-4xl space-y-8">
          {/* Meta panel */}
          <div className="grid grid-cols-2 gap-6 rounded-md border border-border bg-muted/20 px-5 py-4 text-sm">
            <dl className="space-y-2">
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground">Status</dt>
                <dd>
                  <TaskStatusControl taskId={taskId} currentStatus={task.status} />
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground">Priority</dt>
                <dd><TaskPriorityBadge priority={task.priority} /></dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground">Client</dt>
                <dd className="flex items-center gap-1.5">
                  {client && (
                    <>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: client.color ?? "#0969da" }}
                      />
                      <Link
                        href={`/clients/${client.id}`}
                        className="hover:underline text-foreground"
                      >
                        {client.name}
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <dl className="space-y-2">
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground">Due date</dt>
                <dd className={task.due_date && !isClosed && new Date(task.due_date) < new Date() ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"}>
                  {formatDate(task.due_date)}
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground">Est. hours</dt>
                <dd className="text-foreground">
                  {task.estimated_hours != null ? `${task.estimated_hours}h` : "—"}
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground">Created</dt>
                <dd className="text-foreground">{formatDate(task.created_at)}</dd>
              </div>
              {task.closed_at && (
                <div className="flex gap-4">
                  <dt className="w-28 shrink-0 text-muted-foreground">Closed</dt>
                  <dd className="text-foreground">{formatDate(task.closed_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          <Separator />

          {/* Rich text editors (description + resolution notes) */}
          <TaskEditors
            taskId={taskId}
            tenantId={tenantId}
            description={task.description ?? ""}
            resolutionNotes={task.resolution_notes ?? ""}
            isClosed={isClosed}
          />

          <Separator />

          {/* Attachments */}
          <AttachmentsList
            taskId={taskId}
            tenantId={tenantId}
            attachments={attachments ?? []}
          />

          <Separator />

          {/* Time entries */}
          <TaskTimeEntries
            taskId={taskId}
            clientId={client?.id ?? ""}
            clients={allClients ?? []}
            tasks={openTasks ?? []}
            entries={timeEntries ?? []}
          />

          <Separator />

          {/* Comments */}
          <CommentThread
            taskId={taskId}
            currentUserId={user.id}
            comments={comments ?? []}
          />
        </div>
      </PageContainer>
    </>
  );
}
