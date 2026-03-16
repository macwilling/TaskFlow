import Link from "next/link";
import { Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function UpcomingSection() {
  const supabase = await createClient();

  const sevenDaysOut = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const [{ data: dueTasks }, { data: unbilledEntries }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, task_number, title, status, due_date, clients(name, color)")
      .neq("status", "closed")
      .gte("due_date", today)
      .lte("due_date", sevenDaysOut)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("time_entries")
      .select("duration_hours, hourly_rate, clients(id, name, color)")
      .eq("billable", true)
      .eq("billed", false),
  ]);

  // Group unbilled by client
  type ClientSummary = {
    id: string;
    name: string;
    color: string;
    hours: number;
    value: number;
  };
  const clientMap = new Map<string, ClientSummary>();
  for (const entry of unbilledEntries ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (entry.clients as any) as { id: string; name: string; color: string } | null;
    if (!client) continue;
    const existing = clientMap.get(client.id) ?? {
      id: client.id,
      name: client.name,
      color: client.color,
      hours: 0,
      value: 0,
    };
    existing.hours += entry.duration_hours ?? 0;
    existing.value += (entry.duration_hours ?? 0) * (entry.hourly_rate ?? 0);
    clientMap.set(client.id, existing);
  }
  const unbilledByClient = Array.from(clientMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const hasDueTasks = (dueTasks?.length ?? 0) > 0;
  const hasUnbilled = unbilledByClient.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">This week</h2>
      </div>

      {/* Tasks due this week */}
      {hasDueTasks ? (
        <div className="divide-y divide-border">
          {(dueTasks ?? []).map((task) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = (task.clients as any) as { name: string; color: string } | null;
            return (
              <Link
                key={task.id}
                href={`/app/tasks/${task.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {client?.color && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: client.color }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="text-muted-foreground mr-1">
                        #{task.task_number}
                      </span>
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {client?.name ?? ""} ·{" "}
                      {task.due_date ? formatDate(task.due_date) : ""}
                    </p>
                  </div>
                </div>
                <TaskStatusBadge status={task.status} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-4 text-sm text-muted-foreground">
          No tasks due this week
        </div>
      )}

      {/* Unbilled time by client */}
      {hasUnbilled && (
        <>
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Unbilled time by client
            </p>
          </div>
          <div className="divide-y divide-border">
            {unbilledByClient.map((c) => (
              <Link
                key={c.id}
                href={`/app/clients/${c.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="truncate text-sm">{c.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {formatCurrency(c.value)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.hours.toFixed(1)}h
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {!hasDueTasks && !hasUnbilled && (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing due this week and no unbilled time
          </p>
        </div>
      )}
    </div>
  );
}

export function UpcomingSectionSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
