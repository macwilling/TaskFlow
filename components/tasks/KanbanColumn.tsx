"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { SortableTaskCard, type Task } from "./TaskCard";

interface Column {
  id: string;
  label: string;
}

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
}

export function KanbanColumn({ column, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {column.label}
        </span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>

      <SortableContext
        id={column.id}
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 rounded-md p-2 space-y-2 min-h-[200px] transition-colors duration-150",
            isOver ? "bg-primary/5 ring-1 ring-primary/25" : "bg-muted/30"
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
