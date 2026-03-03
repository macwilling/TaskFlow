"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TaskViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "list";

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`/tasks?${params.toString()}`);
  }

  return (
    <div className="flex items-center rounded-md border border-border">
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 rounded-r-none px-2 ${view === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
        onClick={() => setView("list")}
        title="List view"
      >
        <LayoutList className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 rounded-l-none border-l border-border px-2 ${view === "board" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
        onClick={() => setView("board")}
        title="Board view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
