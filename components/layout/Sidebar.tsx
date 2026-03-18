"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Clock,
  FileText,
  BarChart2,
  SlidersHorizontal,
  Zap,
  Mail,
  Globe,
  ChevronRight,
  Building2,
  Palette,
  Receipt,
  AtSign,
  TrendingUp,
  CreditCard,
  UserCog,
  Server,
  Bell,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Nav config ───────────────────────────────────────────────────────────────

type NavItem = {
  kind: "item";
  href: string;
  label: string;
  icon: React.ElementType;
};

type NavGroup = {
  kind: "group";
  label: string;
  icon: React.ElementType;
  basePath: string;
  children: { href: string; label: string; icon: React.ElementType }[];
};

const navConfig: (NavItem | NavGroup)[] = [
  { kind: "item", href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { kind: "item", href: "/app/clients", label: "Clients", icon: Users },
  { kind: "item", href: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { kind: "item", href: "/app/time", label: "Time", icon: Clock },
  {
    kind: "group",
    label: "Finance",
    icon: TrendingUp,
    basePath: "/app/finance",
    children: [
      { href: "/app/finance/invoices",  label: "Invoices",  icon: FileText },
      { href: "/app/finance/reports",   label: "Reports",   icon: BarChart2 },
      { href: "/app/finance/payments",  label: "Payments",  icon: CreditCard },
    ],
  },
  {
    kind: "group",
    label: "Administration",
    icon: SlidersHorizontal,
    basePath: "/app/administration",
    children: [
      { href: "/app/administration/portal-users",    label: "Portal Users",     icon: Globe },
      { href: "/app/administration/team",            label: "Team",             icon: UserCog },
      { href: "/app/administration/general",         label: "General",          icon: Building2 },
      { href: "/app/administration/task-statuses",   label: "Task Statuses",    icon: Layers },
      { href: "/app/administration/branding",        label: "Branding",         icon: Palette },
      { href: "/app/administration/invoices",        label: "Invoice settings", icon: Receipt },
      { href: "/app/administration/emails",          label: "Emails",           icon: AtSign },
      { href: "/app/administration/smtp",            label: "Custom SMTP",      icon: Server },
      { href: "/app/administration/notifications",   label: "Notifications",    icon: Bell },
      { href: "/app/administration/email-log",       label: "Email Log",        icon: Mail },
    ],
  },
];

// ─── NavGroupItem ─────────────────────────────────────────────────────────────

function NavGroupItem({
  group,
  pathname,
  pendingHref,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  pendingHref: string | null;
  onNavigate: (href: string) => void;
}) {
  const check = pendingHref ?? pathname;
  const isActive = check === group.basePath || check.startsWith(group.basePath + "/");
  const [open, setOpen] = useState(isActive);

  // Auto-open when navigating into this group
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          isActive
            ? "text-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <group.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
            open && "rotate-90"
          )}
          strokeWidth={2}
        />
      </button>

      {/* Animated children — CSS grid-rows trick, no extra dependency */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2.5 pb-1">
            {group.children.map(({ href, label, icon: Icon }) => {
              const childActive =
                (pendingHref ?? pathname) === href ||
                (pendingHref ?? pathname).startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={true}
                  onClick={() => onNavigate(href)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                    childActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function isActive(href: string) {
    const check = pendingHref ?? pathname;
    return check === href || check.startsWith(href + "/");
  }

  return (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Zap className="h-5 w-5 text-primary" strokeWidth={2.5} />
        <span className="text-sm font-semibold tracking-tight">BillableDesk</span>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {navConfig.map((entry) => {
          if (entry.kind === "group") {
            return (
              <NavGroupItem
                key={entry.basePath}
                group={entry}
                pathname={pathname}
                pendingHref={pendingHref}
                onNavigate={setPendingHref}
              />
            );
          }
          const active = isActive(entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              prefetch={true}
              onClick={() => setPendingHref(entry.href)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <entry.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {entry.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
