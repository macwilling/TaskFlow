import { DollarSign, FileText, Clock, CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "./StatCard";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`;
}

export async function StatsSectionAsync() {
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = now.toISOString().split("T")[0];

  const [
    { data: payments },
    { data: outstandingInvoices },
    { data: unbilledEntries },
    { data: openTasks },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .gte("payment_date", monthStart),
    supabase
      .from("invoices")
      .select("total, due_date")
      .in("status", ["sent", "viewed"]),
    supabase
      .from("time_entries")
      .select("duration_hours, hourly_rate")
      .eq("billable", true)
      .eq("billed", false),
    supabase
      .from("tasks")
      .select("status")
      .in("status", ["backlog", "in_progress", "in_review"]),
  ]);

  // Revenue this month
  const revenueThisMonth = (payments ?? []).reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0
  );

  // Outstanding AR
  const allOutstanding = outstandingInvoices ?? [];
  const overdueCount = allOutstanding.filter(
    (inv) => inv.due_date && inv.due_date < today
  ).length;
  const outstandingTotal = allOutstanding.reduce(
    (sum, inv) => sum + (inv.total ?? 0),
    0
  );

  // Unbilled value
  const unbilledValue = (unbilledEntries ?? []).reduce(
    (sum, e) => sum + (e.duration_hours ?? 0) * (e.hourly_rate ?? 0),
    0
  );
  const unbilledHours = (unbilledEntries ?? []).reduce(
    (sum, e) => sum + (e.duration_hours ?? 0),
    0
  );

  // Open tasks
  const tasks = openTasks ?? [];
  const inReviewCount = tasks.filter((t) => t.status === "in_review").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  return (
    <>
      <StatCard
        label="Revenue this month"
        value={formatCurrency(revenueThisMonth)}
        subLabel={revenueThisMonth === 0 ? "No payments recorded yet" : "Sum of payments received"}
        icon={DollarSign}
        href="/app/invoices?status=paid"
      />
      <StatCard
        label="Outstanding AR"
        value={formatCurrency(outstandingTotal)}
        subLabel={
          overdueCount > 0
            ? `${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""}`
            : allOutstanding.length === 0
            ? "No outstanding invoices"
            : `${allOutstanding.length} invoice${allOutstanding.length !== 1 ? "s" : ""} sent`
        }
        icon={FileText}
        href="/app/invoices"
        variant={overdueCount > 0 ? "destructive" : "default"}
      />
      <StatCard
        label="Unbilled value"
        value={formatCurrency(unbilledValue)}
        subLabel={unbilledHours > 0 ? `${formatHours(unbilledHours)} unbilled` : "All time billed"}
        icon={Clock}
        href="/app/time"
        variant={unbilledValue > 0 ? "warning" : "default"}
      />
      <StatCard
        label="Open tasks"
        value={String(tasks.length)}
        subLabel={
          tasks.length === 0
            ? "No open tasks"
            : `${inProgressCount} in progress · ${inReviewCount} in review`
        }
        icon={CheckSquare}
        href="/app/tasks"
      />
    </>
  );
}
