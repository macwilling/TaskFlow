export default function Loading() {
  return (
    <div className="flex flex-1 min-h-0">
      {/* Secondary nav skeleton */}
      <div className="w-40 shrink-0 border-r border-border py-4 px-2 space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 rounded-md bg-muted/50 animate-pulse" />
        ))}
      </div>

      {/* Form area skeleton */}
      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        <div className="space-y-1">
          <div className="h-4 w-40 rounded bg-muted animate-pulse" />
          <div className="h-3 w-64 rounded bg-muted/50 animate-pulse" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-muted/60 animate-pulse" />
            <div className="h-9 w-full max-w-sm rounded-md bg-muted/40 animate-pulse" />
          </div>
        ))}
        <div className="h-8 w-20 rounded-md bg-muted/60 animate-pulse" />
      </div>
    </div>
  );
}
