"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: profile.tenant_id,
      client_id,
      title,
      priority,
      due_date: due_date || null,
      estimated_hours: estimated_hours ? parseFloat(estimated_hours) : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  redirect(`/tasks/${data.id}`);
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

  revalidatePath(`/tasks/${taskId}`);
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

  revalidatePath(`/tasks/${taskId}`);
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

  revalidatePath(`/tasks/${taskId}`);
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

  revalidatePath(`/tasks/${taskId}`);
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

  revalidatePath(`/tasks/${params.taskId}`);
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

  const { error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return { error: error.message };

  revalidatePath(`/tasks/${taskId}`);
  return {};
}
