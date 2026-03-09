"use client";

import { LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskViewToggleProps {
  view: string;
  onViewChange: (view: string) => void;
}

export function TaskViewToggle({ view, onViewChange }: TaskViewToggleProps) {
  return (
    <div className="flex items-center rounded-md border border-border">
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 rounded-r-none px-2 ${view === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
        onClick={() => onViewChange("list")}
        title="List view"
      >
        <LayoutList className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 rounded-l-none border-l border-border px-2 ${view === "board" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
        onClick={() => onViewChange("board")}
        title="Board view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
