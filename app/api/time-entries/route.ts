import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/time-entries?start=YYYY-MM-DD&end=YYYY-MM-DD
// Optional: client=<id>, billed=true|false, billable=true|false
// Returns FullCalendar-compatible event objects OR raw time entry objects when
// client/billed/billable params are used without start/end.
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
  const clientId = searchParams.get("client");
  const billedParam = searchParams.get("billed");
  const billableParam = searchParams.get("billable");

  // Invoice builder mode: no date range required
  const invoiceMode = !start && !end && (clientId || billedParam !== null);

  if (!invoiceMode && (!start || !end)) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  let query = supabase
    .from("time_entries")
    .select("id, description, entry_date, duration_hours, billable, billed, hourly_rate, client_id, task_id, clients(name, color), tasks(title)")
    .order("entry_date", { ascending: invoiceMode ? false : true });

  if (start) query = query.gte("entry_date", start);
  if (end) query = query.lte("entry_date", end);
  if (clientId) query = query.eq("client_id", clientId);
  if (billedParam !== null) query = query.eq("billed", billedParam === "true");
  if (billableParam !== null) query = query.eq("billable", billableParam === "true");

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Invoice builder mode: return raw entries (not FullCalendar format)
  if (invoiceMode) {
    return NextResponse.json(
      (data ?? []).map((entry) => ({
        id: entry.id,
        description: entry.description,
        entry_date: entry.entry_date,
        duration_hours: Number(entry.duration_hours),
        billable: entry.billable,
        billed: entry.billed,
        hourly_rate: entry.hourly_rate != null ? Number(entry.hourly_rate) : null,
        client_id: entry.client_id,
        task_id: entry.task_id,
        clients: entry.clients,
        tasks: entry.tasks,
      }))
    );
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
