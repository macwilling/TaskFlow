"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import { updateTaskContentAction } from "@/app/actions/tasks";

const MilkdownEditor = dynamic(
  () => import("@/components/editor/MilkdownEditor"),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-md bg-muted/30" /> }
);

interface TaskEditorsProps {
  taskId: string;
  tenantId: string;
  description: string;
  resolutionNotes: string;
  isClosed: boolean;
}

function AutoSaveEditor({
  taskId,
  field,
  initialValue,
  uploadPath,
  placeholder,
  readOnly,
}: {
  taskId: string;
  field: "description" | "resolution_notes";
  initialValue: string;
  uploadPath: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (value: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await updateTaskContentAction(taskId, field, value);
      }, 1000);
    },
    [taskId, field]
  );

  return (
    <MilkdownEditor
      value={initialValue}
      onChange={readOnly ? undefined : handleChange}
      uploadPath={readOnly ? undefined : uploadPath}
      placeholder={placeholder}
      readOnly={readOnly}
      minHeight="140px"
    />
  );
}

export function TaskEditors({
  taskId,
  tenantId,
  description,
  resolutionNotes,
  isClosed,
}: TaskEditorsProps) {
  const uploadPath = `tenant-${tenantId}/tasks/${taskId}/inline`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Description
        </h2>
        <AutoSaveEditor
          taskId={taskId}
          field="description"
          initialValue={description}
          uploadPath={uploadPath}
          placeholder="Add a description… (paste or drag images to upload)"
          readOnly={isClosed}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resolution notes
        </h2>
        <AutoSaveEditor
          taskId={taskId}
          field="resolution_notes"
          initialValue={resolutionNotes}
          uploadPath={uploadPath}
          placeholder="Document the resolution… (always editable)"
        />
      </div>
    </div>
  );
}
