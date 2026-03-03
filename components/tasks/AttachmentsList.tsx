"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAttachmentAction, saveAttachmentAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, Upload, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

interface Attachment {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  public_url: string;
  created_at: string;
}

interface AttachmentsListProps {
  taskId: string;
  tenantId: string;
  attachments: Attachment[];
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsList({ taskId, tenantId, attachments }: AttachmentsListProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadPath = `tenant-${tenantId}/tasks/${taskId}/attachments`;
      const res = await fetch(`/api/upload?path=${encodeURIComponent(uploadPath)}`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        setUploadError(error ?? "Upload failed");
        return;
      }

      const { url, key } = await res.json() as { url: string; key: string };

      // Record the attachment in DB via server action
      const saveResult = await saveAttachmentAction({
        taskId,
        tenantId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        r2Key: key,
        publicUrl: url,
      });

      if (saveResult.error) {
        setUploadError(saveResult.error);
        return;
      }

      router.refresh();
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleDelete(attachmentId: string) {
    if (!confirm("Delete this attachment?")) return;
    startTransition(async () => {
      await deleteAttachmentAction(attachmentId, taskId);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Attachments
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2 gap-1"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3 w-3" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <p className="text-xs text-destructive">{uploadError}</p>
      )}

      {attachments.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          No attachments yet
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={a.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-foreground hover:underline"
              >
                {a.file_name}
              </a>
              {a.file_size && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatBytes(a.file_size)}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(a.id)}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
