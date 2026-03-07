"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAttachmentAction, saveAttachmentAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Paperclip,
  Trash2,
  Upload,
  File,
  FileText,
  FileArchive,
  FileCode,
  FileVideo,
  FileAudio,
  Download,
  X,
} from "lucide-react";
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

function isImage(mimeType: string | null): boolean {
  return !!mimeType && (
    mimeType.startsWith("image/png") ||
    mimeType.startsWith("image/jpeg") ||
    mimeType.startsWith("image/webp") ||
    mimeType.startsWith("image/gif")
  );
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File className="h-6 w-6 text-muted-foreground" />;
  if (mimeType === "application/pdf") return <FileText className="h-6 w-6 text-red-500" />;
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("tar") || mimeType.includes("gzip")) {
    return <FileArchive className="h-6 w-6 text-yellow-500" />;
  }
  if (mimeType.startsWith("video/")) return <FileVideo className="h-6 w-6 text-purple-500" />;
  if (mimeType.startsWith("audio/")) return <FileAudio className="h-6 w-6 text-blue-500" />;
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("css") || mimeType.includes("xml")) {
    return <FileCode className="h-6 w-6 text-green-500" />;
  }
  return <FileText className="h-6 w-6 text-muted-foreground" />;
}

function truncateFilename(name: string, maxLength = 18): string {
  if (name.length <= maxLength) return name;
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx > 0 && name.length - dotIdx <= 6) {
    const ext = name.slice(dotIdx);
    const base = name.slice(0, maxLength - ext.length - 1);
    return `${base}…${ext}`;
  }
  return name.slice(0, maxLength - 1) + "…";
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  function handleDeleteConfirm() {
    if (!deleteId) return;
    startTransition(async () => {
      await deleteAttachmentAction(deleteId, taskId);
      setDeleteId(null);
    });
  }

  function openLightbox(a: Attachment) {
    setLightboxUrl(a.public_url);
    setLightboxName(a.file_name);
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
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group relative flex flex-col rounded-md border border-border bg-muted/20 overflow-hidden"
            >
              {/* Thumbnail or file icon */}
              <div className="relative h-16 w-full bg-muted/30 flex items-center justify-center overflow-hidden">
                {isImage(a.mime_type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.public_url}
                    alt={a.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileIcon mimeType={a.mime_type} />
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isImage(a.mime_type) && (
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded bg-white/20 text-white hover:bg-white/30 transition-colors"
                      onClick={() => openLightbox(a)}
                      title="Preview"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </button>
                  )}
                  <a
                    href={a.public_url}
                    download={a.file_name}
                    className="flex h-6 w-6 items-center justify-center rounded bg-white/20 text-white hover:bg-white/30 transition-colors"
                    title="Download"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded bg-white/20 text-white hover:bg-red-500/80 transition-colors"
                    onClick={() => setDeleteId(a.id)}
                    disabled={isPending}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Filename + size */}
              <div className="px-1.5 py-1">
                <p
                  className="text-[10px] leading-tight text-foreground truncate"
                  title={a.file_name}
                >
                  {truncateFilename(a.file_name)}
                </p>
                {a.file_size && (
                  <p className="text-[9px] text-muted-foreground">
                    {formatBytes(a.file_size)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this attachment?</DialogTitle>
            <DialogDescription>
              This will permanently remove the file. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteConfirm}
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => { if (!open) setLightboxUrl(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90 border-0">
          <DialogTitle className="sr-only">{lightboxName}</DialogTitle>
          <div className="relative flex items-center justify-center min-h-[60vh]">
            {lightboxUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxUrl}
                alt={lightboxName}
                className="max-h-[85vh] max-w-full object-contain"
              />
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2 text-xs text-white/80">
            {lightboxName}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
