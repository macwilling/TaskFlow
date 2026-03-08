"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateClientNotesAction } from "@/app/actions/clients";
import { Pencil } from "lucide-react";

export function ClientNotesEditor({
  clientId,
  initialNotes,
}: {
  clientId: string;
  initialNotes: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      // Place cursor at end
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }
  }, [editing]);

  function handleCancel() {
    setValue(initialNotes ?? "");
    setError(null);
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateClientNotesAction(clientId, value);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          className="text-sm resize-none"
          placeholder="Add notes about this client…"
          disabled={isPending}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">⌘↵ to save · Esc to cancel</span>
        </div>
      </div>
    );
  }

  if (!initialNotes) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors italic"
      >
        Add notes…
      </button>
    );
  }

  return (
    <div className="group relative">
      <p className="text-sm text-foreground whitespace-pre-line pr-8">{initialNotes}</p>
      <button
        onClick={() => setEditing(true)}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground"
        aria-label="Edit notes"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
