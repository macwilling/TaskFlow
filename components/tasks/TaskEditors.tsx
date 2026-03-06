"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useRef, useState } from "react";
import { updateTaskContentAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
} from "lucide-react";

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

type CallCommand = (key: string, payload?: unknown) => void;

const TOOLBAR_ITEMS: {
  title: string;
  icon: React.ReactNode;
  command: () => Parameters<CallCommand>;
}[] = [
  { title: "Bold", icon: <Bold className="h-5 w-5" strokeWidth={2.5} />, command: () => ["ToggleStrong"] },
  { title: "Italic", icon: <Italic className="h-5 w-5" />, command: () => ["ToggleEmphasis"] },
  { title: "Inline code", icon: <Code className="h-5 w-5" />, command: () => ["ToggleInlineCode"] },
  { title: "Heading 1", icon: <Heading1 className="h-5 w-5" />, command: () => ["WrapInHeading", 1] },
  { title: "Heading 2", icon: <Heading2 className="h-5 w-5" />, command: () => ["WrapInHeading", 2] },
  { title: "Bullet list", icon: <List className="h-5 w-5" />, command: () => ["WrapInBulletList"] },
  { title: "Ordered list", icon: <ListOrdered className="h-5 w-5" />, command: () => ["WrapInOrderedList"] },
];

function EditorToolbar({ callCommandRef }: { callCommandRef: React.RefObject<CallCommand | null> }) {
  return (
    <div className="flex items-center border-b border-border bg-card px-1.5 py-1">
      {TOOLBAR_ITEMS.map(({ title, icon, command }, i) => (
        <React.Fragment key={title}>
          {/* divider before headings and before lists */}
          {(i === 3 || i === 5) && (
            <div className="mx-2.5 h-6 w-px bg-border/60" />
          )}
          <button
            title={title}
            onMouseDown={(e) => {
              e.preventDefault();
              callCommandRef.current?.(...command());
            }}
            className="m-1.5 flex h-8 w-8 items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/70"
          >
            {icon}
          </button>
        </React.Fragment>
      ))}
      <div className="ml-auto flex items-center gap-1 pr-2 text-xs text-muted-foreground/50">
        <kbd className="font-mono">/</kbd>
        <span>for more</span>
      </div>
    </div>
  );
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
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // editorKey forces Milkdown to remount (and reset to savedValue) on cancel
  const [editorKey, setEditorKey] = useState(0);
  // savedValue tracks the last persisted value (may differ from SSR initialValue after a save)
  const savedValue = useRef(initialValue);
  const currentValue = useRef(initialValue);
  const callCommandRef = useRef<CallCommand | null>(null);

  const handleReady = useCallback((fn: CallCommand) => {
    callCommandRef.current = fn;
  }, []);

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
    setEditing(false);
  }, [taskId, field]);

  const handleCancel = useCallback(() => {
    currentValue.current = savedValue.current;
    setEditorKey((k) => k + 1);
    setDirty(false);
    setEditing(false);
  }, []);

  const isEditing = (editing || dirty) && !readOnly;

  return (
    <div className="space-y-2">
      <div
        className="rounded-md border border-input ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        onFocus={() => !readOnly && setEditing(true)}
      >
        {isEditing && <EditorToolbar callCommandRef={callCommandRef} />}
        <MilkdownEditor
          key={editorKey}
          value={savedValue.current}
          onChange={readOnly ? undefined : handleChange}
          uploadPath={readOnly ? undefined : uploadPath}
          placeholder={placeholder}
          readOnly={readOnly}
          minHeight="140px"
          className={isEditing ? "rounded-t-none border-0 focus-within:ring-0" : "border-0 focus-within:ring-0"}
          onReady={readOnly ? undefined : handleReady}
        />
      </div>
      {isEditing && (
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
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
          placeholder=""
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
          placeholder=""
        />
      </div>
    </div>
  );
}
