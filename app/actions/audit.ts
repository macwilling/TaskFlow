"use server";

import { createClient } from "@/lib/supabase/server";

export type AuditEventType =
  | "created"
  | "status_changed"
  | "title_changed"
  | "comment_added"
  | "attachment_added"
  | "attachment_deleted";

/**
 * Inserts a row into task_audit_log.
 * Called from server actions for events not captured by the DB trigger
 * (attachments, comments). Task creation/status/title are logged by trigger.
 */
export async function logTaskEvent(params: {
  tenantId: string;
  taskId: string;
  actorId: string;
  actorRole: "admin" | "client";
  eventType: AuditEventType;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  await supabase.from("task_audit_log").insert({
    tenant_id: params.tenantId,
    task_id: params.taskId,
    actor_id: params.actorId,
    actor_role: params.actorRole,
    event_type: params.eventType,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    metadata: params.metadata ?? {},
  });
  // Silently ignore failures — audit log should never break the main action
}
