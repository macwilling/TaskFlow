import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const { commentId } = await request.json();

  if (!commentId) {
    return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("id, body, tenant_id, tasks(id, title)")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const task = comment.tasks as unknown as { id: string; title: string } | null;
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("email, business_name")
    .eq("tenant_id", comment.tenant_id)
    .single();

  if (!settings?.email) {
    return NextResponse.json({ skipped: true });
  }

  const subject = `New comment on: ${task.title}`;

  const html = `
    <p>A client left a new comment on task <strong>${escapeHtml(task.title)}</strong>:</p>
    <blockquote style="background:#f6f8fa;padding:12px;border-radius:6px;border-left:3px solid #0969da;white-space:pre-line">${escapeHtml(comment.body)}</blockquote>
    <p>— ${escapeHtml(settings.business_name ?? "TaskFlow")}</p>
  `;

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: `${settings.business_name ?? "TaskFlow"} <noreply@${process.env.RESEND_DOMAIN ?? "taskflow.dev"}>`,
    to: settings.email,
    subject,
    html,
  });

  await supabase.from("email_log").insert({
    tenant_id: comment.tenant_id,
    to_email: settings.email,
    subject,
    type: "comment",
    related_id: commentId,
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
