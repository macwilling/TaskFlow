import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";

const EMAIL_TYPES = [
  {
    label: "Task closed",
    description: "Sent to the client when a task is marked as closed.",
  },
  {
    label: "Invoice sent",
    description: "Sent to the client when an invoice is marked as sent.",
  },
  {
    label: "New comment",
    description: "Sent to the admin when a client posts a portal comment.",
  },
] as const;

export default function NotificationsPage() {
  return (
    <>
      <TopBar title="Notifications" description="Email notifications sent by BillableDesk" />
      <PageContainer>
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-muted-foreground">
            The following email notifications are currently active. Per-type toggle controls are coming soon.
          </p>

          <div className="divide-y divide-border rounded-md border border-border">
            {EMAIL_TYPES.map(({ label, description }) => (
              <div key={label} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  Active
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Customize email content in{" "}
            <a href="/app/administration/emails" className="underline underline-offset-2">
              Emails
            </a>
            .
          </p>
        </div>
      </PageContainer>
    </>
  );
}
