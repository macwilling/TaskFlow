"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  const { error } = await supabase.from("comments").insert({
    tenant_id: profile.tenant_id,
    task_id: taskId,
    author_id: user.id,
    author_role: profile.role,
    body,
  });

  if (error) return { error: error.message };

  const slug = await getTaskSlug(supabase, taskId);
  revalidatePath(`/tasks/${slug}`);
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
  return {};
}
