import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TaskPriorityBadge } from "@/components/tasks/TaskStatusBadge";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function daysOverdue(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

export async function AttentionSection() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: overdueInvoices }, { data: reviewTasks }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, total, due_date, clients(name, color)")
      .in("status", ["sent", "viewed"])
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5),
    supabase
      .from("tasks")
      .select("id, task_number, title, priority, due_date, clients(name, color, client_key)")
      .eq("status", "in_review")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
  ]);

  const hasAnything =
    (overdueInvoices?.length ?? 0) > 0 || (reviewTasks?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-semibold">Needs attention</h2>
      </div>

      {!hasAnything ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/70" />
          <p className="text-sm font-medium">All clear</p>
          <p className="text-xs text-muted-foreground">
            No overdue invoices or tasks awaiting review
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {/* Overdue invoices */}
          {(overdueInvoices ?? []).map((inv) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = (inv.clients as any) as { name: string; color: string } | null;
            const days = inv.due_date ? daysOverdue(inv.due_date) : 0;
            return (
              <Link
                key={inv.id}
                href={`/app/finance/invoices/${inv.id}`}
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
                    <p className="truncate text-sm font-medium">
                      {client?.name ?? "Unknown client"}{" "}
                      <span className="text-muted-foreground font-normal">
                        #{inv.invoice_number}
                      </span>
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {days === 0
                        ? "Due today"
                        : `${days} day${days !== 1 ? "s" : ""} overdue`}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-red-700 dark:text-red-400">
                  {formatCurrency(inv.total ?? 0)}
                </span>
              </Link>
            );
          })}

          {/* Tasks in review */}
          {(reviewTasks ?? []).map((task) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = (task.clients as any) as { name: string; color: string } | null;
            return (
              <Link
                key={task.id}
                href={`/app/tasks/${(task.clients as any)?.client_key}-${task.task_number}`}
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
                      {client?.name ?? ""} · In Review
                    </p>
                  </div>
                </div>
                {task.priority && (
                  <TaskPriorityBadge priority={task.priority} />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AttentionSectionSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
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
