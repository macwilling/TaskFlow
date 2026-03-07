export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="space-y-1">
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-48 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-6 space-y-10">
        {/* Date range filter */}
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <div className="h-3 w-8 rounded bg-muted/50 animate-pulse" />
            <div className="h-9 w-36 rounded-md bg-muted/40 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-4 rounded bg-muted/50 animate-pulse" />
            <div className="h-9 w-36 rounded-md bg-muted/40 animate-pulse" />
          </div>
          <div className="h-9 w-16 rounded-md bg-muted/60 animate-pulse" />
        </div>

        <div className="h-px bg-border" />

        {/* Revenue by client */}
        <div className="space-y-4">
          <div className="h-4 w-36 rounded bg-muted animate-pulse" />
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center gap-4 h-9 border-b border-border bg-muted/30 px-4">
              <div className="h-2.5 flex-1 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 h-10 border-b border-border last:border-0 px-4"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted/60 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-muted/50 animate-pulse" />
                </div>
                <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
                <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Revenue by month */}
        <div className="space-y-4">
          <div className="h-4 w-36 rounded bg-muted animate-pulse" />
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center gap-4 h-9 border-b border-border bg-muted/30 px-4">
              <div className="h-2.5 flex-1 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 h-10 border-b border-border last:border-0 px-4"
              >
                <div className="h-3 flex-1 w-28 rounded bg-muted/50 animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
                <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Unbilled hours */}
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            <div className="h-3 w-72 rounded bg-muted/50 animate-pulse" />
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center gap-4 h-9 border-b border-border bg-muted/30 px-4">
              <div className="h-2.5 flex-1 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-28 rounded bg-muted animate-pulse" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 h-10 border-b border-border last:border-0 px-4"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted/60 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-muted/50 animate-pulse" />
                </div>
                <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
                <div className="h-3 w-28 rounded bg-muted/40 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
