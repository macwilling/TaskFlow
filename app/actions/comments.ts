"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logTaskEvent } from "@/app/actions/audit";

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

export async function createCommentAction(
  taskId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const body = (formData.get("body") as string)?.trim();
  if (!body) return { error: "Comment cannot be empty." };

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      tenant_id: profile.tenant_id,
      task_id: taskId,
      author_id: user.id,
      author_role: profile.role,
      body,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Fire-and-forget audit log
  void logTaskEvent({
    tenantId: profile.tenant_id,
    taskId,
    actorId: user.id,
    actorRole: profile.role as "admin" | "client",
    eventType: "comment_added",
    metadata: { snippet: body.slice(0, 120) },
  });

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);

  const tenantSlug = user.app_metadata?.tenant_slug as string | undefined;
  if (tenantSlug) revalidatePath(`/portal/${tenantSlug}/tasks/${taskId}`);

  if (profile.role === "client" && inserted?.id) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: inserted.id }),
    }).catch(() => {});
  }

  return {};
}

export async function updateCommentAction(
  commentId: string,
  taskId: string,
  body: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized." };

  const trimmed = body.trim();
  if (!trimmed) return { error: "Comment cannot be empty." };

  const { error } = await supabase
    .from("comments")
    .update({ body: trimmed })
    .eq("id", commentId)
    .eq("author_id", user.id); // ensures users can only edit their own

  if (error) return { error: error.message };

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);

  const tenantSlug = user.app_metadata?.tenant_slug as string | undefined;
  if (tenantSlug) revalidatePath(`/portal/${tenantSlug}/tasks/${taskId}`);

  return {};
}

export async function deleteCommentAction(
  commentId: string,
  taskId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized." };

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", user.id); // ensures users can only delete their own

  if (error) return { error: error.message };

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);

  const tenantSlug = user.app_metadata?.tenant_slug as string | undefined;
  if (tenantSlug) revalidatePath(`/portal/${tenantSlug}/tasks/${taskId}`);

  return {};
}
