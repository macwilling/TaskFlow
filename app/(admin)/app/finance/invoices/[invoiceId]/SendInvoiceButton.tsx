"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendInvoiceAction } from "@/app/actions/invoices";
import { Send } from "lucide-react";

export function SendInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    startTransition(async () => {
      await sendInvoiceAction(invoiceId);
    });
  }

  return (
    <Button
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={handleSend}
      disabled={isPending}
    >
      <Send className="h-3.5 w-3.5" />
      {isPending ? "Sending…" : "Send"}
    </Button>
  );
}
