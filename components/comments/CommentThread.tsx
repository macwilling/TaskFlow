"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  createCommentAction,
  updateCommentAction,
  deleteCommentAction,
} from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2 } from "lucide-react";

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
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editError, setEditError] = useState<string | null>(null);
  const isOwn = comment.author_id === currentUserId;

  function handleDelete() {
    if (!confirm("Delete this comment?")) return;
    startTransition(async () => {
      await deleteCommentAction(comment.id, taskId);
    });
  }

  function handleEditSave() {
    setEditError(null);
    startTransition(async () => {
      const result = await updateCommentAction(comment.id, taskId, editBody);
      if (result?.error) {
        setEditError(result.error);
      } else {
        setEditing(false);
      }
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
        {editing ? (
          <div className="space-y-1">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              aria-label="Edit comment"
            />
            {editError && <p className="text-xs text-destructive">{editError}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-6 text-xs"
                onClick={handleEditSave}
                disabled={isPending}
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => {
                  setEditing(false);
                  setEditBody(comment.body);
                  setEditError(null);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-line">{comment.body}</p>
        )}
      </div>
      {isOwn && !editing && (
        <div className="flex items-start gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
            disabled={isPending}
            aria-label="Edit comment"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={isPending}
            aria-label="Delete comment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
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
