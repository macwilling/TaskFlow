"use client";

import { useState, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateBrandingAction } from "@/app/actions/settings";

interface Props {
  tenantId: string;
  settings: {
    logo_url?: string | null;
    primary_color?: string | null;
    accent_color?: string | null;
    portal_welcome_message?: string | null;
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

function ColorPicker({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
        />
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#0969da"
          className="w-32 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function BrandingForm({ tenantId, settings }: Props) {
  const [state, formAction] = useActionState(updateBrandingAction, null);
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop() ?? "png";
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/upload?path=tenant-${tenantId}/logo/logo.${ext}`,
        { method: "POST", body: fd }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setLogoUrl(json.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {(state?.error || uploadError) && (
        <Alert variant="destructive">
          <AlertDescription>{state?.error ?? uploadError}</AlertDescription>
        </Alert>
      )}
      {state && !state.error && (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      {/* Logo */}
      <div className="space-y-2">
        <Label>Logo</Label>
        {logoUrl && (
          <div className="mb-2 flex items-center gap-3">
            <div className="relative h-12 w-auto min-w-[48px] overflow-hidden rounded border border-border bg-muted">
              <Image
                src={logoUrl}
                alt="Logo"
                width={120}
                height={48}
                className="h-12 w-auto object-contain"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setLogoUrl("")}
            >
              Remove
            </Button>
          </div>
        )}
        <input type="hidden" name="logo_url" value={logoUrl} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload logo"}
          </Button>
          <span className="text-xs text-muted-foreground">PNG, JPG, SVG — max 20 MB</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoChange}
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-6">
        <ColorPicker
          id="primary_color"
          name="primary_color"
          label="Primary color"
          defaultValue={settings.primary_color ?? "#0969da"}
        />
        <ColorPicker
          id="accent_color"
          name="accent_color"
          label="Accent color"
          defaultValue={settings.accent_color ?? "#0550ae"}
        />
      </div>

      {/* Portal welcome message */}
      <div className="space-y-1.5">
        <Label htmlFor="portal_welcome_message">Portal welcome message</Label>
        <Textarea
          id="portal_welcome_message"
          name="portal_welcome_message"
          rows={3}
          defaultValue={settings.portal_welcome_message ?? ""}
          placeholder="Welcome to your client portal."
        />
        <p className="text-xs text-muted-foreground">
          Shown at the top of the client portal dashboard.
        </p>
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
