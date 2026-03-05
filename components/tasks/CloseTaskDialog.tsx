"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { closeTaskAction } from "@/app/actions/tasks";
import { CheckSquare } from "lucide-react";

interface CloseTaskDialogProps {
  taskId: string;
  currentResolutionNotes: string;
  /** Controlled mode: open state managed by parent */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CloseTaskDialog({
  taskId,
  currentResolutionNotes,
  open: controlledOpen,
  onOpenChange,
}: CloseTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [notes, setNotes] = useState(currentResolutionNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const result = await closeTaskAction(taskId, notes);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm" className="h-7 gap-1 text-xs">
            <CheckSquare className="h-3.5 w-3.5" />
            Close task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close this task</DialogTitle>
          <DialogDescription>
            Review or update the resolution notes before closing. A notification
            email will be sent to the client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">Resolution notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what was done and how the task was resolved…"
            rows={6}
            className="resize-none"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={isPending}>
            {isPending ? "Closing…" : "Close task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
