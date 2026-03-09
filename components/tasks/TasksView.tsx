"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TaskListView } from "./TaskListView";
import { TaskBoardView } from "./TaskBoardView";
import { TaskFilters } from "./TaskFilters";
import { TaskViewToggle } from "./TaskViewToggle";

interface Task {
  id: string;
  task_number: number | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  clients: { name: string; color: string | null; client_key: string | null } | null;
}

function syncUrl(status: string, q: string, view: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (view !== "list") params.set("view", view);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `/tasks?${qs}` : "/tasks");
}

export function TasksView({ tasks }: { tasks: Task[] }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [view, setView] = useState(searchParams.get("view") ?? "list");

  function handleStatusChange(s: string) {
    setStatus(s);
    syncUrl(s, q, view);
  }

  function handleQChange(newQ: string) {
    setQ(newQ);
    syncUrl(status, newQ, view);
  }

  function handleViewChange(v: string) {
    setView(v);
    syncUrl(status, q, v);
  }

  const filtered = tasks.filter((t) => {
    if (status && t.status !== status) return false;
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <TaskFilters
          q={q}
          status={status}
          onQChange={handleQChange}
          onStatusChange={handleStatusChange}
        />
        <TaskViewToggle view={view} onViewChange={handleViewChange} />
      </div>

      {view === "board" ? (
        <TaskBoardView tasks={filtered} />
      ) : (
        <TaskListView tasks={filtered} />
      )}
    </div>
  );
}
