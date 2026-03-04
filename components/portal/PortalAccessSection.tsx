"use client";
import { useActionState, useTransition, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  inviteClientToPortalAction,
  sendPortalSignInLinkAction,
  revokePortalAccessAction,
} from "@/app/actions/portal";
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
  const boundInvite = inviteClientToPortalAction.bind(null, clientId);
  const [inviteState, inviteFormAction] = useActionState(boundInvite, null);

  const boundSendLink = sendPortalSignInLinkAction.bind(null, clientId);
  const [linkState, sendLinkAction] = useActionState(boundSendLink, null);

  const [isPending, startTransition] = useTransition();
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  function handleRevoke() {
    startTransition(async () => {
      await revokePortalAccessAction(clientId);
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Client Portal Access
      </h2>

      {hasAccess ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Portal access granted
              {acceptedAt
                ? ` · accepted ${new Date(acceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Send sign-in link */}
            {linkState?.success ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Sign-in link sent.
              </span>
            ) : (
              <form action={sendLinkAction}>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={isPending}
                >
                  Send sign-in link
                </Button>
              </form>
            )}

            {/* Revoke access */}
            {confirmRevoke ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Revoke access?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  disabled={isPending}
                  onClick={handleRevoke}
                >
                  {isPending ? "Revoking…" : "Yes, revoke"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={isPending}
                  onClick={() => setConfirmRevoke(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmRevoke(true)}
              >
                Revoke access
              </Button>
            )}
          </div>

          {linkState?.error && (
            <p className="text-xs text-destructive">{linkState.error}</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Invite this client to access their portal. They&apos;ll receive an email with a
            magic link to set up their account.
          </p>
          {inviteState?.success ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Invite sent successfully.
            </p>
          ) : (
            <form action={inviteFormAction} className="flex items-end gap-2 max-w-sm">
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
          {inviteState?.error && (
            <p className="mt-1.5 text-xs text-destructive">{inviteState.error}</p>
          )}
        </>
      )}
    </div>
  );
}
