"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientData {
  id?: string;
  name?: string;
  client_key?: string | null;
  company?: string;
  email?: string;
  phone?: string;
  default_rate?: number | null;
  payment_terms?: number;
  currency?: string;
  color?: string;
  notes?: string;
  billing_address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

interface ClientFormProps {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  client?: ClientData;
  cancelHref: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF"];
const PAYMENT_TERMS = [
  { value: "15", label: "Net 15" },
  { value: "30", label: "Net 30" },
  { value: "45", label: "Net 45" },
  { value: "60", label: "Net 60" },
  { value: "90", label: "Net 90" },
];

export function ClientForm({ action, client, cancelHref }: ClientFormProps) {
  const [state, formAction] = useActionState(action, null);

  const addr = client?.billing_address ?? {};
  const paymentTermsStr = String(client?.payment_terms ?? 30);
  const termOption = PAYMENT_TERMS.find((t) => t.value === paymentTermsStr);

  return (
    <form action={formAction} className="space-y-8 max-w-2xl">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Basic info */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-foreground">Basic information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={client?.name ?? ""}
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client_key">
              Client key <span className="text-destructive">*</span>
            </Label>
            <Input
              id="client_key"
              name="client_key"
              required={!client?.id}
              defaultValue={client?.client_key ?? ""}
              placeholder="AC"
              className="uppercase"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              2–10 letters/digits used as task ID prefix — e.g.{" "}
              <span className="font-mono">AC-1</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              name="company"
              defaultValue={client?.company ?? ""}
              placeholder="Acme Corp"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={client?.email ?? ""}
              placeholder="jane@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={client?.phone ?? ""}
              placeholder="+1 555 000 0000"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Billing */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-foreground">Billing</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="default_rate">Hourly rate</Label>
            <Input
              id="default_rate"
              name="default_rate"
              type="number"
              min="0"
              step="0.01"
              defaultValue={client?.default_rate ?? ""}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Select
              name="currency"
              defaultValue={client?.currency ?? "USD"}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment_terms">Payment terms</Label>
            <Select
              name="payment_terms"
              defaultValue={termOption ? paymentTermsStr : "30"}
            >
              <SelectTrigger id="payment_terms">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Billing address */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-foreground">Billing address</h2>

        <div className="space-y-1.5">
          <Label htmlFor="billing_line1">Address line 1</Label>
          <Input
            id="billing_line1"
            name="billing_line1"
            defaultValue={addr.line1 ?? ""}
            placeholder="123 Main St"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billing_line2">Address line 2</Label>
          <Input
            id="billing_line2"
            name="billing_line2"
            defaultValue={addr.line2 ?? ""}
            placeholder="Suite 100"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="billing_city">City</Label>
            <Input
              id="billing_city"
              name="billing_city"
              defaultValue={addr.city ?? ""}
              placeholder="San Francisco"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing_state">State / Province</Label>
            <Input
              id="billing_state"
              name="billing_state"
              defaultValue={addr.state ?? ""}
              placeholder="CA"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing_postal_code">Postal code</Label>
            <Input
              id="billing_postal_code"
              name="billing_postal_code"
              defaultValue={addr.postal_code ?? ""}
              placeholder="94105"
            />
          </div>
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="billing_country">Country</Label>
          <Input
            id="billing_country"
            name="billing_country"
            defaultValue={addr.country ?? "US"}
            placeholder="US"
          />
        </div>
      </div>

      <Separator />

      {/* Notes + color */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-foreground">Other</h2>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={client?.notes ?? ""}
            placeholder="Internal notes about this client…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="color">
            Calendar color
            <span className="ml-1.5 text-xs text-muted-foreground">(used in time tracking calendar)</span>
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="color"
              name="color"
              type="color"
              defaultValue={client?.color ?? "#0969da"}
              className="h-8 w-14 cursor-pointer rounded border border-border bg-background p-0.5"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton label={client?.id ? "Save changes" : "Create client"} />
        <Button type="button" variant="ghost" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
