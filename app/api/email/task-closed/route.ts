import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const { taskId } = await request.json();

  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch task + client + tenant info
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(`
      id, title, resolution_notes,
      clients (
        name, email,
        tenants (
          id, name, slug
        )
      )
    `)
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const client = task.clients as unknown as {
    name: string;
    email: string | null;
    tenants: { id: string; name: string; slug: string } | null;
  } | null;

  if (!client?.email) {
    // No email on file — skip silently
    return NextResponse.json({ skipped: true });
  }

  const tenant = client.tenants;
  const portalLink = tenant
    ? `${process.env.NEXT_PUBLIC_APP_URL}/portal/${tenant.slug}`
    : null;

  const subject = `Your task has been completed: ${task.title}`;

  const resolutionHtml = task.resolution_notes
    ? `<p><strong>Resolution notes:</strong></p><div style="background:#f6f8fa;padding:12px;border-radius:6px;white-space:pre-line">${escapeHtml(task.resolution_notes)}</div>`
    : "";

  const portalHtml = portalLink
    ? `<p><a href="${portalLink}" style="color:#0969da">View your portal →</a></p>`
    : "";

  const html = `
    <p>Hi ${escapeHtml(client.name)},</p>
    <p>Your task <strong>${escapeHtml(task.title)}</strong> has been marked as complete.</p>
    ${resolutionHtml}
    ${portalHtml}
    <p>— ${escapeHtml(tenant?.name ?? "Your consultant")}</p>
  `;

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: `${tenant?.name ?? "TaskFlow"} <noreply@${process.env.RESEND_DOMAIN ?? "taskflow.dev"}>`,
    to: client.email,
    subject,
    html,
  });

  // Log the email attempt
  await supabase.from("email_log").insert({
    tenant_id: tenant?.id,
    to_email: client.email,
    subject,
    type: "task_closed",
    related_id: taskId,
    resend_id: sendData?.id ?? null,
    status: sendError ? "failed" : "sent",
    error_message: sendError?.message ?? null,
  });

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
