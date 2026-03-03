import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/time-entries?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns FullCalendar-compatible event objects.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("time_entries")
    .select("id, description, entry_date, duration_hours, billable, billed, client_id, task_id, clients(name, color)")
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((entry) => {
    const client = entry.clients as unknown as { name: string; color: string | null } | null;
    const color = client?.color ?? "#0969da";
    const hours = Number(entry.duration_hours);
    const label = `${client?.name ?? "?"} · ${hours % 1 === 0 ? hours : hours.toFixed(2)}h`;

    return {
      id: entry.id,
      title: `${label} — ${entry.description}`,
      start: entry.entry_date,
      allDay: true,
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
      },
    };
  });

  return NextResponse.json(events);
}
