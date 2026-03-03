"use client";

import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { cn } from "@/lib/utils";

interface MilkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  uploadPath?: string;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  className?: string;
}

export function MilkdownEditor({
  value,
  onChange,
  uploadPath,
  placeholder = "Start writing…",
  readOnly = false,
  minHeight = "120px",
  className,
}: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: value,
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: placeholder },
        ...(uploadPath
          ? {
              [Crepe.Feature.ImageBlock]: {
                onUpload: async (file: File) => {
                  const fd = new FormData();
                  fd.append("file", file);
                  const res = await fetch(
                    `/api/upload?path=${encodeURIComponent(uploadPath)}`,
                    { method: "POST", body: fd }
                  );
                  if (!res.ok) return "";
                  const { url } = (await res.json()) as { url: string };
                  return url;
                },
              },
            }
          : {}),
      },
    });

    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        latestOnChange.current?.(markdown);
      });
    });

    crepe.create().then(() => {
      crepe.setReadonly(readOnly);
    });

    crepeRef.current = crepe;

    return () => {
      crepe.destroy();
      crepeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "crepe-editor-wrapper rounded-md border border-input ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        readOnly && "read-only",
        className
      )}
      style={{ minHeight }}
    />
  );
}

// Lazy-loadable version (use this in pages to avoid SSR issues)
export default MilkdownEditor;
