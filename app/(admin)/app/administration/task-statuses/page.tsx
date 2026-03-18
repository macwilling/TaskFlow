import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { TaskStatusesForm } from "@/components/settings/TaskStatusesForm";
import { getTaskStatusesAction } from "@/app/actions/task-statuses";

export default async function TaskStatusesPage() {
  const [user] = await Promise.all([getCachedUser(), createClient()]);
  if (!user || user.app_metadata?.role !== "admin") redirect("/auth/login");

  const statuses = await getTaskStatusesAction();

  return (
    <>
      <TopBar title="Task Statuses" />
      <PageContainer>
        <div className="max-w-2xl space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              Customize the workflow stages for your tasks. Drag to reorder columns on the Kanban board.
            </p>
          </div>
          <TaskStatusesForm statuses={statuses} />
        </div>
      </PageContainer>
    </>
  );
}
