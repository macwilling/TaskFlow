"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DropAnimation,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { updateTaskStatusAction } from "@/app/actions/tasks";
import type { TaskStatus } from "@/app/actions/task-statuses";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard, type Task } from "./TaskCard";

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

export function TaskBoardView({
  tasks: initialTasks,
  statuses,
}: {
  tasks: Task[];
  statuses: TaskStatus[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragStartStatusId, setDragStartStatusId] = useState<string | null>(null);

  // Sync when RSC re-renders with fresh data after revalidatePath
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const columnIds = statuses.map((s) => s.id);

  // pointerWithin is more reliable than closestCorners for horizontal Kanban layouts:
  // it checks if the pointer is physically inside a droppable's bounds rather than
  // measuring corner distances, which breaks down when there are 3+ columns or empty columns.
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) return pointerCollisions;
      // Fallback for gaps between columns
      return rectIntersection(args);
    },
    []
  );

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
    setDragStartStatusId(task?.status_id ?? null);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // Resolve target column: overId is either a status UUID (column) or a task UUID
    const targetStatusId = columnIds.includes(overId)
      ? overId
      : tasks.find((t) => t.id === overId)?.status_id;

    if (!targetStatusId) return;

    const targetStatus = statuses.find((s) => s.id === targetStatusId);
    if (!targetStatus) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeId
          ? {
              ...t,
              status_id: targetStatusId,
              task_statuses: {
                id: targetStatus.id,
                name: targetStatus.name,
                color: targetStatus.color,
                is_closed: targetStatus.is_closed,
              },
            }
          : t
      )
    );
  }

  async function handleDragEnd({ active }: DragEndEvent) {
    setActiveTask(null);

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    // No column change — nothing to persist
    if (task.status_id === dragStartStatusId) {
      setDragStartStatusId(null);
      return;
    }

    setDragStartStatusId(null);

    // Snapshot for rollback
    const snapshot = [...tasks];

    const result = await updateTaskStatusAction(task.id, task.status_id);
    if (result?.error) {
      setTasks(snapshot);
    }
  }

  function handleDragCancel() {
    if (activeTask && dragStartStatusId) {
      const originalStatus = statuses.find((s) => s.id === dragStartStatusId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTask.id
            ? {
                ...t,
                status_id: dragStartStatusId,
                task_statuses: originalStatus
                  ? {
                      id: originalStatus.id,
                      name: originalStatus.name,
                      color: originalStatus.color,
                      is_closed: originalStatus.is_closed,
                    }
                  : t.task_statuses,
              }
            : t
        )
      );
    }
    setActiveTask(null);
    setDragStartStatusId(null);
  }

  const byStatus = Object.fromEntries(
    statuses.map((s) => [s.id, tasks.filter((t) => t.status_id === s.id)])
  );

  const colCount = statuses.length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-3 min-h-[400px]"
          style={{
            gridTemplateColumns: `repeat(${colCount}, minmax(240px, 1fr))`,
          }}
        >
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              column={{ id: status.id, label: status.name }}
              tasks={byStatus[status.id] ?? []}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
