"use client";

import { useRef } from "react";
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { upload, uploadConfig } from "@milkdown/plugin-upload";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import type { Schema, Node, Fragment } from "@milkdown/prose/model";
import type { Ctx } from "@milkdown/ctx";
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

function buildUploader(uploadPath: string) {
  return async (
    files: FileList,
    schema: Schema,
    _ctx: Ctx,
    _insertPos: number
  ): Promise<Node | Node[] | Fragment> => {
    const nodes: Node[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/upload?path=${encodeURIComponent(uploadPath)}`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) continue;
        const { url } = (await res.json()) as { url: string };
        const imageNode = schema.nodes["image"];
        if (!imageNode) continue;
        const node = imageNode.createAndFill({ src: url, alt: file.name });
        if (node) nodes.push(node);
      } catch {
        // Skip failed uploads silently
      }
    }
    return nodes;
  };
}

function EditorInner({
  value,
  onChange,
  uploadPath,
  readOnly,
}: MilkdownEditorProps) {
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !readOnly,
        }));

        if (onChange) {
          ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
            latestOnChange.current?.(markdown);
          });
        }

        if (uploadPath) {
          ctx.update(uploadConfig.key, (prev) => ({
            ...prev,
            uploader: buildUploader(uploadPath),
          }));
        }
      })
      .use(commonmark)
      .use(history)
      .use(listener);

    if (uploadPath) {
      editor.use(upload);
    }

    return editor;
  });

  return <Milkdown />;
}

export function MilkdownEditor(props: MilkdownEditorProps) {
  const { minHeight = "120px", className } = props;

  return (
    <div
      className={cn(
        "milkdown-wrapper rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        props.readOnly && "bg-muted/30",
        className
      )}
      style={{ minHeight }}
    >
      <MilkdownProvider>
        <EditorInner {...props} />
      </MilkdownProvider>
    </div>
  );
}

// Lazy-loadable version (use this in pages to avoid SSR issues)
export default MilkdownEditor;
