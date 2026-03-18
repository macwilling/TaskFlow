import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { TasksView } from "@/components/tasks/TasksView";
import { Plus } from "lucide-react";

export default async function TasksPage() {
  const supabase = await createClient();

  const [{ data: tasks, error }, { data: statuses }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, task_number, title, status_id, priority, due_date, created_at, task_statuses(id, name, color, is_closed), clients(name, color, client_key)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("task_statuses")
      .select("id, tenant_id, name, color, position, is_default, is_closed, created_at")
      .order("position", { ascending: true }),
  ]);

  return (
    <>
      <TopBar
        title="Tasks"
        actions={
          <Button asChild size="sm" className="h-7 gap-1 text-xs">
            <Link href="/app/tasks/new">
              <Plus className="h-3.5 w-3.5" />
              New task
            </Link>
          </Button>
        }
      />
      <PageContainer>
        {error ? (
          <p className="text-sm text-destructive">Failed to load tasks: {error.message}</p>
        ) : (
          <Suspense fallback={null}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TasksView tasks={(tasks ?? []) as any} statuses={(statuses ?? []) as any} />
          </Suspense>
        )}
      </PageContainer>
    </>
  );
}
