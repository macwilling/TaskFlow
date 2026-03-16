function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 max-w-3xl">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-28 rounded bg-muted/60 animate-pulse" />
          <div className="h-9 w-full max-w-sm rounded-md bg-muted/40 animate-pulse" />
        </div>
      ))}
      <div className="h-8 w-20 rounded-md bg-muted/60 animate-pulse" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
        <div className="h-3 w-64 rounded bg-muted/50 animate-pulse" />
      </div>
      <FormSkeleton />
    </div>
  );
}
