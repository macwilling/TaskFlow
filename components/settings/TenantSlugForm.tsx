"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateTenantSlugAction } from "@/app/actions/settings";

interface Props {
  slug: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function TenantSlugForm({ slug }: Props) {
  const [state, formAction] = useActionState(updateTenantSlugAction, null);
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3000";

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state && !state.error && (
        <Alert>
          <AlertDescription>Slug updated.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="slug">Subdomain slug</Label>
        <div className="flex items-center gap-0">
          <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-border bg-muted px-3 text-sm text-muted-foreground font-mono">
            https://
          </span>
          <Input
            id="slug"
            name="slug"
            defaultValue={slug}
            className="rounded-none font-mono"
            placeholder="my-business"
          />
          <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 border-border bg-muted px-3 text-sm text-muted-foreground font-mono">
            .{baseDomain}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <span className="text-muted-foreground w-28 shrink-0">Admin app</span>
          <span className="font-mono text-xs break-all">https://{slug || "my-business"}.{baseDomain}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground w-28 shrink-0">Client portal</span>
          <span className="font-mono text-xs break-all">https://{slug || "my-business"}.{baseDomain}/portal</span>
        </div>
      </div>

      <Alert variant="destructive" className="border-amber-500/50 bg-amber-50/50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 [&>svg]:text-amber-500">
        <AlertDescription>
          Changing your slug changes your subdomain — update any portal links shared with clients.
        </AlertDescription>
      </Alert>

      <SubmitButton />
    </form>
  );
}
