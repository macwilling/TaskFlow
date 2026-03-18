"use client";

import { useState, useTransition, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, Trash2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskStatus } from "@/app/actions/task-statuses";
import {
  createTaskStatusAction,
  updateTaskStatusAction,
  reorderTaskStatusesAction,
  deleteTaskStatusAction,
  countTasksForStatusAction,
} from "@/app/actions/task-statuses";

const PRESET_COLORS = [
  "#6b7280", // gray
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#22c55e", // green
  "#ef4444", // red
  "#f97316", // orange
  "#06b6d4", // cyan
];

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-6 w-6 rounded border border-border shadow-sm hover:scale-110 transition-transform"
        style={{ backgroundColor: value }}
        aria-label="Pick color"
      />
      {open && (
        <>
          {/* Click-away overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-8 z-20 flex flex-wrap gap-1.5 rounded-md border border-border bg-popover p-2 shadow-md w-[116px]">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="h-6 w-6 rounded border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: c === value ? "white" : "transparent",
                  outline: c === value ? `2px solid ${c}` : "none",
                  outlineOffset: "1px",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sortable Status Row ───────────────────────────────────────────────────────

function StatusRow({
  status,
  onDelete,
  onSave,
}: {
  status: TaskStatus;
  onDelete: (id: string) => void;
  onSave: (id: string, name: string, color: string) => void;
}) {
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color);
  const nameRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id, disabled: status.is_closed });

  function handleBlur() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(status.name);
      return;
    }
    if (trimmed !== status.name || color !== status.color) {
      onSave(status.id, trimmed, color);
    }
  }

  function handleColorChange(c: string) {
    setColor(c);
    // Save immediately on color pick
    onSave(status.id, name.trim() || status.name, c);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 ${
        isDragging ? "opacity-40 shadow-lg" : ""
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className={`text-muted-foreground ${status.is_closed ? "cursor-not-allowed opacity-30" : "cursor-grab active:cursor-grabbing hover:text-foreground"}`}
        {...(status.is_closed ? {} : { ...attributes, ...listeners })}
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Color picker */}
      <ColorPicker value={color} onChange={handleColorChange} />

      {/* Name */}
      <Input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleBlur}
        className="h-7 flex-1 text-sm border-transparent bg-transparent px-1 hover:border-border focus:border-input focus:bg-background"
      />

      {/* Default badge */}
      {status.is_default && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          default
        </span>
      )}

      {/* Lock icon for closed status */}
      {status.is_closed ? (
        <span title="The closed status cannot be deleted" className="text-muted-foreground/50">
          <Lock className="h-3.5 w-3.5" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onDelete(status.id)}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Delete ${status.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

function DeleteStatusDialog({
  open,
  statusToDelete,
  allStatuses,
  onClose,
  onConfirm,
}: {
  open: boolean;
  statusToDelete: TaskStatus | null;
  allStatuses: TaskStatus[];
  onClose: () => void;
  onConfirm: (statusId: string, reassignTo: string) => void;
}) {
  const [reassignTo, setReassignTo] = useState("");
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fetch task count when dialog opens
  useState(() => {
    if (open && statusToDelete) {
      countTasksForStatusAction(statusToDelete.id).then(setTaskCount);
      // Default reassign to first non-deleted status
      const candidates = allStatuses.filter((s) => s.id !== statusToDelete.id);
      setReassignTo(candidates[0]?.id ?? "");
    }
  });

  const candidates = allStatuses.filter((s) => s.id !== statusToDelete?.id);

  function handleConfirm() {
    if (!statusToDelete || !reassignTo) return;
    startTransition(async () => {
      await onConfirm(statusToDelete.id, reassignTo);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{statusToDelete?.name}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-sm">
          {taskCount === null ? (
            <p className="text-muted-foreground">Checking affected tasks…</p>
          ) : taskCount === 0 ? (
            <p className="text-muted-foreground">No tasks use this status. It can be safely deleted.</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                <strong className="text-foreground">{taskCount}</strong>{" "}
                {taskCount === 1 ? "task uses" : "tasks use"} this status. Choose a status to move
                them to before deleting.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reassign tasks to</label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending || !reassignTo}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function TaskStatusesForm({ statuses: initial }: { statuses: TaskStatus[] }) {
  const [statuses, setStatuses] = useState<TaskStatus[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<TaskStatus | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6b7280");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(statuses, oldIndex, newIndex).map((s, i) => ({
      ...s,
      position: i,
    }));

    setStatuses(reordered);

    startTransition(async () => {
      await reorderTaskStatusesAction(reordered.map((s) => s.id));
    });
  }

  function handleSave(id: string, name: string, color: string) {
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name, color } : s))
    );
    startTransition(async () => {
      await updateTaskStatusAction(id, { name, color });
    });
  }

  function handleDeleteRequest(id: string) {
    const status = statuses.find((s) => s.id === id);
    if (!status) return;
    setDeleteTarget(status);
  }

  function handleDeleteConfirm(statusId: string, reassignTo: string) {
    startTransition(async () => {
      const result = await deleteTaskStatusAction(statusId, reassignTo);
      if (!result.error) {
        setStatuses((prev) => prev.filter((s) => s.id !== statusId));
      }
      setDeleteTarget(null);
    });
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError("Name is required.");
      return;
    }
    setAddError("");
    setIsAdding(true);
    const result = await createTaskStatusAction(trimmed, newColor);
    setIsAdding(false);
    if (result.error) {
      setAddError(result.error);
      return;
    }
    // Append optimistically — server will revalidate
    const newStatus: TaskStatus = {
      id: result.id!,
      tenant_id: "",
      name: trimmed,
      color: newColor,
      position: statuses.length,
      is_default: false,
      is_closed: false,
      created_at: new Date().toISOString(),
    };
    setStatuses((prev) => [...prev, newStatus]);
    setNewName("");
    setNewColor("#6b7280");
  }

  return (
    <div className="space-y-4">
      {/* Status list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={statuses.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {statuses.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                onDelete={handleDeleteRequest}
                onSave={handleSave}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {isPending && (
        <p className="text-xs text-muted-foreground">Saving…</p>
      )}

      {/* Add new status */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <ColorPicker value={newColor} onChange={setNewColor} />
        <Input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            if (addError) setAddError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New status name…"
          className="h-7 flex-1 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={handleAdd}
          disabled={isAdding}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {addError && <p className="text-xs text-destructive">{addError}</p>}

      <div className="rounded-md bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5">
          <Check className="h-3 w-3 text-muted-foreground" />
          Drag rows to reorder Kanban columns.
        </p>
        <p className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-muted-foreground" />
          The locked status is the terminal stage — closing a task always moves it here.
        </p>
      </div>

      <DeleteStatusDialog
        open={deleteTarget !== null}
        statusToDelete={deleteTarget}
        allStatuses={statuses}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
