"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { recordPaymentAction } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RecordPaymentClientProps {
  invoiceId: string;
  paymentMethodOptions: string[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="h-8 text-xs" disabled={pending}>
      {pending ? "Saving…" : "Record Payment"}
    </Button>
  );
}

export function RecordPaymentClient({
  invoiceId,
  paymentMethodOptions,
}: RecordPaymentClientProps) {
  const boundAction = recordPaymentAction.bind(null, invoiceId);
  const [state, dispatch] = useActionState(boundAction, null);

  return (
    <form action={dispatch} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className="h-8 text-xs"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment_date" className="text-xs">Date</Label>
          <Input
            id="payment_date"
            name="payment_date"
            type="date"
            defaultValue={new Date().toISOString().split("T")[0]}
            className="h-8 text-xs"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Method</Label>
          <Select name="payment_method">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodOptions.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <Input id="notes" name="notes" placeholder="Optional" className="h-8 text-xs" />
        </div>
      </div>
      {state?.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}
