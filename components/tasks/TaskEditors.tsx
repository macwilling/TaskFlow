"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { updateTaskContentAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";

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

function SaveCancelEditor({
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
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // editorKey forces Milkdown to remount (and reset to savedValue) on cancel
  const [editorKey, setEditorKey] = useState(0);
  // savedValue tracks the last persisted value (may differ from SSR initialValue after a save)
  const savedValue = useRef(initialValue);
  const currentValue = useRef(initialValue);

  const handleChange = useCallback((value: string) => {
    currentValue.current = value;
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await updateTaskContentAction(taskId, field, currentValue.current);
    savedValue.current = currentValue.current;
    setSaving(false);
    setDirty(false);
  }, [taskId, field]);

  const handleCancel = useCallback(() => {
    currentValue.current = savedValue.current;
    setEditorKey((k) => k + 1);
    setDirty(false);
  }, []);

  return (
    <div className="space-y-2">
      <MilkdownEditor
        key={editorKey}
        value={savedValue.current}
        onChange={readOnly ? undefined : handleChange}
        uploadPath={readOnly ? undefined : uploadPath}
        placeholder={placeholder}
        readOnly={readOnly}
        minHeight="140px"
      />
      {dirty && !readOnly && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}
    </div>
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
        <SaveCancelEditor
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
        <SaveCancelEditor
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
