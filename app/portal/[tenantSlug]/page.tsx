import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationPayload } from "@/lib/portal/impersonation";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/tasks/TaskStatusBadge";

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const [user, supabase, impersonation] = await Promise.all([
    getCachedUser(),
    createClient(),
    getImpersonationPayload(),
  ]);

  const admin = createAdminClient();
  const isImpersonating = !!impersonation && impersonation.tenantSlug === tenantSlug;

  let clientId: string | undefined;
  let tenantId: string | undefined;

  if (isImpersonating) {
    clientId = impersonation!.clientId;
    tenantId = impersonation!.tenantId;
  } else {
    // Get the client_id for this portal user via RLS-scoped client
    const { data: access } = await supabase
      .from("client_portal_access")
      .select("client_id")
      .eq("user_id", user!.id)
      .single();
    clientId = access?.client_id;
    tenantId = user?.app_metadata?.tenant_id as string | undefined;
  }

  // In impersonation mode use admin client (bypasses RLS); otherwise use the user's session client
  const db = isImpersonating ? admin : supabase;

  const { data: tasks } = clientId
    ? await db
        .from("tasks")
        .select("id, title, status, priority, due_date, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Fetch welcome message if no tasks
  let welcomeMessage: string | null = null;
  if (!tasks?.length && tenantId) {
    const { data: settings } = await admin
      .from("tenant_settings")
      .select("portal_welcome_message")
      .eq("tenant_id", tenantId)
      .single();
    welcomeMessage = settings?.portal_welcome_message ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Your Tasks</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View and track the tasks your consultant is working on.
        </p>
      </div>

      {!tasks?.length ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {welcomeMessage ?? "No tasks yet. Your consultant will add tasks here."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/portal/${tenantSlug}/tasks/${task.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {task.title}
                </p>
                {task.due_date && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due {formatDate(task.due_date)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TaskPriorityBadge priority={task.priority} />
                <TaskStatusBadge status={task.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
