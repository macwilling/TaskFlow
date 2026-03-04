"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateBusinessInfoAction } from "@/app/actions/settings";

interface Props {
  settings: {
    business_name?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function BusinessInfoForm({ settings }: Props) {
  const [state, formAction] = useActionState(updateBusinessInfoAction, null);

  return (
    <form action={formAction} className="space-y-4 max-w-2xl">
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
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="business_name">Business name</Label>
          <Input
            id="business_name"
            name="business_name"
            defaultValue={settings.business_name ?? ""}
            placeholder="Acme Consulting"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Business email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={settings.email ?? ""}
            placeholder="hello@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={settings.phone ?? ""}
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address_line1">Address line 1</Label>
        <Input
          id="address_line1"
          name="address_line1"
          defaultValue={settings.address_line1 ?? ""}
          placeholder="123 Main St"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address_line2">Address line 2</Label>
        <Input
          id="address_line2"
          name="address_line2"
          defaultValue={settings.address_line2 ?? ""}
          placeholder="Suite 100"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={settings.city ?? ""}
            placeholder="San Francisco"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">State / Province</Label>
          <Input
            id="state"
            name="state"
            defaultValue={settings.state ?? ""}
            placeholder="CA"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postal_code">Postal code</Label>
          <Input
            id="postal_code"
            name="postal_code"
            defaultValue={settings.postal_code ?? ""}
            placeholder="94105"
          />
        </div>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          name="country"
          defaultValue={settings.country ?? "US"}
          placeholder="US"
        />
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
