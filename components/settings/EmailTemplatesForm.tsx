"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { updateEmailTemplatesAction } from "@/app/actions/settings";

interface Props {
  settings: {
    email_sender_name?: string | null;
    email_reply_to?: string | null;
    email_task_closed_subject?: string | null;
    email_task_closed_body?: string | null;
    email_invoice_subject?: string | null;
    email_invoice_body?: string | null;
    email_comment_subject?: string | null;
    email_comment_body?: string | null;
    email_signature?: string | null;
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

function TemplateGroup({
  title,
  subjectName,
  bodyName,
  subjectDefault,
  bodyDefault,
  subjectPlaceholder,
  bodyPlaceholder,
  variableHints,
}: {
  title: string;
  subjectName: string;
  bodyName: string;
  subjectDefault: string;
  bodyDefault: string;
  subjectPlaceholder: string;
  bodyPlaceholder: string;
  variableHints: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-1.5">
        <Label htmlFor={subjectName}>Subject</Label>
        <Input
          id={subjectName}
          name={subjectName}
          defaultValue={subjectDefault}
          placeholder={subjectPlaceholder}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={bodyName}>Body</Label>
        <Textarea
          id={bodyName}
          name={bodyName}
          rows={5}
          defaultValue={bodyDefault}
          placeholder={bodyPlaceholder}
        />
        <p className="text-xs text-muted-foreground">
          Available variables: {variableHints}
        </p>
      </div>
    </div>
  );
}

export function EmailTemplatesForm({ settings }: Props) {
  const [state, formAction] = useActionState(updateEmailTemplatesAction, null);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state && !state.error && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      {/* Sender */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email_sender_name">Sender name</Label>
          <Input
            id="email_sender_name"
            name="email_sender_name"
            defaultValue={settings.email_sender_name ?? ""}
            placeholder="Your business name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email_reply_to">Reply-to address</Label>
          <Input
            id="email_reply_to"
            name="email_reply_to"
            type="email"
            defaultValue={settings.email_reply_to ?? ""}
            placeholder="hello@example.com"
          />
        </div>
      </div>

      <Separator />

      <TemplateGroup
        title="Task closed"
        subjectName="email_task_closed_subject"
        bodyName="email_task_closed_body"
        subjectDefault={settings.email_task_closed_subject ?? ""}
        bodyDefault={settings.email_task_closed_body ?? ""}
        subjectPlaceholder="Your task has been completed"
        bodyPlaceholder="Hi, your task '{{task_title}}' has been completed…"
        variableHints="{{task_title}}, {{resolution_notes}}, {{portal_link}}"
      />

      <Separator />

      <TemplateGroup
        title="Invoice"
        subjectName="email_invoice_subject"
        bodyName="email_invoice_body"
        subjectDefault={settings.email_invoice_subject ?? ""}
        bodyDefault={settings.email_invoice_body ?? ""}
        subjectPlaceholder="Invoice {{invoice_number}} from {{business_name}}"
        bodyPlaceholder="Please find attached invoice {{invoice_number}}…"
        variableHints="{{invoice_number}}, {{business_name}}, {{amount_due}}, {{due_date}}"
      />

      <Separator />

      <TemplateGroup
        title="Comment notification"
        subjectName="email_comment_subject"
        bodyName="email_comment_body"
        subjectDefault={settings.email_comment_subject ?? ""}
        bodyDefault={settings.email_comment_body ?? ""}
        subjectPlaceholder="New comment on your task"
        bodyPlaceholder="A new comment has been posted on task '{{task_title}}'…"
        variableHints="{{task_title}}, {{comment_author}}, {{portal_link}}"
      />

      <Separator />

      {/* Signature */}
      <div className="space-y-1.5">
        <Label htmlFor="email_signature">Email signature</Label>
        <Textarea
          id="email_signature"
          name="email_signature"
          rows={4}
          defaultValue={settings.email_signature ?? ""}
          placeholder="Best regards,&#10;Your Name"
        />
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
