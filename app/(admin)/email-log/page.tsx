import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  task_closed: "Task closed",
  invoice: "Invoice",
  comment: "Comment",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  failed: "destructive",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EmailLogPage() {
  const supabase = await createClient();

  const { data: logs, error } = await supabase
    .from("email_log")
    .select("id, created_at, type, to_email, subject, status, resend_id, error_message")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <TopBar title="Email Log" description="Last 200 sent emails" />
      <PageContainer>
        {error ? (
          <p className="text-sm text-destructive">Failed to load email log: {error.message}</p>
        ) : !logs?.length ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium">No emails sent yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Emails are logged when tasks are closed, invoices are sent, and portal comments are posted.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Sent at</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">To</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Subject</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {TYPE_LABELS[log.type] ?? log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate text-muted-foreground">
                      {log.to_email}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[280px] truncate">
                      {log.subject}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={STATUS_VARIANTS[log.status] ?? "secondary"}
                        className="text-xs capitalize"
                      >
                        {log.status}
                      </Badge>
                      {log.status === "failed" && log.error_message && (
                        <p className="mt-0.5 text-xs text-destructive truncate max-w-[200px]" title={log.error_message}>
                          {log.error_message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    </>
  );
}
