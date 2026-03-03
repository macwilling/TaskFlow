import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskViewToggle } from "@/components/tasks/TaskViewToggle";
import { Plus } from "lucide-react";

interface SearchParams {
  q?: string;
  status?: string;
  view?: string;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, status, view } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, created_at, clients(name, color)")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("title", `%${q}%`);
  if (status) query = query.eq("status", status);

  const { data: tasks, error } = await query;

  return (
    <>
      <TopBar
        title="Tasks"
        actions={
          <Button asChild size="sm" className="h-7 gap-1 text-xs">
            <Link href="/tasks/new">
              <Plus className="h-3.5 w-3.5" />
              New task
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Suspense fallback={null}>
              <TaskFilters />
            </Suspense>
            <Suspense fallback={null}>
              <TaskViewToggle />
            </Suspense>
          </div>

          {error ? (
            <p className="text-sm text-destructive">Failed to load tasks: {error.message}</p>
          ) : view === "board" ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <TaskBoardView tasks={(tasks ?? []) as any} />
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <TaskListView tasks={(tasks ?? []) as any} />
          )}
        </div>
      </PageContainer>
    </>
  );
}
