"use client";

import {
  CheckCircle2,
  Circle,
  FileText,
  Paperclip,
  MessageSquare,
  Pencil,
  Trash2,
  PlusCircle,
  AlignLeft,
  StickyNote,
} from "lucide-react";

export interface AuditEntry {
  id: string;
  actor_role: string | null;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface TaskAuditLogProps {
  entries: AuditEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  in_review: "In Review",
  closed: "Closed",
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function actorLabel(role: string | null) {
  if (role === "admin") return "Consultant";
  if (role === "client") return "Client";
  return "System";
}

function EntryIcon({ eventType }: { eventType: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (eventType) {
    case "created":
      return <PlusCircle className={cls} />;
    case "status_changed":
      return <CheckCircle2 className={cls} />;
    case "title_changed":
      return <Pencil className={cls} />;
    case "description_changed":
      return <AlignLeft className={cls} />;
    case "resolution_notes_changed":
      return <StickyNote className={cls} />;
    case "comment_added":
      return <MessageSquare className={cls} />;
    case "attachment_added":
      return <Paperclip className={cls} />;
    case "attachment_deleted":
      return <Trash2 className={cls} />;
    default:
      return <Circle className={cls} />;
  }
}

function entryDescription(entry: AuditEntry): string {
  const actor = actorLabel(entry.actor_role);
  switch (entry.event_type) {
    case "created":
      return `${actor} created this task`;
    case "status_changed": {
      const from = STATUS_LABELS[entry.old_value ?? ""] ?? entry.old_value ?? "unknown";
      const to = STATUS_LABELS[entry.new_value ?? ""] ?? entry.new_value ?? "unknown";
      return `${actor} changed status from "${from}" to "${to}"`;
    }
    case "title_changed":
      return `${actor} renamed this task`;
    case "description_changed":
      return `${actor} updated the description`;
    case "resolution_notes_changed":
      return `${actor} updated the resolution notes`;
    case "comment_added":
      return `${actor} left a comment`;
    case "attachment_added": {
      const name = (entry.metadata?.file_name as string) ?? entry.new_value ?? "a file";
      return `${actor} attached "${name}"`;
    }
    case "attachment_deleted": {
      const name = (entry.metadata?.file_name as string) ?? entry.old_value ?? "a file";
      return `${actor} removed "${name}"`;
    }
    default:
      return `${actor} performed an action`;
  }
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex gap-3 py-2.5">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <EntryIcon eventType={entry.event_type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          {entryDescription(entry)}
        </p>
        {entry.event_type === "title_changed" && entry.old_value && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            was: {entry.old_value}
          </p>
        )}
        {entry.event_type === "comment_added" &&
          typeof entry.metadata?.snippet === "string" &&
          entry.metadata.snippet && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 italic">
              "{entry.metadata.snippet}"
            </p>
          )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatTimestamp(entry.created_at)}
        </p>
      </div>
    </div>
  );
}

export function TaskAuditLog({ entries }: TaskAuditLogProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <FileText className="h-4 w-4 shrink-0" />
        No activity yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border px-3">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
