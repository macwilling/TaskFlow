"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app/settings/general", label: "General" },
  { href: "/app/settings/branding", label: "Branding" },
  { href: "/app/settings/invoices", label: "Invoices" },
  { href: "/app/settings/emails", label: "Emails" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-40 shrink-0 border-r border-border py-4 px-2">
      {items.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
