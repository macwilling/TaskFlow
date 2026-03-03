"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TimeEntryModal } from "@/components/time/TimeEntryModal";
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
}

interface TaskTimeEntriesProps {
  taskId: string;
  clientId: string;
  clients: Client[];
  tasks: Task[];
  entries: TimeEntry[];
}

export function TaskTimeEntries({
  taskId,
  clientId,
  clients,
  tasks,
  entries,
}: TaskTimeEntriesProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const totalHours = entries.reduce((sum, e) => sum + Number(e.duration_hours), 0);

  function handleSuccess() {
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Time entries
          {totalHours > 0 && (
            <span className="ml-2 normal-case font-normal text-foreground">
              {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(2)}h logged
            </span>
          )}
        </h2>
        <Button size="sm" variant="outline" className="h-6 gap-1 text-xs" onClick={() => setModalOpen(true)}>
          <Plus className="h-3 w-3" />
          Log time
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-6 text-center">
          <Clock className="mx-auto h-4 w-4 text-muted-foreground mb-1.5" />
          <p className="text-xs text-muted-foreground">No time logged yet</p>
        </div>
      ) : (
        <div className="rounded-md border border-border divide-y divide-border">
          {entries.map((entry) => {
            const hours = Number(entry.duration_hours);
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">{entry.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(entry.entry_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {!entry.billable && (
                      <span className="ml-2 text-muted-foreground/60">non-billable</span>
                    )}
                    {entry.billed && (
                      <span className="ml-2 text-blue-600 dark:text-blue-400">billed</span>
                    )}
                  </p>
                </div>
                <span className="ml-4 shrink-0 tabular-nums font-medium text-sm">
                  {hours % 1 === 0 ? hours : hours.toFixed(2)}h
                </span>
              </div>
            );
          })}
        </div>
      )}

      <TimeEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleSuccess}
        clients={clients}
        tasks={tasks}
        prefillClientId={clientId}
        prefillTaskId={taskId}
      />
    </div>
  );
}
