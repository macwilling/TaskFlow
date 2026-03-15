import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Zap, Clock, FileText, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";

// ─── Sub-pages ────────────────────────────────────────────────────────────────

function MarketingPage() {
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

function WorkspaceAvailablePage({
  slug,
  baseDomain,
}: {
  slug: string;
  baseDomain: string;
}) {
  const claimUrl = `https://${baseDomain}/auth/register?slug=${slug}`;
  const homeUrl = `https://${baseDomain}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" strokeWidth={2.5} />
          <span className="text-sm font-semibold">BillableDesk</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="w-full max-w-md space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
            Available
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="font-mono">{slug}.billabledesk.com</span>{" "}
              is available
            </h1>
            <p className="text-sm text-muted-foreground">
              This workspace hasn&apos;t been claimed yet. Be the first.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Button asChild size="lg" className="w-full max-w-xs">
              <a href={claimUrl}>Claim this workspace</a>
            </Button>
            <a
              href={homeUrl}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to BillableDesk
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} BillableDesk
      </footer>
    </div>
  );
}

function WorkspaceLandingPage({
  businessName,
  baseDomain,
}: {
  businessName: string;
  baseDomain: string;
}) {
  const adminLoginUrl = `https://${baseDomain}/auth/login`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border px-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" strokeWidth={2.5} />
          <span className="text-sm font-semibold">{businessName}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome to {businessName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Log in to access your client workspace.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link href="/portal/login">Log in to your portal</Link>
          </Button>
          <a
            href={adminLoginUrl}
            className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Are you the workspace admin? Sign in at billabledesk.com →
          </a>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <a
          href={`https://${baseDomain}`}
          className="hover:text-foreground transition-colors"
        >
          BillableDesk
        </a>
      </footer>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RootPage() {
  const requestHeaders = await headers();
  const tenantSlug = requestHeaders.get("x-tenant-slug") ?? "";
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";

  // Root domain (or local dev with no subdomain) → marketing page
  if (!tenantSlug) {
    return <MarketingPage />;
  }

  // Reserved slug — local dev fallback (middleware handles this in prod)
  if ((RESERVED_SLUGS as readonly string[]).includes(tenantSlug)) {
    return <MarketingPage />;
  }

  // Tenant lookup
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (!tenant) {
    return <WorkspaceAvailablePage slug={tenantSlug} baseDomain={baseDomain} />;
  }

  // Tenant exists — check auth state
  const user = await getCachedUser();

  if (user) {
    if (
      user.app_metadata?.role === "admin" &&
      user.app_metadata?.tenant_id === tenant.id
    ) {
      redirect("/app/dashboard");
    }
    if (
      user.app_metadata?.role === "client" &&
      user.app_metadata?.tenant_id === tenant.id
    ) {
      redirect("/portal");
    }
  }

  // Unauthenticated or wrong tenant — show workspace landing
  const { data: settings } = await admin
    .from("tenant_settings")
    .select("business_name")
    .eq("tenant_id", tenant.id)
    .single();

  const businessName = settings?.business_name ?? tenantSlug;

  return (
    <WorkspaceLandingPage businessName={businessName} baseDomain={baseDomain} />
  );
}
