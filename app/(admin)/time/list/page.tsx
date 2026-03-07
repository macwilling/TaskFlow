import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { TimeEntryList } from "@/components/time/TimeEntryList";
import { TimeFilters } from "@/components/time/TimeFilters";
import { CalendarDays } from "lucide-react";

export default async function TimeListPage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    start?: string;
    end?: string;
    billable?: string;
    billed?: string;
  }>;
}) {
  const params = await searchParams;
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

  let query = supabase
    .from("time_entries")
    .select("id, description, entry_date, start_time, duration_hours, billable, billed, hourly_rate, client_id, task_id, clients(name, color), tasks(title)")
    .order("entry_date", { ascending: false });

  if (params.client) query = query.eq("client_id", params.client);
  if (params.start) query = query.gte("entry_date", params.start);
  if (params.end) query = query.lte("entry_date", params.end);
  if (params.billable === "yes") query = query.eq("billable", true);
  if (params.billable === "no") query = query.eq("billable", false);
  if (params.billed === "yes") query = query.eq("billed", true);
  if (params.billed === "no") query = query.eq("billed", false);

  const { data: entries } = await query;

  const totalHours = (entries ?? []).reduce(
    (sum, e) => sum + Number(e.duration_hours),
    0
  );

  return (
    <>
      <TopBar
        title="Time"
        actions={
          <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
            <Link href="/time">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar view
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <Suspense>
          <TimeFilters clients={clients ?? []} />
        </Suspense>
        <TimeEntryList
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entries={(entries ?? []) as unknown as any}
          clients={clients ?? []}
          tasks={tasks ?? []}
          totalHours={totalHours}
        />
      </PageContainer>
    </>
  );
}
