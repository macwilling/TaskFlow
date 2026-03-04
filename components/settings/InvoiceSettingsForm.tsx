"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateInvoiceSettingsAction } from "@/app/actions/settings";

interface Props {
  settings: {
    invoice_number_prefix?: string | null;
    invoice_number_next?: number | null;
    default_payment_terms?: number | null;
    default_currency?: string | null;
    default_tax_rate?: number | null;
    tax_label?: string | null;
    payment_method_options?: string[] | null;
  };
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function InvoiceSettingsForm({ settings }: Props) {
  const [state, formAction] = useActionState(updateInvoiceSettingsAction, null);
  const [methods, setMethods] = useState<string[]>(
    settings.payment_method_options ?? ["Check", "ACH", "Wire", "Credit Card", "Other"]
  );
  const [newMethod, setNewMethod] = useState("");

  function addMethod() {
    const trimmed = newMethod.trim();
    if (trimmed && !methods.includes(trimmed)) {
      setMethods([...methods, trimmed]);
    }
    setNewMethod("");
  }

  function removeMethod(m: string) {
    setMethods(methods.filter((x) => x !== m));
  }

  // stored as 0–1 decimal; display as 0–100 percentage
  const taxRatePct = settings.default_tax_rate != null
    ? (settings.default_tax_rate * 100).toFixed(4).replace(/\.?0+$/, "")
    : "0";

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state && !state.error && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="invoice_number_prefix">Invoice number prefix</Label>
          <Input
            id="invoice_number_prefix"
            name="invoice_number_prefix"
            defaultValue={settings.invoice_number_prefix ?? "INV-"}
            placeholder="INV-"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice_number_next">Next invoice number</Label>
          <Input
            id="invoice_number_next"
            name="invoice_number_next"
            type="number"
            min="1"
            step="1"
            defaultValue={settings.invoice_number_next ?? 1001}
          />
          <p className="text-xs text-muted-foreground">
            The sequence counter for the next invoice.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="default_payment_terms">Default payment terms (days)</Label>
          <Input
            id="default_payment_terms"
            name="default_payment_terms"
            type="number"
            min="0"
            step="1"
            defaultValue={settings.default_payment_terms ?? 30}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="default_currency">Default currency</Label>
          <Select
            name="default_currency"
            defaultValue={settings.default_currency ?? "USD"}
          >
            <SelectTrigger id="default_currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tax_label">Tax label</Label>
          <Input
            id="tax_label"
            name="tax_label"
            defaultValue={settings.tax_label ?? "Tax"}
            placeholder="Tax"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="default_tax_rate">Default tax rate (%)</Label>
          <Input
            id="default_tax_rate"
            name="default_tax_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={taxRatePct}
            placeholder="0"
          />
        </div>
      </div>

      {/* Payment methods tag input */}
      <div className="space-y-2">
        <Label>Payment method options</Label>
        <input
          type="hidden"
          name="payment_method_options"
          value={JSON.stringify(methods)}
        />
        <div className="flex flex-wrap gap-1.5">
          {methods.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium"
            >
              {m}
              <button
                type="button"
                onClick={() => removeMethod(m)}
                className="ml-0.5 rounded text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${m}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMethod();
              }
            }}
            placeholder="Add option…"
            className="max-w-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={addMethod}>
            Add
          </Button>
        </div>
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
