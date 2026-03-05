import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-8">
      <FileQuestion className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
      <div>
        <h1 className="text-base font-semibold">404 — Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link
        href="/"
        className="text-sm text-primary hover:underline"
      >
        Go home
      </Link>
    </div>
  );
}
