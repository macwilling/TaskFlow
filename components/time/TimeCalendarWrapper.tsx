"use client";

import dynamic from "next/dynamic";

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <div className="h-7 w-7 rounded bg-muted/60" />
          <div className="h-7 w-7 rounded bg-muted/60" />
          <div className="h-7 w-16 rounded bg-muted/60" />
        </div>
        <div className="h-5 w-32 rounded bg-muted/60" />
        <div className="flex gap-1.5">
          <div className="h-7 w-14 rounded bg-muted/60" />
          <div className="h-7 w-14 rounded bg-muted/60" />
          <div className="h-7 w-14 rounded bg-muted/60" />
        </div>
      </div>
      {/* Calendar grid */}
      <div className="rounded-md border border-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-2 py-1.5 border-r border-border last:border-r-0">
              <div className="h-3 w-8 rounded bg-muted/60 mx-auto" />
            </div>
          ))}
        </div>
        {/* Day cells — 5 rows */}
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {Array.from({ length: 7 }).map((_, c) => (
              <div key={c} className="h-24 px-2 pt-1.5 border-r border-border last:border-r-0 bg-background">
                <div className="h-3 w-4 rounded bg-muted/40 mb-1.5" />
                {r === 0 && c === 2 && <div className="h-4 rounded bg-muted/60 mb-1" />}
                {r === 1 && c === 4 && <div className="h-4 rounded bg-muted/60 mb-1" />}
                {r === 2 && c === 1 && <div className="h-4 rounded bg-muted/60 mb-1" />}
                {r === 2 && c === 5 && <div className="h-4 rounded bg-muted/60" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const TimeCalendarDynamic = dynamic(
  () => import("@/components/time/TimeCalendar").then((m) => m.TimeCalendar),
  { ssr: false, loading: () => <CalendarSkeleton /> }
);

interface Client {
  id: string;
  name: string;
  color: string | null;
  default_rate: number | null;
}

interface Task {
  id: string;
  title: string;
  client_id: string;
}

export function TimeCalendarWrapper({ clients, tasks }: { clients: Client[]; tasks: Task[] }) {
  return <TimeCalendarDynamic clients={clients} tasks={tasks} />;
}
