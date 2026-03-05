import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface TopBarProps {
  title?: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}

export function TopBar({ title, description, breadcrumbs, actions }: TopBarProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-background px-6 pl-14 md:pl-6">
      <div className="flex flex-col justify-center min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  {isLast ? (
                    <span className="font-semibold text-foreground truncate">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href ?? "#"}
                      className="text-muted-foreground hover:text-foreground transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        ) : (
          <>
            {title && <h1 className="text-sm font-semibold">{title}</h1>}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
