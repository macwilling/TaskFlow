"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { updateTaskTitleAction } from "@/app/actions/tasks";

interface TaskTitleEditorProps {
  taskId: string;
  initialTitle: string;
  disabled?: boolean;
}

export function TaskTitleEditor({
  taskId,
  initialTitle,
  disabled,
}: TaskTitleEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function startEditing() {
    if (disabled) return;
    setDraft(title);
    setIsEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    setTitle(trimmed);
    startTransition(async () => {
      const result = await updateTaskTitleAction(taskId, trimmed);
      if (result.error) {
        // Revert on error
        setTitle(title);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setDraft(title);
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent text-xl font-semibold tracking-tight text-foreground outline-none border-b border-border focus:border-ring pb-0.5"
        maxLength={255}
      />
    );
  }

  return (
    <h1
      onClick={startEditing}
      title={disabled ? undefined : "Click to edit title"}
      className={[
        "text-xl font-semibold tracking-tight text-foreground leading-snug",
        !disabled &&
          "cursor-text rounded hover:bg-muted/50 -mx-1 px-1 py-0.5 transition-colors",
        isPending && "opacity-60",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {title}
    </h1>
  );
}
