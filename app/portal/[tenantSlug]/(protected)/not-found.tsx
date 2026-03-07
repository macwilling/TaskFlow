import { FileQuestion } from "lucide-react";

export default function PortalNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center p-8">
      <FileQuestion className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
      <div>
        <h2 className="text-base font-semibold">Page not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
    </div>
  );
}
