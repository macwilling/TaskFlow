"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { updateTaskStatusAction } from "@/app/actions/tasks";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard, type Task } from "./TaskCard";

const COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "closed", label: "Closed" },
] as const;

const COLUMN_IDS = COLUMNS.map((c) => c.id);

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

export function TaskBoardView({ tasks: initialTasks }: { tasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragStartStatus, setDragStartStatus] = useState<string | null>(null);

  // Sync when RSC re-renders with fresh data after revalidatePath
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Must move 8px before drag activates — clicks still navigate via <Link>
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart({ active }: DragStartEvent) {
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task ?? null);
    setDragStartStatus(task?.status ?? null);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // Resolve target column: overId is either a column id or a task id
    const targetCol = COLUMN_IDS.includes(overId as (typeof COLUMN_IDS)[number])
      ? overId
      : tasks.find((t) => t.id === overId)?.status;

    if (!targetCol) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: targetCol } : t))
    );
  }

  async function handleDragEnd({ active }: DragEndEvent) {
    setActiveTask(null);

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    // No column change — nothing to persist
    if (task.status === dragStartStatus) {
      setDragStartStatus(null);
      return;
    }

    setDragStartStatus(null);

    // Snapshot for rollback
    const snapshot = [...tasks];

    const result = await updateTaskStatusAction(task.id, task.status);
    if (result?.error) {
      setTasks(snapshot);
    }
  }

  function handleDragCancel() {
    // Restore original status if drag is cancelled
    if (activeTask && dragStartStatus) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTask.id ? { ...t, status: dragStartStatus } : t
        )
      );
    }
    setActiveTask(null);
    setDragStartStatus(null);
  }

  const byStatus = Object.fromEntries(
    COLUMNS.map((col) => [col.id, tasks.filter((t) => t.status === col.id)])
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-h-[400px]">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={byStatus[col.id] ?? []}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
