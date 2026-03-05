import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClientSearch } from "@/components/clients/ClientSearch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight } from "lucide-react";

interface SearchParams {
  q?: string;
  archived?: string;
}

async function ClientTable({ q, archived }: { q?: string; archived?: string }) {
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, name, company, email, default_rate, payment_terms, currency, color, is_archived")
    .order("name");

  if (q) {
    query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);
  }

  query = query.eq("is_archived", archived === "1");

  const { data: clients, error } = await query;

  if (error) {
    return (
      <p className="text-sm text-destructive">Failed to load clients: {error.message}</p>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium">
          {q ? "No clients match your search." : archived === "1" ? "No archived clients." : "No clients yet."}
        </p>
        {!q && archived !== "1" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first client to get started.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Client</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Rate</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Terms</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {clients.map((client) => (
            <tr
              key={client.id}
              className="group hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <Link href={`/clients/${client.id}`} className="flex items-center gap-2.5">
                  {/* Color swatch */}
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: client.color ?? "#0969da" }}
                  />
                  <span>
                    <span className="font-medium text-foreground hover:underline">
                      {client.name}
                    </span>
                    {client.company && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {client.company}
                      </span>
                    )}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {client.email ?? "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {client.default_rate != null
                  ? `${client.currency ?? "USD"} ${Number(client.default_rate).toFixed(2)}/hr`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {client.payment_terms ? `Net ${client.payment_terms}` : "—"}
              </td>
              <td className="px-4 py-3">
                {client.is_archived ? (
                  <Badge variant="secondary" className="text-xs">Archived</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
                    Active
                  </Badge>
                )}
              </td>
              <td className="pr-3">
                <Link href={`/clients/${client.id}`}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, archived } = await searchParams;

  return (
    <>
      <TopBar
        title="Clients"
        actions={
          <Button asChild size="sm" className="h-7 gap-1 text-xs">
            <Link href="/clients/new">
              <Plus className="h-3.5 w-3.5" />
              New client
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="space-y-4">
          <Suspense fallback={null}>
            <ClientSearch />
          </Suspense>
          <Suspense
            fallback={
              <div className="h-32 rounded-md border border-border animate-pulse bg-muted/20" />
            }
          >
            <ClientTable q={q} archived={archived} />
          </Suspense>
        </div>
      </PageContainer>
    </>
  );
}
