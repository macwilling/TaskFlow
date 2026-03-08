"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Clock, FileText } from "lucide-react";
import { TimeEntryModal } from "@/components/time/TimeEntryModal";

interface Props {
  clientId: string;
  clientName: string;
  clientKey: string | null;
  clientDefaultRate: number | null;
  tasks: { id: string; title: string; client_id: string; task_number: number | null; status: string }[];
}

export function LogTimeButton({ clientId, clientName, clientKey, clientDefaultRate, tasks }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Clock className="h-3 w-3" />
        Log time
      </Button>
      <TimeEntryModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => router.refresh()}
        clients={[{ id: clientId, name: clientName, color: null, default_rate: clientDefaultRate, client_key: clientKey }]}
        tasks={tasks}
        prefillClientId={clientId}
      />
    </>
  );
}

export function ClientQuickActions({ clientId, clientName, clientKey, clientDefaultRate, tasks }: Props) {
  const router = useRouter();
  const [timeModalOpen, setTimeModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <Link href={`/tasks/new?clientId=${clientId}`}>
            <Plus className="h-3.5 w-3.5" />
            New task
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => setTimeModalOpen(true)}
        >
          <Clock className="h-3.5 w-3.5" />
          Log time
        </Button>
        <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <Link href={`/invoices/new?clientId=${clientId}`}>
            <FileText className="h-3.5 w-3.5" />
            New invoice
          </Link>
        </Button>
      </div>

      <TimeEntryModal
        open={timeModalOpen}
        onOpenChange={setTimeModalOpen}
        onSuccess={() => router.refresh()}
        clients={[{ id: clientId, name: clientName, color: null, default_rate: clientDefaultRate, client_key: clientKey }]}
        tasks={tasks}
        prefillClientId={clientId}
      />
    </>
  );
}
