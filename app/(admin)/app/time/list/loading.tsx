export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6 pl-14 md:pl-6">
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        <div className="h-7 w-20 rounded bg-muted/50 animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="p-6 space-y-4">
        {/* Summary + button row */}
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-40 rounded bg-muted/40 animate-pulse" />
          <div className="h-7 w-20 rounded bg-muted/50 animate-pulse" />
        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center gap-4 h-9 border-b border-border bg-muted/30 px-3">
            <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            <div className="h-2.5 flex-1 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 h-11 border-b border-border last:border-0 px-3"
            >
              <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-28 rounded bg-muted/50 animate-pulse" />
                <div className="h-2.5 w-36 rounded bg-muted/40 animate-pulse" />
              </div>
              <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
              <div className="h-3.5 w-10 rounded bg-muted/40 animate-pulse" />
              <div className="h-3 w-8 rounded bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
