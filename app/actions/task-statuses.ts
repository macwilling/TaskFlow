"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface TaskStatus {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean;
  is_closed: boolean;
  created_at: string;
}

type ActionResult = { error?: string };

const REVALIDATE_PATH = "/app/administration/task-statuses";
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

async function getAdminCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { supabase, tenantId: profile.tenant_id as string };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTaskStatusesAction(): Promise<TaskStatus[]> {
  const ctx = await getAdminCtx();
  if (!ctx) return [];

  const { data } = await ctx.supabase
    .from("task_statuses")
    .select("id, tenant_id, name, color, position, is_default, is_closed, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("position", { ascending: true });

  return (data ?? []) as TaskStatus[];
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTaskStatusAction(
  name: string,
  color: string
): Promise<ActionResult & { id?: string }> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  if (!COLOR_RE.test(color)) return { error: "Invalid color format." };

  // Find max position for this tenant
  const { data: existing } = await ctx.supabase
    .from("task_statuses")
    .select("position")
    .eq("tenant_id", ctx.tenantId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (existing?.position ?? -1) + 1;

  const { data, error } = await ctx.supabase
    .from("task_statuses")
    .insert({
      tenant_id: ctx.tenantId,
      name: trimmed,
      color,
      position: nextPosition,
      is_default: false,
      is_closed: false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}

// ─── Update label / color ─────────────────────────────────────────────────────

export async function updateTaskStatusAction(
  id: string,
  fields: { name?: string; color?: string }
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  const update: Record<string, string> = {};

  if (fields.name !== undefined) {
    const trimmed = fields.name.trim();
    if (!trimmed) return { error: "Name is required." };
    update.name = trimmed;
  }

  if (fields.color !== undefined) {
    if (!COLOR_RE.test(fields.color)) return { error: "Invalid color format." };
    update.color = fields.color;
  }

  if (Object.keys(update).length === 0) return {};

  const { error } = await ctx.supabase
    .from("task_statuses")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId); // RLS redundancy; ensures cross-tenant writes are blocked

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/app/tasks");
  return {};
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

export async function reorderTaskStatusesAction(
  orderedIds: string[]
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  if (orderedIds.length === 0) return {};

  // Verify all IDs belong to this tenant
  const { data: owned } = await ctx.supabase
    .from("task_statuses")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .in("id", orderedIds);

  if (!owned || owned.length !== orderedIds.length) {
    return { error: "Invalid status IDs." };
  }

  // Update positions in parallel
  await Promise.all(
    orderedIds.map((statusId, index) =>
      ctx.supabase
        .from("task_statuses")
        .update({ position: index })
        .eq("id", statusId)
        .eq("tenant_id", ctx.tenantId)
    )
  );

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/app/tasks");
  return {};
}

// ─── Set default ──────────────────────────────────────────────────────────────

export async function setDefaultTaskStatusAction(id: string): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  // Verify status exists and belongs to tenant; check it's not the closed status
  const { data: status } = await ctx.supabase
    .from("task_statuses")
    .select("is_closed")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!status) return { error: "Status not found." };
  if (status.is_closed) return { error: "The closed status cannot be set as the default." };

  // Clear existing default, set new one
  await ctx.supabase
    .from("task_statuses")
    .update({ is_default: false })
    .eq("tenant_id", ctx.tenantId)
    .eq("is_default", true);

  const { error } = await ctx.supabase
    .from("task_statuses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE_PATH);
  return {};
}

// ─── Delete (with task reassignment) ─────────────────────────────────────────

export async function deleteTaskStatusAction(
  statusId: string,
  reassignToStatusId: string
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  // Verify both statuses belong to this tenant
  const { data: statuses } = await ctx.supabase
    .from("task_statuses")
    .select("id, is_closed, is_default")
    .eq("tenant_id", ctx.tenantId)
    .in("id", [statusId, reassignToStatusId]);

  if (!statuses || statuses.length < 2) {
    return { error: "One or both status IDs not found." };
  }

  const toDelete = statuses.find((s) => s.id === statusId);
  if (!toDelete) return { error: "Status to delete not found." };
  if (toDelete.is_closed) return { error: "The closed status cannot be deleted." };
  if (toDelete.is_default) return { error: "Cannot delete the default status. Set another status as default first." };
  if (statusId === reassignToStatusId) return { error: "Cannot reassign to the same status." };

  // Move all tasks using this status to the reassignment target
  const { error: moveError } = await ctx.supabase
    .from("tasks")
    .update({ status_id: reassignToStatusId })
    .eq("status_id", statusId)
    .eq("tenant_id", ctx.tenantId);

  if (moveError) return { error: moveError.message };

  // Delete the status (ON DELETE RESTRICT ensures tasks were moved first)
  const { error: deleteError } = await ctx.supabase
    .from("task_statuses")
    .delete()
    .eq("id", statusId)
    .eq("tenant_id", ctx.tenantId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/app/tasks");
  return {};
}

// ─── Count tasks using a status (for delete confirmation UI) ──────────────────

export async function countTasksForStatusAction(statusId: string): Promise<number> {
  const ctx = await getAdminCtx();
  if (!ctx) return 0;

  const { count } = await ctx.supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status_id", statusId)
    .eq("tenant_id", ctx.tenantId);

  return count ?? 0;
}
