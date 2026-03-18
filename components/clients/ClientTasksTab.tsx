"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/tasks/TaskStatusBadge";
import { Search } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  task_number: number | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ClientTasksTab({
  tasks,
  clientId,
  clientKey,
}: {
  tasks: Task[];
  clientId: string;
  clientKey: string | null;
}) {
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (!showClosed && t.status === "closed") return false;
      if (query) return t.title.toLowerCase().includes(query.toLowerCase());
      return true;
    });
  }, [tasks, query, showClosed]);

  const closedCount = tasks.filter((t) => t.status === "closed").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        {closedCount > 0 && (
          <Button
            size="sm"
            variant={showClosed ? "secondary" : "ghost"}
            className="h-8 text-xs"
            onClick={() => setShowClosed((v) => !v)}
          >
            {showClosed ? `Hide closed (${closedCount})` : `Show closed (${closedCount})`}
          </Button>
        )}
        <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs ml-auto">
          <Link href={`/app/tasks/new?clientId=${clientId}`}>New task</Link>
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query ? (
            "No tasks match your search."
          ) : (
            <>
              No active tasks.{" "}
              <Link
                href={`/app/tasks/new?clientId=${clientId}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                Create one →
              </Link>
            </>
          )}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {filtered.map((task) => {
            const href =
              clientKey && task.task_number != null
                ? `/app/tasks/${clientKey}-${task.task_number}`
                : `/app/tasks/${task.id}`;
            return (
              <Link
                key={task.id}
                href={href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-sm"
              >
                <span className="flex-1 font-medium text-foreground truncate">{task.title}</span>
                {task.priority && <TaskPriorityBadge priority={task.priority} />}
                {task.status && <TaskStatusBadge status={task.status} />}
                <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                  {task.due_date ? formatDate(task.due_date) : "No due date"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
