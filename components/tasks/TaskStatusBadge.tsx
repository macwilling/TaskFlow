import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TaskStatusShape {
  id: string;
  name: string;
  color: string;
  is_closed: boolean;
}

const PRIORITY_CONFIG = {
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900" },
  high: { label: "High", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900" },
  urgent: { label: "Urgent", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
} as const;

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatusShape | null | undefined;
  className?: string;
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn("text-xs bg-muted text-muted-foreground border-border", className)}>
        —
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("text-xs", className)}
      style={{
        color: status.color,
        borderColor: status.color + "60",
        backgroundColor: status.color + "15",
      }}
    >
      {status.name}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ?? {
    label: priority,
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("text-xs", config.className, className)}>
      {config.label}
    </Badge>
  );
}
