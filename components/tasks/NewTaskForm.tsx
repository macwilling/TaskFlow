"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTaskAction } from "@/app/actions/tasks";
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
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  color: string | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="h-8 text-xs">
      {pending ? "Creating…" : "Create task"}
    </Button>
  );
}

export function NewTaskForm({ clients, defaultClientId }: { clients: Client[]; defaultClientId?: string }) {
  const [state, formAction] = useActionState(createTaskAction, null);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
        <Input id="title" name="title" placeholder="Task title" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client_id">Client <span className="text-destructive">*</span></Label>
        <Select name="client_id" required defaultValue={defaultClientId}>
          <SelectTrigger id="client_id" className="h-8 text-sm">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color ?? "#0969da" }}
                  />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue="medium">
            <SelectTrigger id="priority" className="h-8 text-sm">
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
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" name="due_date" type="date" className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="estimated_hours">Estimated hours</Label>
        <Input
          id="estimated_hours"
          name="estimated_hours"
          type="number"
          step="0.5"
          min="0"
          placeholder="0.0"
          className="h-8 text-sm max-w-32"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <SubmitButton />
        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
          <Link href="/tasks">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
