"use client";

import dynamic from "next/dynamic";
import { useActionState, useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MilkdownEditor = dynamic(
  () => import("@/components/editor/MilkdownEditor"),
  { ssr: false }
);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Submitting…" : "Submit request"}
    </Button>
  );
}

export function PortalCreateTaskDialog() {
  const [state, formAction] = useActionState(createPortalTaskAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset editor when dialog closes
      setDescription("");
      setEditorKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (state && !state.error) {
      formRef.current?.reset();
      setDescription("");
      setEditorKey((k) => k + 1);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          New request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit a new request</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              What do you need help with? <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Update homepage copy"
              autoFocus
              required
            />
          </div>

          {/* Description via Milkdown */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <div className="rounded-md border border-input bg-background overflow-hidden min-h-[140px]">
              <MilkdownEditor
                key={editorKey}
                value=""
                onChange={setDescription}
                placeholder="Add more detail about what you need…"
              />
            </div>
            <input type="hidden" name="description" value={description} readOnly />
          </div>

          {/* Priority + Due date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due date <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
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
