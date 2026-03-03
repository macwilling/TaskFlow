"use client";

import { useActionState, useRef, useTransition } from "react";
import { createCommentAction, deleteCommentAction } from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  author_role: string;
  author_id: string;
  created_at: string;
}

interface CommentThreadProps {
  taskId: string;
  currentUserId: string;
  comments: Comment[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CommentRow({
  comment,
  taskId,
  currentUserId,
}: {
  comment: Comment;
  taskId: string;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isOwn = comment.author_id === currentUserId;

  function handleDelete() {
    if (!confirm("Delete this comment?")) return;
    startTransition(async () => {
      await deleteCommentAction(comment.id, taskId);
    });
  }

  return (
    <div className="flex gap-3 py-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase text-white"
        style={{ backgroundColor: comment.author_role === "admin" ? "#0969da" : "#6e40c9" }}
      >
        {comment.author_role === "admin" ? "A" : "C"}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-foreground capitalize">
            {comment.author_role}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(comment.created_at)}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-line">{comment.body}</p>
      </div>
      {isOwn && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 self-start text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function CommentForm({ taskId }: { taskId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const boundAction = createCommentAction.bind(null, taskId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
      }}
      className="space-y-2"
    >
      <Textarea
        name="body"
        placeholder="Leave a comment…"
        rows={3}
        className="resize-none"
        required
      />
      {state?.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={isPending}>
          {isPending ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}

export function CommentThread({ taskId, currentUserId, comments }: CommentThreadProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Comments ({comments.length})
      </h3>

      {comments.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border px-3">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              taskId={taskId}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      <CommentForm taskId={taskId} />
    </div>
  );
}
