"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTimeEntryAction, updateTimeEntryAction, deleteTimeEntryAction } from "@/app/actions/time";

export interface TimeEntryData {
  id: string;
  description: string;
  clientId: string;
  taskId: string | null;
  entryDate: string;
  durationHours: number;
  billable: boolean;
  hourlyRate: number | null;
}

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

interface TimeEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clients: Client[];
  tasks: Task[];
  // Pre-fill values
  prefillDate?: string;
  prefillClientId?: string;
  prefillTaskId?: string;
  // Edit mode
  entry?: TimeEntryData;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function TimeEntryModal({
  open,
  onOpenChange,
  onSuccess,
  clients,
  tasks,
  prefillDate,
  prefillClientId,
  prefillTaskId,
  entry,
}: TimeEntryModalProps) {
  const isEditing = Boolean(entry);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(entry?.clientId ?? prefillClientId ?? "");
  const [taskId, setTaskId] = useState(entry?.taskId ?? prefillTaskId ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? prefillDate ?? todayISO());
  const [durationHours, setDurationHours] = useState(
    entry?.durationHours != null ? String(entry.durationHours) : "1"
  );
  const [billable, setBillable] = useState(entry?.billable ?? true);
  const [hourlyRate, setHourlyRate] = useState(
    entry?.hourlyRate != null ? String(entry.hourlyRate) : ""
  );

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setError(null);
      if (entry) {
        setClientId(entry.clientId);
        setTaskId(entry.taskId ?? "");
        setDescription(entry.description);
        setEntryDate(entry.entryDate);
        setDurationHours(String(entry.durationHours));
        setBillable(entry.billable);
        setHourlyRate(entry.hourlyRate != null ? String(entry.hourlyRate) : "");
      } else {
        setClientId(prefillClientId ?? "");
        setTaskId(prefillTaskId ?? "");
        setDescription("");
        setEntryDate(prefillDate ?? todayISO());
        setDurationHours("1");
        setBillable(true);
        setHourlyRate("");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-fill hourly rate from client default when client changes
  useEffect(() => {
    if (!isEditing && !entry && clientId) {
      const client = clients.find((c) => c.id === clientId);
      if (client?.default_rate != null) {
        setHourlyRate(String(client.default_rate));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // When client changes, clear task selection if it belongs to a different client
  useEffect(() => {
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.client_id !== clientId) {
        setTaskId("");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const clientTasks = tasks.filter((t) => t.client_id === clientId);

  function buildInput() {
    return {
      client_id: clientId,
      task_id: taskId || null,
      description: description.trim(),
      entry_date: entryDate,
      duration_hours: parseFloat(durationHours) || 0,
      billable,
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
    };
  }

  function handleSave() {
    setError(null);
    if (!clientId) { setError("Client is required."); return; }
    if (!description.trim()) { setError("Description is required."); return; }
    if (!entryDate) { setError("Date is required."); return; }
    const dur = parseFloat(durationHours);
    if (isNaN(dur) || dur <= 0) { setError("Duration must be a positive number."); return; }

    startTransition(async () => {
      const input = buildInput();
      const result = isEditing
        ? await updateTimeEntryAction(entry!.id, input)
        : await createTimeEntryAction(input);

      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        onSuccess();
      }
    });
  }

  function handleDelete() {
    if (!entry) return;
    startTransition(async () => {
      const result = await deleteTimeEntryAction(entry.id, entry.taskId);
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        onSuccess();
      }
    });
  }

  const lockClient = Boolean(prefillClientId) && !isEditing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit time entry" : "Log time"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Client */}
          <div className="space-y-1.5">
            <Label htmlFor="te-client">Client</Label>
            {lockClient ? (
              <p className="text-sm text-foreground">
                {clients.find((c) => c.id === clientId)?.name ?? clientId}
              </p>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="te-client">
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Task (optional) */}
          {clientTasks.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="te-task">Task <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={taskId || "_none"} onValueChange={(v) => setTaskId(v === "_none" ? "" : v)}>
                <SelectTrigger id="te-task">
                  <SelectValue placeholder="No task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No task</SelectItem>
                  {clientTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="te-desc">Description</Label>
            <Input
              id="te-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="te-date">Date</Label>
              <Input
                id="te-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="te-duration">Hours</Label>
              <Input
                id="te-duration"
                type="number"
                step="0.25"
                min="0.25"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="1.0"
              />
            </div>
          </div>

          {/* Hourly rate */}
          <div className="space-y-1.5">
            <Label htmlFor="te-rate">Hourly rate <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="te-rate"
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Billable toggle */}
          <div className="flex items-center gap-2">
            <input
              id="te-billable"
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <Label htmlFor="te-billable" className="font-normal cursor-pointer">Billable</Label>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isEditing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Log time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
