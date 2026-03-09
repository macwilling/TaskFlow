"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createPortalTaskAction } from "@/app/actions/portal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Submitting…" : "Submit request"}
    </Button>
  );
}

export function PortalCreateTaskDialog({ tenantSlug }: { tenantSlug: string }) {
  const action = createPortalTaskAction.bind(null, tenantSlug);
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form on successful submission (redirect handles navigation,
  // but reset here in case the redirect is slow)
  useEffect(() => {
    if (!state?.error) formRef.current?.reset();
  }, [state]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          New request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit a new request</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">What do you need help with?</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Update homepage copy"
              autoFocus
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
