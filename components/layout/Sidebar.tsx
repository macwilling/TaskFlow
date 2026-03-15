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
  Settings,
  Zap,
  Mail,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/clients", label: "Clients", icon: Users },
  { href: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/app/time", label: "Time", icon: Clock },
  { href: "/app/invoices", label: "Invoices", icon: FileText },
  { href: "/app/portal-users", label: "Portal Users", icon: Globe },
  { href: "/app/reports", label: "Reports", icon: BarChart2 },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/email-log", label: "Email Log", icon: Mail },
];

export function Sidebar() {
  const pathname = usePathname();
  // Optimistic active href — set immediately on click, cleared when pathname updates
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
        <span className="text-sm font-semibold tracking-tight">TaskFlow</span>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              onClick={() => setPendingHref(href)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
