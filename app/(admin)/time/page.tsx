import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { TimeCalendarWrapper } from "@/components/time/TimeCalendarWrapper";
import { List } from "lucide-react";

export default async function TimePage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: tasks }] = await Promise.all([
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
    <>
      <TopBar
        title="Time"
        actions={
          <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
            <Link href="/time/list">
              <List className="h-3.5 w-3.5" />
              List view
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <TimeCalendarWrapper
          clients={clients ?? []}
          tasks={tasks ?? []}
        />
      </PageContainer>
    </>
  );
}
