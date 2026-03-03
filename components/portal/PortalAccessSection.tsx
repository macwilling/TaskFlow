"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteClientToPortalAction } from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="h-7 text-xs" disabled={pending}>
      {pending ? "Sending…" : "Send invite"}
    </Button>
  );
}

export function PortalAccessSection({
  clientId,
  clientEmail,
  hasAccess,
  acceptedAt,
}: {
  clientId: string;
  clientEmail: string | null;
  hasAccess: boolean;
  acceptedAt: string | null;
}) {
  const boundAction = inviteClientToPortalAction.bind(null, clientId);
  const [state, formAction] = useActionState(boundAction, null);

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Client Portal Access
      </h2>

      {hasAccess ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Portal access granted
            {acceptedAt
              ? ` · accepted ${new Date(acceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : ""}
          </span>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Invite this client to access their portal. They&apos;ll receive an email with a
            magic link to set up their account.
          </p>
          {state?.success ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Invite sent successfully.
            </p>
          ) : (
            <form action={formAction} className="flex items-end gap-2 max-w-sm">
              <div className="flex-1 space-y-1">
                <Label htmlFor="portal-invite-email" className="text-xs">
                  Email address
                </Label>
                <Input
                  id="portal-invite-email"
                  name="email"
                  type="email"
                  defaultValue={clientEmail ?? ""}
                  placeholder="client@example.com"
                  className="h-7 text-xs"
                  required
                />
              </div>
              <SubmitButton />
            </form>
          )}
          {state?.error && (
            <p className="mt-1.5 text-xs text-destructive">{state.error}</p>
          )}
        </>
      )}
    </div>
  );
}
