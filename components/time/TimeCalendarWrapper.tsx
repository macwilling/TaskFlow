"use client";

import dynamic from "next/dynamic";

const TimeCalendarDynamic = dynamic(
  () => import("@/components/time/TimeCalendar").then((m) => m.TimeCalendar),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-md bg-muted/30" /> }
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
