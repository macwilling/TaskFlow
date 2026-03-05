"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface UserMenuProps {
  email: string;
  name?: string;
}

export function UserMenu({ email, name }: UserMenuProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div className="border-t border-border p-3">
      <div className="mb-2 px-1">
        {name && (
          <p className="truncate text-xs font-medium text-foreground">{name}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <ThemeToggle />
      <button
        onClick={handleSignOut}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
      >
        <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        Sign out
      </button>
    </div>
  );
}
