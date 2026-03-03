"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQ = searchParams.get("q") ?? "";
  const showArchived = searchParams.get("archived") === "1";

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value || null });
    }, 300);
  }

  function toggleArchived() {
    pushParams({ archived: showArchived ? null : "1" });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients…"
          defaultValue={currentQ}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-8 w-56 h-8 text-sm"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleArchived}
        className={cn(
          "h-8 gap-1.5 text-xs",
          showArchived && "bg-accent text-accent-foreground"
        )}
      >
        <Archive className="h-3.5 w-3.5" />
        {showArchived ? "Showing archived" : "Archived"}
      </Button>
    </div>
  );
}
