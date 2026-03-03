import { Suspense } from "react";
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

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Deferred async panel wrappers ────────────────────────────────────────────

async function AttachmentsPanel({
  taskId,
  tenantId,
}: {
  taskId: string;
  tenantId: string;
}) {
  const supabase = await createClient();
  const { data: attachments } = await supabase
    .from("task_attachments")
    .select("id, file_name, file_size, mime_type, public_url, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return (
    <AttachmentsList
      taskId={taskId}
      tenantId={tenantId}
      attachments={attachments ?? []}
    />
  );
}

async function TimeEntriesPanel({
  taskId,
  clientId,
}: {
  taskId: string;
  clientId: string;
}) {
  const supabase = await createClient();
  const [{ data: timeEntries }, { data: allClients }, { data: openTasks }] =
    await Promise.all([
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

  return (
    <TaskTimeEntries
      taskId={taskId}
      clientId={clientId}
      clients={allClients ?? []}
      tasks={openTasks ?? []}
      entries={timeEntries ?? []}
    />
  );
}

async function CommentsPanel({
  taskId,
  currentUserId,
}: {
  taskId: string;
  currentUserId: string;
}) {
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, author_role, author_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return (
    <CommentThread
      taskId={taskId}
      currentUserId={currentUserId}
      comments={comments ?? []}
    />
  );
}

// ─── Skeleton fallbacks ────────────────────────────────────────────────────────

function AttachmentsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
        <div className="h-6 w-20 rounded bg-muted/40 animate-pulse" />
      </div>
      <div className="h-12 rounded-md border border-dashed border-border bg-muted/10 animate-pulse" />
    </div>
  );
}

function TimeEntriesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
        <div className="h-6 w-24 rounded bg-muted/40 animate-pulse" />
      </div>
      <div className="h-20 rounded-md border border-dashed border-border bg-muted/10 animate-pulse" />
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
      <div className="divide-y divide-border rounded-md border border-border">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3 px-3 py-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
              <div className="h-3.5 w-full rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-20 rounded-md border border-border bg-muted/10 animate-pulse" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskKey: string }>;
}) {
  const { taskKey } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  // Parse "AC-42" → clientKey="AC", taskNumber=42
  const dashIdx = taskKey.lastIndexOf("-");
  if (dashIdx === -1) notFound();
  const clientKey = taskKey.slice(0, dashIdx).toUpperCase();
  const taskNumber = parseInt(taskKey.slice(dashIdx + 1), 10);
  if (!clientKey || isNaN(taskNumber)) notFound();

  // Look up the client first (scoped to the user's tenant via RLS)
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("client_key", clientKey)
    .single();

  if (!clientRow) notFound();

  const [{ data: task, error }, { data: profile }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, clients(id, name, color, client_key, tenant_id, tenants(id))")
      .eq("client_id", clientRow.id)
      .eq("task_number", taskNumber)
      .single(),
    supabase.from("profiles").select("tenant_id").eq("id", user.id).single(),
  ]);

  if (error || !task) notFound();

  const client = task.clients as {
    id: string;
    name: string;
    color: string | null;
    client_key: string | null;
    tenant_id: string;
    tenants: { id: string } | null;
  } | null;

  const taskId = task.id as string;
  const tenantId = profile?.tenant_id ?? client?.tenant_id ?? "";
  const isClosed = task.status === "closed";
  const displayKey = client?.client_key
    ? `${client.client_key}-${task.task_number}`
    : null;

  return (
    <>
      <TopBar
        title={task.title}
        description={
          displayKey && client
            ? `${displayKey} · ${client.name}`
            : client?.name
        }
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
                <dt className="w-28 shrink-0 text-muted-foreground">Task ID</dt>
                <dd className="font-mono text-xs text-muted-foreground pt-0.5">
                  {displayKey ?? "—"}
                </dd>
              </div>
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

          {/* Attachments — streamed */}
          <Suspense fallback={<AttachmentsSkeleton />}>
            <AttachmentsPanel taskId={taskId} tenantId={tenantId} />
          </Suspense>

          <Separator />

          {/* Time entries — streamed */}
          <Suspense fallback={<TimeEntriesSkeleton />}>
            <TimeEntriesPanel taskId={taskId} clientId={client?.id ?? ""} />
          </Suspense>

          <Separator />

          {/* Comments — streamed */}
          <Suspense fallback={<CommentsSkeleton />}>
            <CommentsPanel taskId={taskId} currentUserId={user.id} />
          </Suspense>
        </div>
      </PageContainer>
    </>
  );
}
