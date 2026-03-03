import { ReactNode } from "react";

interface TopBarProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function TopBar({ title, description, actions }: TopBarProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex flex-col justify-center">
        <h1 className="text-sm font-semibold">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
