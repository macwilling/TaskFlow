import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  backlog: { label: "Backlog", className: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900" },
  in_review: { label: "In Review", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900" },
  closed: { label: "Closed", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900" },
} as const;

const PRIORITY_CONFIG = {
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900" },
  high: { label: "High", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900" },
  urgent: { label: "Urgent", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
} as const;

export function TaskStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ?? {
    label: priority,
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}
