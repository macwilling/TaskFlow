import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function PortalUsersTable() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("client_portal_access")
    .select("client_id, accepted_at, invited_at, last_seen_at, user_id")
    .order("invited_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load portal users: {error.message}
      </p>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium">No portal users yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Grant portal access from a client&apos;s detail page.
        </p>
      </div>
    );
  }

  // Fetch client names + emails in bulk
  const clientIds = rows.map((r) => r.client_id);
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, color")
    .in("id", clientIds);
  const clientMap = new Map(
    (clients ?? []).map((c) => [c.id, c])
  );

  // Fetch auth emails for accepted users (user_id is set)
  const userIds = rows
    .map((r) => r.user_id as string | null)
    .filter((id): id is string => !!id);

  const admin = createAdminClient();
  const portalEmailMap = new Map<string, string>();
  await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data?.user?.email) portalEmailMap.set(uid, data.user.email);
    })
  );

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Client
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Portal email
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Invited
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
              First login
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Last seen
            </th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const client = clientMap.get(row.client_id);
            const portalEmail = row.user_id
              ? (portalEmailMap.get(row.user_id as string) ?? null)
              : null;
            const accepted = !!(row.accepted_at);

            return (
              <tr
                key={row.client_id}
                className="group hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/clients/${row.client_id}`}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: client?.color ?? "#0969da",
                      }}
                    />
                    <span className="font-medium text-foreground hover:underline">
                      {client?.name ?? "Unknown"}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {portalEmail ?? client?.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {accepted ? (
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs text-emerald-600 border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs text-amber-600 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                    >
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatDate((row as { invited_at?: string | null }).invited_at ?? null) ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatDate(row.accepted_at) ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatDate((row as { last_seen_at?: string | null }).last_seen_at ?? null) ?? "Never"}
                </td>
                <td className="pr-3">
                  <Link href={`/clients/${row.client_id}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PortalUsersPage() {
  return (
    <>
      <TopBar title="Portal Users" description="Clients with access to the client portal" />
      <PageContainer>
        <PortalUsersTable />
      </PageContainer>
    </>
  );
}
