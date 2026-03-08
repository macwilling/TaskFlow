"use client";
import { useActionState, useTransition, useState } from "react";
import {
  sendPortalSignInLinkAction,
  revokePortalAccessAction,
} from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, Lock, Eye } from "lucide-react";

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
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Client Portal
      </h2>
      <Separator className="mb-4" />

      {hasAccess && acceptedAt ? (
        /* ── Active ── */
        <div className="rounded-md border border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Portal access active</p>
              <p className="text-xs text-muted-foreground">
                {portalEmail ?? clientEmail ?? "—"}
                {lastSeenAt ? ` · Last seen ${formatDate(lastSeenAt)}` : " · Never signed in"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1.5"
                onClick={handleImpersonate}
                disabled={isPending}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              {linkState?.success ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 px-2">
                  Link sent
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
                    Resend link
                  </Button>
                </form>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3 px-4 py-2">
            <dl className="flex gap-6 text-xs flex-1">
              {invitedAt && (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Invited</dt>
                  <dd className="text-foreground">{formatDate(invitedAt)}</dd>
                </div>
              )}
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">First login</dt>
                <dd className="text-foreground">{formatDate(acceptedAt)}</dd>
              </div>
            </dl>
            {confirmRevoke ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Revoke access?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 text-xs"
                  disabled={isPending}
                  onClick={handleRevoke}
                >
                  {isPending ? "Revoking…" : "Yes, revoke"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
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
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmRevoke(true)}
              >
                Revoke
              </Button>
            )}
          </div>
        </div>
      ) : hasAccess && !acceptedAt ? (
        /* ── Pending ── */
        <div className="rounded-md border border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Awaiting first login</p>
              <p className="text-xs text-muted-foreground">
                {invitedAt ? `Invite sent ${formatDate(invitedAt)}` : "Invite sent"} · Client hasn&apos;t signed in yet
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {linkState?.success ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 px-2">
                  Link sent
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
                    Resend link
                  </Button>
                </form>
              )}
              {confirmRevoke ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={isPending}
                    onClick={handleRevoke}
                  >
                    {isPending ? "Revoking…" : "Revoke"}
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
                  Revoke
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Not invited ── */
        <div className="rounded-md border border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">No portal access</p>
              <p className="text-xs text-muted-foreground">
                {clientEmail
                  ? `Send ${clientEmail} a sign-in link to grant access.`
                  : "Add a client email address to grant portal access."}
              </p>
            </div>
            {linkState?.success ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 px-2">
                Invite sent
              </p>
            ) : (
              <form action={sendLinkAction}>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={isPending || !clientEmail}
                >
                  Grant access
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {linkState?.error && (
        <p className="mt-2 text-xs text-destructive">{linkState.error}</p>
      )}
    </div>
  );
}
