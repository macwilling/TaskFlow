"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TimeEntryModal, TimeEntryData } from "@/components/time/TimeEntryModal";
import { Button } from "@/components/ui/button";
import { Plus, Clock } from "lucide-react";

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

interface TimeEntry {
  id: string;
  description: string;
  entry_date: string;
  duration_hours: number;
  billable: boolean;
  billed: boolean;
  hourly_rate: number | null;
  client_id: string;
  task_id: string | null;
  clients: { name: string; color: string | null } | null;
  tasks: { title: string } | null;
}

interface TimeEntryListProps {
  entries: TimeEntry[];
  clients: Client[];
  tasks: Task[];
  totalHours: number;
}

export function TimeEntryList({ entries, clients, tasks, totalHours }: TimeEntryListProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntryData | undefined>();

  function openCreate() {
    setEditEntry(undefined);
    setModalOpen(true);
  }

  function openEdit(entry: TimeEntry) {
    setEditEntry({
      id: entry.id,
      description: entry.description,
      clientId: entry.client_id,
      taskId: entry.task_id,
      entryDate: entry.entry_date,
      durationHours: Number(entry.duration_hours),
      billable: entry.billable,
      hourlyRate: entry.hourly_rate,
    });
    setModalOpen(true);
  }

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} ·{" "}
          <span className="font-medium text-foreground">
            {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(2)}h total
          </span>
        </p>
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Log time
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-12 text-center">
          <Clock className="mx-auto h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No time entries</p>
          <p className="text-xs text-muted-foreground mt-0.5">Log time to see entries here.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Client / Task</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Hours</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Billable</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Billed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => {
                const color = entry.clients?.color ?? "#0969da";
                const hours = Number(entry.duration_hours);
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => openEdit(entry)}
                  >
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(entry.entry_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium">{entry.clients?.name ?? "—"}</span>
                      </div>
                      {entry.tasks && (
                        <p className="text-xs text-muted-foreground mt-0.5 pl-3.5">
                          {entry.tasks.title}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-xs truncate text-muted-foreground">
                      {entry.description}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {hours % 1 === 0 ? hours : hours.toFixed(2)}h
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {entry.billable ? (
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {entry.billed ? (
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Billed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TimeEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleSuccess}
        clients={clients}
        tasks={tasks}
        entry={editEntry}
      />
    </>
  );
}
