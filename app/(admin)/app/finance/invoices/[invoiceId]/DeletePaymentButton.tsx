"use client";

import { useTransition } from "react";
import { deletePaymentAction } from "@/app/actions/invoices";
import { Trash2 } from "lucide-react";

export function DeletePaymentButton({
  paymentId,
  invoiceId,
}: {
  paymentId: string;
  invoiceId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deletePaymentAction(paymentId, invoiceId);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
      title="Delete payment"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
