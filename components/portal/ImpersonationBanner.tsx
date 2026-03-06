import Link from "next/link";
import { Eye } from "lucide-react";

export function ImpersonationBanner({ clientName }: { clientName: string }) {
  return (
    <div className="bg-amber-500 dark:bg-amber-600 text-white text-xs font-medium px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span>
          Viewing portal as <strong>{clientName}</strong> — read-only impersonation session
        </span>
      </div>
      <Link
        href="/api/portal/impersonate/end"
        className="underline underline-offset-2 hover:no-underline shrink-0 ml-4"
      >
        Exit impersonation
      </Link>
    </div>
  );
}
