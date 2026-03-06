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
import { CheckCircle2, Eye } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="h-7 text-xs" disabled={pending}>
      {pending ? "Sending…" : "Send invite"}
    </Button>
  );
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PortalAccessSection({
  clientId,
  clientEmail,
  hasAccess,
  acceptedAt,
  invitedAt,
  lastSeenAt,
  portalEmail,
}: {
  clientId: string;
  clientEmail: string | null;
  hasAccess: boolean;
  acceptedAt: string | null;
  invitedAt: string | null;
  lastSeenAt: string | null;
  portalEmail: string | null;
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

  function handleImpersonate() {
    window.open(`/api/portal/impersonate?clientId=${clientId}`, "_blank");
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
            <span>Portal access active</span>
          </div>

          {/* Status details */}
          <dl className="space-y-1">
            {portalEmail && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground text-xs">Login email</dt>
                <dd className="text-foreground text-xs">{portalEmail}</dd>
              </div>
            )}
            {invitedAt && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground text-xs">Invited</dt>
                <dd className="text-foreground text-xs">{formatDate(invitedAt)}</dd>
              </div>
            )}
            {acceptedAt && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-muted-foreground text-xs">First login</dt>
                <dd className="text-foreground text-xs">{formatDate(acceptedAt)}</dd>
              </div>
            )}
            <div className="flex gap-4">
              <dt className="w-28 shrink-0 text-muted-foreground text-xs">Last seen</dt>
              <dd className="text-foreground text-xs">
                {lastSeenAt ? formatDate(lastSeenAt) : "Never"}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Impersonate */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={handleImpersonate}
              disabled={isPending}
            >
              <Eye className="h-3.5 w-3.5" />
              Impersonate
            </Button>

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
            {invitedAt
              ? `Invite sent ${formatDate(invitedAt)} — client has not yet accepted.`
              : "Invite this client to access their portal. They'll receive an email with a magic link to set up their account."}
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
