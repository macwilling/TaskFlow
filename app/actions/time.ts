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

interface TimeEntryInput {
  client_id: string;
  task_id?: string | null;
  description: string;
  entry_date: string;
  start_time?: string | null;
  duration_hours: number;
  billable: boolean;
  hourly_rate?: number | null;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createTimeEntryAction(
  input: TimeEntryInput
): Promise<{ id?: string; error?: string }> {
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

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      tenant_id: profile.tenant_id,
      client_id: input.client_id,
      task_id: input.task_id || null,
      description: input.description,
      entry_date: input.entry_date,
      start_time: input.start_time || null,
      duration_hours: input.duration_hours,
      billable: input.billable,
      hourly_rate: input.hourly_rate ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/time");
  if (input.task_id) {
    const slug = await getTaskSlug(supabase, input.task_id);
    revalidatePath(`/tasks/${slug}`);
  }
  return { id: data.id };
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateTimeEntryAction(
  id: string,
  input: TimeEntryInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase
    .from("time_entries")
    .update({
      client_id: input.client_id,
      task_id: input.task_id || null,
      description: input.description,
      entry_date: input.entry_date,
      start_time: input.start_time || null,
      duration_hours: input.duration_hours,
      billable: input.billable,
      hourly_rate: input.hourly_rate ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/time");
  if (input.task_id) {
    const slug = await getTaskSlug(supabase, input.task_id);
    revalidatePath(`/tasks/${slug}`);
  }
  return {};
}

// ─── Update date/time (drag-drop) ────────────────────────────────────────────

export async function updateTimeEntryDateAction(
  id: string,
  entry_date: string,
  start_time: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase
    .from("time_entries")
    .update({ entry_date, start_time })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/time");
  return {};
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteTimeEntryAction(
  id: string,
  taskId?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase.from("time_entries").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/time");
  if (taskId) {
    const slug = await getTaskSlug(supabase, taskId);
    revalidatePath(`/tasks/${slug}`);
  }
  return {};
}
