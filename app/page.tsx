import Link from "next/link";
import { Zap, Clock, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" strokeWidth={2.5} />
          <span className="text-sm font-semibold">BillableDesk</span>
        </div>
        <Link
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              Billing and task management<br />for independent consultants.
            </h1>
            <p className="text-base text-muted-foreground">
              Track time, manage clients, send invoices — everything in one place.
              Your workspace lives at{" "}
              <span className="font-mono text-sm text-foreground">
                you.billabledesk.com
              </span>
              .
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button asChild size="lg" className="w-full max-w-xs">
              <Link href="/auth/register">Get started free</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-foreground hover:underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3 text-left text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Time tracking with a calendar view — log hours by client and task.</span>
            </li>
            <li className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>One-click invoicing — generate PDF invoices from your tracked time.</span>
            </li>
            <li className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Client portal — clients can view tasks, leave comments, and download invoices.</span>
            </li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} BillableDesk
      </footer>
    </div>
  );
}
