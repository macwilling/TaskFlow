import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { TimeCalendarWrapper } from "@/components/time/TimeCalendarWrapper";
import { List } from "lucide-react";

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Replicate the FullCalendar event shape from /api/time-entries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatEvents(data: any[]): object[] {
  return data.map((entry) => {
    const client = entry.clients as { name: string; color: string | null } | null;
    const color = client?.color ?? "#0969da";
    const hours = Number(entry.duration_hours);
    const label = `${client?.name ?? "?"} · ${hours % 1 === 0 ? hours : hours.toFixed(2)}h`;
    const startTime = entry.start_time as string | null;
    const hasTimed = startTime != null;

    let eventStart: string;
    let eventEnd: string | undefined;

    if (hasTimed) {
      const hhmm = startTime.substring(0, 5);
      eventStart = `${entry.entry_date}T${hhmm}`;
      const endDate = new Date(new Date(eventStart).getTime() + hours * 3_600_000);
      const pad = (n: number) => String(n).padStart(2, "0");
      eventEnd = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
    } else {
      eventStart = entry.entry_date;
    }

    return {
      id: entry.id,
      title: `${label} — ${entry.description}`,
      start: eventStart,
      ...(eventEnd ? { end: eventEnd } : {}),
      allDay: !hasTimed,
      backgroundColor: color,
      borderColor: color,
      textColor: "#ffffff",
      extendedProps: {
        description: entry.description,
        clientId: entry.client_id,
        clientName: client?.name ?? "",
        clientColor: color,
        taskId: entry.task_id,
        durationHours: hours,
        billable: entry.billable,
        billed: entry.billed,
        startTime: startTime ? startTime.substring(0, 5) : null,
      },
    };
  });
}

export default async function TimePage() {
  const supabase = await createClient();

  // Current week range (Sun–Sat+1) matching FullCalendar's timeGridWeek request
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const start = dateStr(weekStart);
  const end = dateStr(weekEnd);

  const [{ data: clients }, { data: tasks }, { data: entries }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, color, default_rate, client_key")
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("tasks")
      .select("id, title, client_id, task_number, status")
      .not("status", "eq", "closed")
      .order("title"),
    supabase
      .from("time_entries")
      .select("id, description, entry_date, start_time, duration_hours, billable, billed, hourly_rate, client_id, task_id, clients(name, color), tasks(title)")
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date", { ascending: true }),
  ]);

  const initialEvents = formatEvents(entries ?? []);

  return (
    <>
      <TopBar
        title="Time"
        actions={
          <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
            <Link href="/app/time/list">
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
          initialEvents={initialEvents}
        />
      </PageContainer>
    </>
  );
}
