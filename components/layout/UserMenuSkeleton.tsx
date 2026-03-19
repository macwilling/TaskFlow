interface UserMenuSkeletonProps {
  email: string;
}

export function UserMenuSkeleton({ email }: UserMenuSkeletonProps) {
  return (
    <div className="border-t border-border p-3">
      <div className="mb-2 px-1">
        <div className="mb-1 h-3 w-24 rounded bg-muted animate-pulse" />
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      {/* ThemeToggle + sign-out button placeholders */}
      <div className="h-8 w-full rounded-md bg-muted/40 animate-pulse" />
    </div>
  );
}
