import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Separator } from "@/components/ui/separator";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { ReportsFilterForm } from "./ReportsFilterForm";

interface SearchParams {
  start?: string;
  end?: string;
}

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtHours(hours: number) {
  return `${hours.toFixed(2)} h`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [user, supabase] = await Promise.all([getCachedUser(), createClient()]);
  if (!user || user.app_metadata?.role !== "admin") redirect("/auth/login");

  const sp = await searchParams;

  // Default date range: current calendar year
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-01-01`;
  const defaultEnd = `${now.getFullYear()}-12-31`;
  const start = sp.start || defaultStart;
  const end = sp.end || defaultEnd;

  // Fetch all data in parallel
  const [
    { data: clients },
    { data: timeEntries },
    { data: invoices },
    { data: payments },
    { data: unbilledEntries },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, color").eq("archived", false),
    supabase
      .from("time_entries")
      .select("client_id, duration_hours, billable, entry_date")
      .gte("entry_date", start)
      .lte("entry_date", end),
    supabase
      .from("invoices")
      .select("id, client_id, total, status, issue_date")
      .gte("issue_date", start)
      .lte("issue_date", end)
      .neq("status", "draft"),
    supabase
      .from("payments")
      .select("invoice_id, amount, payment_date")
      .gte("payment_date", start)
      .lte("payment_date", end),
    supabase
      .from("time_entries")
      .select("client_id, duration_hours, hourly_rate")
      .eq("billable", true)
      .eq("billed", false)
      .is("invoice_id", null),
  ]);

  // Build lookup maps
  const clientMap = new Map(
    (clients ?? []).map((c) => [c.id, { name: c.name, color: c.color }])
  );

  // Paid invoice IDs set (for cross-referencing payments)
  const invoiceMap = new Map((invoices ?? []).map((i) => [i.id, i]));

  // Revenue by client
  type ClientRow = {
    name: string;
    color: string;
    totalHours: number;
    billableHours: number;
    invoicedAmount: number;
    paidAmount: number;
  };
  const clientStats = new Map<string, ClientRow>();

  for (const c of clients ?? []) {
    clientStats.set(c.id, {
      name: c.name,
      color: c.color ?? "#0969da",
      totalHours: 0,
      billableHours: 0,
      invoicedAmount: 0,
      paidAmount: 0,
    });
  }

  for (const te of timeEntries ?? []) {
    const row = clientStats.get(te.client_id);
    if (!row) continue;
    row.totalHours += Number(te.duration_hours ?? 0);
    if (te.billable) row.billableHours += Number(te.duration_hours ?? 0);
  }

  for (const inv of invoices ?? []) {
    const row = clientStats.get(inv.client_id);
    if (!row) continue;
    row.invoicedAmount += Number(inv.total ?? 0);
  }

  for (const p of payments ?? []) {
    const inv = invoiceMap.get(p.invoice_id);
    if (!inv) continue;
    const row = clientStats.get(inv.client_id);
    if (!row) continue;
    row.paidAmount += Number(p.amount ?? 0);
  }

  const clientRows = [...clientStats.values()].filter(
    (r) => r.totalHours > 0 || r.invoicedAmount > 0
  );
  clientRows.sort((a, b) => b.invoicedAmount - a.invoicedAmount);

  // Revenue by month
  type MonthRow = { month: string; hours: number; invoiced: number; paid: number };
  const monthMap = new Map<string, MonthRow>();

  for (const te of timeEntries ?? []) {
    const month = te.entry_date.slice(0, 7); // "YYYY-MM"
    if (!monthMap.has(month)) monthMap.set(month, { month, hours: 0, invoiced: 0, paid: 0 });
    monthMap.get(month)!.hours += Number(te.duration_hours ?? 0);
  }

  for (const inv of invoices ?? []) {
    const month = inv.issue_date.slice(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, { month, hours: 0, invoiced: 0, paid: 0 });
    monthMap.get(month)!.invoiced += Number(inv.total ?? 0);
  }

  for (const p of payments ?? []) {
    const month = p.payment_date.slice(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, { month, hours: 0, invoiced: 0, paid: 0 });
    monthMap.get(month)!.paid += Number(p.amount ?? 0);
  }

  const monthRows = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  // Unbilled hours by client
  type UnbilledRow = { clientId: string; name: string; color: string; hours: number; estimated: number };
  const unbilledMap = new Map<string, UnbilledRow>();

  for (const te of unbilledEntries ?? []) {
    const client = clientMap.get(te.client_id);
    if (!unbilledMap.has(te.client_id)) {
      unbilledMap.set(te.client_id, {
        clientId: te.client_id,
        name: client?.name ?? "Unknown",
        color: client?.color ?? "#0969da",
        hours: 0,
        estimated: 0,
      });
    }
    const row = unbilledMap.get(te.client_id)!;
    const h = Number(te.duration_hours ?? 0);
    row.hours += h;
    row.estimated += h * Number(te.hourly_rate ?? 0);
  }

  const unbilledRows = [...unbilledMap.values()].filter((r) => r.hours > 0);
  unbilledRows.sort((a, b) => b.hours - a.hours);

  const totalUnbilledHours = unbilledRows.reduce((s, r) => s + r.hours, 0);
  const totalUnbilledEstimated = unbilledRows.reduce((s, r) => s + r.estimated, 0);

  return (
    <>
      <TopBar title="Reports" description="Revenue and time tracking summary." />
      <PageContainer>
        <div className="space-y-10">

          {/* Date range filter */}
          <ReportsFilterForm defaultStart={start} defaultEnd={end} />

          <Separator />

          {/* Revenue by client */}
          <section>
            <h2 className="text-base font-semibold mb-4">Revenue by client</h2>
            {clientRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-2.5">Client</th>
                      <th className="px-4 py-2.5 text-right">Total hours</th>
                      <th className="px-4 py-2.5 text-right">Billable hours</th>
                      <th className="px-4 py-2.5 text-right">Invoiced</th>
                      <th className="px-4 py-2.5 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {clientRows.map((row) => (
                      <tr key={row.name} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.name}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmtHours(row.totalHours)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmtHours(row.billableHours)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {fmt(row.invoicedAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-green-700 dark:text-green-400">
                          {fmt(row.paidAmount)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals */}
                    <tr className="bg-muted/40 font-medium">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">Total</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {fmtHours(clientRows.reduce((s, r) => s + r.totalHours, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {fmtHours(clientRows.reduce((s, r) => s + r.billableHours, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {fmt(clientRows.reduce((s, r) => s + r.invoicedAmount, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-green-700 dark:text-green-400">
                        {fmt(clientRows.reduce((s, r) => s + r.paidAmount, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <Separator />

          {/* Revenue by month */}
          <section>
            <h2 className="text-base font-semibold mb-4">Revenue by month</h2>
            {monthRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-2.5">Month</th>
                      <th className="px-4 py-2.5 text-right">Hours logged</th>
                      <th className="px-4 py-2.5 text-right">Invoiced</th>
                      <th className="px-4 py-2.5 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthRows.map((row) => (
                      <tr key={row.month} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium tabular-nums">
                          {new Date(row.month + "-15").toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmtHours(row.hours)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(row.invoiced)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-green-700 dark:text-green-400">
                          {fmt(row.paid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <Separator />

          {/* Unbilled hours */}
          <section>
            <h2 className="text-base font-semibold mb-1">Unbilled hours</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Billable time entries not yet included in an invoice — across all dates.
            </p>
            {unbilledRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unbilled hours.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-2.5">Client</th>
                      <th className="px-4 py-2.5 text-right">Unbilled hours</th>
                      <th className="px-4 py-2.5 text-right">Estimated value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unbilledRows.map((row) => (
                      <tr key={row.clientId} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.name}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {fmtHours(row.hours)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {row.estimated > 0 ? fmt(row.estimated) : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-medium">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">Total</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {fmtHours(totalUnbilledHours)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                        {totalUnbilledEstimated > 0 ? fmt(totalUnbilledEstimated) : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </PageContainer>
    </>
  );
}
