"use client";
import { useActionState, useTransition, useState } from "react";
import {
  sendPortalSignInLinkAction,
  revokePortalAccessAction,
} from "@/app/actions/portal";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Eye } from "lucide-react";

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
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Client Portal Access
      </h2>

      {/* ── Active: client has signed in at least once ── */}
      {hasAccess && acceptedAt ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Portal access active</span>
          </div>

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
            <div className="flex gap-4">
              <dt className="w-28 shrink-0 text-muted-foreground text-xs">First login</dt>
              <dd className="text-foreground text-xs">{formatDate(acceptedAt)}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-28 shrink-0 text-muted-foreground text-xs">Last seen</dt>
              <dd className="text-foreground text-xs">
                {lastSeenAt ? formatDate(lastSeenAt) : "Never"}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 flex-wrap">
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

            {linkState?.success ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Access link sent.
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
                  Resend access link
                </Button>
              </form>
            )}

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
      ) : hasAccess && !acceptedAt ? (
        /* ── Pending: invite sent, client hasn't logged in yet ── */
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4 shrink-0" />
            <span>Awaiting first login</span>
          </div>

          {invitedAt && (
            <p className="text-xs text-muted-foreground">
              Invite sent {formatDate(invitedAt)} — client has not logged in yet.
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {linkState?.success ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Access link sent.
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
                  Resend access link
                </Button>
              </form>
            )}

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
        /* ── Not invited: no portal access row ── */
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {clientEmail
              ? `Grant ${clientEmail} access to the client portal.`
              : "Grant this client access to the client portal."}
          </p>

          {linkState?.success ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Access link sent — invite is pending client login.
            </p>
          ) : (
            <form action={sendLinkAction}>
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs"
                disabled={isPending || !clientEmail}
              >
                Grant portal access
              </Button>
            </form>
          )}

          {linkState?.error && (
            <p className="mt-1.5 text-xs text-destructive">{linkState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
