"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { archiveClientAction } from "@/app/actions/clients";
import { Archive, ArchiveRestore } from "lucide-react";

interface ArchiveClientButtonProps {
  clientId: string;
  isArchived: boolean;
}

export function ArchiveClientButton({ clientId, isArchived }: ArchiveClientButtonProps) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      await archiveClientAction(clientId, !isArchived);
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        className="gap-1.5"
      >
        {isArchived ? (
          <>
            <ArchiveRestore className="h-3.5 w-3.5" />
            {pending ? "Restoring…" : "Unarchive"}
          </>
        ) : (
          <>
            <Archive className="h-3.5 w-3.5" />
            {pending ? "Archiving…" : "Archive"}
          </>
        )}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isArchived ? "Unarchive this client?" : "Archive this client?"}
            </DialogTitle>
            <DialogDescription>
              {isArchived
                ? "They will reappear in the active client list."
                : "They will be hidden from the active client list."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={handleConfirm}
            >
              {pending
                ? isArchived ? "Restoring…" : "Archiving…"
                : isArchived ? "Unarchive" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
