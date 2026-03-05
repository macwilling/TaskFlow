"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logTaskEvent } from "@/app/actions/audit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable task key (e.g. "AC-1") for a given task UUID.
 * Used by server actions to build the correct revalidatePath argument.
 * Falls back to the raw UUID on any error so revalidation still runs.
 */
async function getTaskSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  taskId: string
): Promise<string> {
  const { data } = await supabase
    .from("tasks")
    .select("task_number, clients(client_key)")
    .eq("id", taskId)
    .single();

  if (!data) return taskId;
  const c = data.clients as unknown as { client_key: string | null } | null;
  if (!c?.client_key || data.task_number == null) return taskId;
  return `${c.client_key}-${data.task_number}`;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createTaskAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const title = (formData.get("title") as string)?.trim();
  const client_id = formData.get("client_id") as string;
  if (!title) return { error: "Title is required." };
  if (!client_id) return { error: "Client is required." };

  const due_date = (formData.get("due_date") as string) || null;
  const estimated_hours = formData.get("estimated_hours") as string;
  const priority = (formData.get("priority") as string) || "medium";

  // Atomically claim the next task number for this client
  const { data: taskNumber, error: numError } = await supabase
    .rpc("next_task_number_for_client", { p_client_id: client_id });

  if (numError) return { error: numError.message };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: profile.tenant_id,
      client_id,
      title,
      priority,
      due_date: due_date || null,
      estimated_hours: estimated_hours ? parseFloat(estimated_hours) : null,
      task_number: taskNumber,
    })
    .select("id, task_number, clients(client_key)")
    .single();

  if (error) return { error: error.message };

  const c = data.clients as unknown as { client_key: string | null } | null;
  const slug =
    c?.client_key && data.task_number != null
      ? `${c.client_key}-${data.task_number}`
      : data.id;

  revalidatePath("/tasks");
  redirect(`/tasks/${slug}`);
}

// ─── Update title (inline edit) ──────────────────────────────────────────────

export async function updateTaskTitleAction(
  taskId: string,
  title: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const trimmed = title.trim();
  if (!trimmed) return { error: "Title is required." };

  const { error } = await supabase
    .from("tasks")
    .update({ title: trimmed })
    .eq("id", taskId);

  if (error) return { error: error.message };

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);
  revalidatePath("/tasks");
  return {};
}

// ─── Update metadata ──────────────────────────────────────────────────────────

export async function updateTaskMetaAction(
  taskId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Title is required." };

  const client_id = formData.get("client_id") as string;
  const due_date = formData.get("due_date") as string;
  const estimated_hours = formData.get("estimated_hours") as string;
  const priority = formData.get("priority") as string;

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      client_id,
      priority,
      due_date: due_date || null,
      estimated_hours: estimated_hours ? parseFloat(estimated_hours) : null,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);
  revalidatePath("/tasks");
  return {};
}

// ─── Update description / resolution notes (auto-saved) ──────────────────────

export async function updateTaskContentAction(
  taskId: string,
  field: "description" | "resolution_notes",
  value: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ [field]: value })
    .eq("id", taskId);

  if (error) return { error: error.message };

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);
  return {};
}

// ─── Update status ────────────────────────────────────────────────────────────

export async function updateTaskStatusAction(
  taskId: string,
  status: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const update: Record<string, unknown> = { status };
  if (status === "closed") {
    update.closed_at = new Date().toISOString();
  } else {
    update.closed_at = null;
  }

  const { error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId);

  if (error) return { error: error.message };

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);
  revalidatePath("/tasks");
  return {};
}

// ─── Close task (with notification email trigger) ─────────────────────────────

export async function closeTaskAction(
  taskId: string,
  resolutionNotes: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      resolution_notes: resolutionNotes,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  // Fire email notification (non-blocking — ignore failures gracefully)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await fetch(`${appUrl}/api/email/task-closed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
  } catch {
    // Email failure should not block the close action
  }

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);
  revalidatePath("/tasks");
  return {};
}

// ─── Delete task ──────────────────────────────────────────────────────────────

export async function deleteTaskAction(taskId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  redirect("/tasks");
}

// ─── Save attachment record (called after successful R2 upload) ───────────────

export async function saveAttachmentAction(params: {
  taskId: string;
  tenantId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  r2Key: string;
  publicUrl: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase.from("task_attachments").insert({
    tenant_id: params.tenantId,
    task_id: params.taskId,
    file_name: params.fileName,
    file_size: params.fileSize,
    mime_type: params.mimeType,
    r2_key: params.r2Key,
    public_url: params.publicUrl,
    uploaded_by: user.id,
  });

  if (error) return { error: error.message };

  // Fire-and-forget audit log
  void logTaskEvent({
    tenantId: params.tenantId,
    taskId: params.taskId,
    actorId: user.id,
    actorRole: "admin",
    eventType: "attachment_added",
    newValue: params.fileName,
    metadata: { file_name: params.fileName, file_size: params.fileSize, mime_type: params.mimeType },
  });

  const slug = await getTaskSlug(supabase, params.taskId);
  revalidatePath(`/tasks/${slug}`);
  return {};
}

// ─── Delete attachment ────────────────────────────────────────────────────────

export async function deleteAttachmentAction(
  attachmentId: string,
  taskId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  // Fetch before delete so we can log the file name
  const { data: attachment } = await supabase
    .from("task_attachments")
    .select("tenant_id, file_name")
    .eq("id", attachmentId)
    .single();

  const { error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return { error: error.message };

  if (attachment) {
    void logTaskEvent({
      tenantId: attachment.tenant_id,
      taskId,
      actorId: user.id,
      actorRole: "admin",
      eventType: "attachment_deleted",
      oldValue: attachment.file_name,
      metadata: { file_name: attachment.file_name },
    });
  }

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);
  return {};
}
