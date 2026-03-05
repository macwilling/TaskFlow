"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarShellProps {
  sidebar: React.ReactNode;
  userMenu: React.ReactNode;
  children: React.ReactNode;
}

export function SidebarShell({ sidebar, userMenu, children }: SidebarShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-background transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {sidebar}
        {userMenu}
      </aside>

      {/* Mobile hamburger button — sits in the top bar area */}
      <button
        className="fixed left-4 top-3.5 z-40 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? (
          <X className="h-5 w-5" strokeWidth={1.75} />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        )}
      </button>

      {/* Main content */}
      <div className="flex flex-1 flex-col pl-0 md:pl-56">{children}</div>
    </div>
  );
}
