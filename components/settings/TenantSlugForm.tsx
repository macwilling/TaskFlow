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
  appUrl: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function TenantSlugForm({ slug, appUrl }: Props) {
  const [state, formAction] = useActionState(updateTenantSlugAction, null);

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
        <Label htmlFor="slug">Portal URL slug</Label>
        <div className="flex items-center gap-0">
          <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-border bg-muted px-3 text-sm text-muted-foreground">
            {appUrl}/portal/
          </span>
          <Input
            id="slug"
            name="slug"
            defaultValue={slug}
            className="rounded-l-none font-mono"
            placeholder="my-business"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      <Alert variant="destructive" className="border-amber-500/50 bg-amber-50/50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 [&>svg]:text-amber-500">
        <AlertDescription>
          Changing your slug will break existing portal bookmarks and shared links.
        </AlertDescription>
      </Alert>

      <SubmitButton />
    </form>
  );
}
