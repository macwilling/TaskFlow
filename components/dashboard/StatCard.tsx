import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  subLabel?: string;
  icon?: LucideIcon;
  href?: string;
  variant?: "default" | "warning" | "destructive";
}

export function StatCard({
  label,
  value,
  subLabel,
  icon: Icon,
  href,
  variant = "default",
}: StatCardProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-5",
        href && "transition-colors hover:bg-accent/40 hover:border-border/80",
        variant === "warning" && "border-amber-200 dark:border-amber-900",
        variant === "destructive" && "border-red-200 dark:border-red-900"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 text-muted-foreground/50",
              variant === "warning" && "text-amber-500/70",
              variant === "destructive" && "text-red-500/70"
            )}
          />
        )}
      </div>
      <div>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight",
            variant === "warning" && "text-amber-700 dark:text-amber-400",
            variant === "destructive" && "text-red-700 dark:text-red-400"
          )}
        >
          {value}
        </p>
        {subLabel && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subLabel}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export function StatCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border bg-card p-5 flex flex-col gap-3"
        >
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-7 w-20 rounded bg-muted" />
          <div className="h-2.5 w-32 rounded bg-muted" />
        </div>
      ))}
    </>
  );
}
