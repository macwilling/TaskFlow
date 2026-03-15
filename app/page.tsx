import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Zap, Clock, FileText, Users, ArrowLeft, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";

import { ThemeToggle } from "@/components/landing/ThemeToggle";

// ─── Sub-pages ────────────────────────────────────────────────────────────────

function MarketingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background overflow-hidden">
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.6,
        }}
      />
      {/* Top radial glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, hsl(var(--primary) / 0.13), transparent)",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-border/50 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight">BillableDesk</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/auth/login"
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          For independent consultants
        </div>

        {/* Headline */}
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight leading-[1.1] sm:text-5xl lg:text-6xl">
          Run your{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)), hsl(200 80% 65%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            consulting business.
          </span>
          <br />
          <span className="text-muted-foreground/70">Not your billing admin.</span>
        </h1>

        {/* Subtext */}
        <p className="mt-6 max-w-lg text-base text-muted-foreground leading-relaxed">
          Time tracking, invoicing, and client portals — all in one place. Your
          workspace lives at{" "}
          <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-foreground">
            <Lock className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
            you.billabledesk.com
          </span>
          .
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-w-[160px] shadow-lg shadow-primary/20">
            <Link href="/auth/register">Get started free</Link>
          </Button>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Already have an account
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              Icon: Clock,
              title: "Time tracking",
              desc: "Log hours by client and task with a calendar view. Export to invoice in one click.",
              color: "text-blue-400",
            },
            {
              Icon: FileText,
              title: "PDF invoices",
              desc: "Generate professional invoices from tracked time. Send, track status, and download.",
              color: "text-emerald-400",
            },
            {
              Icon: Users,
              title: "Client portal",
              desc: "Clients get their own workspace to view tasks, leave comments, and download invoices.",
              color: "text-violet-400",
            },
          ].map(({ Icon, title, desc, color }) => (
            <div
              key={title}
              className="rounded-xl border border-border/60 bg-card/40 p-5 text-left backdrop-blur-sm transition-all hover:border-border hover:bg-card/70"
            >
              <Icon className={`mb-3 h-5 w-5 ${color}`} />
              <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
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
