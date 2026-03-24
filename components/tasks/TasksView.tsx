"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TaskStatus } from "@/app/actions/task-statuses";
import { TaskListView } from "./TaskListView";
import { TaskBoardView } from "./TaskBoardView";
import { TaskFilters } from "./TaskFilters";
import { TaskViewToggle } from "./TaskViewToggle";
import type { Task } from "./TaskCard";

function syncUrl(status: string, q: string, view: string, client: string, priority: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (view !== "list") params.set("view", view);
  if (client) params.set("client", client);
  if (priority) params.set("priority", priority);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `/app/tasks?${qs}` : "/app/tasks");
}

export function TasksView({
  tasks,
  statuses,
}: {
  tasks: Task[];
  statuses: TaskStatus[];
}) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [view, setView] = useState(searchParams.get("view") ?? "list");
  const [client, setClient] = useState(searchParams.get("client") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "");

  function handleStatusChange(s: string) {
    setStatus(s);
    syncUrl(s, q, view, client, priority);
  }

  function handleQChange(newQ: string) {
    setQ(newQ);
    syncUrl(status, newQ, view, client, priority);
  }

  function handleViewChange(v: string) {
    setView(v);
    syncUrl(status, q, v, client, priority);
  }

  function handleClientChange(c: string) {
    setClient(c);
    syncUrl(status, q, view, c, priority);
  }

  function handlePriorityChange(p: string) {
    setPriority(p);
    syncUrl(status, q, view, client, p);
  }

  const clients = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string; color: string | null }[] = [];
    for (const t of tasks) {
      if (t.client_id && t.clients && !seen.has(t.client_id)) {
        seen.add(t.client_id);
        result.push({ id: t.client_id, name: t.clients.name, color: t.clients.color });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filtered = tasks.filter((t) => {
    if (status && t.status_id !== status) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (client && t.client_id !== client) return false;
    if (priority && t.priority !== priority) return false;
    return true;
  });

  return (
    <div>
      {/* Sticky secondary toolbar — full-bleed to cancel PageContainer's p-6 */}
      <div className="sticky top-16 z-10 -mx-6 flex h-12 items-center justify-between gap-3 border-b border-border bg-background px-6 mb-4">
        <TaskFilters
          q={q}
          status={status}
          statuses={statuses}
          client={client}
          clients={clients}
          priority={priority}
          view={view}
          onQChange={handleQChange}
          onStatusChange={handleStatusChange}
          onClientChange={handleClientChange}
          onPriorityChange={handlePriorityChange}
        />
        <TaskViewToggle view={view} onViewChange={handleViewChange} />
      </div>

      {view === "board" ? (
        <TaskBoardView tasks={filtered} statuses={statuses} />
      ) : (
        <TaskListView tasks={filtered} />
      )}
    </div>
  );
}
