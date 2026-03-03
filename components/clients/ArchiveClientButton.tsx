"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { archiveClientAction } from "@/app/actions/clients";
import { Archive, ArchiveRestore } from "lucide-react";

interface ArchiveClientButtonProps {
  clientId: string;
  isArchived: boolean;
}

export function ArchiveClientButton({ clientId, isArchived }: ArchiveClientButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const confirmed = window.confirm(
      isArchived
        ? "Unarchive this client? They will reappear in the active client list."
        : "Archive this client? They will be hidden from the active client list."
    );
    if (!confirmed) return;

    startTransition(async () => {
      await archiveClientAction(clientId, !isArchived);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={handleClick}
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
  );
}
