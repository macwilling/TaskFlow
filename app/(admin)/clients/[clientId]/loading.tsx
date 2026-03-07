export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="space-y-1">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-20 rounded bg-muted/40 animate-pulse" />
          <div className="h-7 w-16 rounded bg-muted/60 animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="space-y-8 max-w-4xl">

          {/* Contact + billing grid */}
          <div className="grid grid-cols-2 gap-8">
            {[1, 2].map((col) => (
              <div key={col} className="space-y-3">
                <div className="h-2.5 w-16 rounded bg-muted/60 animate-pulse" />
                <div className="h-px bg-border" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 py-1">
                    <div className="h-3 w-28 shrink-0 rounded bg-muted/50 animate-pulse" />
                    <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="h-px bg-border" />

          {/* Quick actions */}
          <div className="space-y-3">
            <div className="h-2.5 w-24 rounded bg-muted/60 animate-pulse" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-28 rounded-md bg-muted/40 animate-pulse" />
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Active tasks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-24 rounded bg-muted/60 animate-pulse" />
              <div className="h-5 w-14 rounded bg-muted/30 animate-pulse" />
            </div>
            <div className="h-px bg-border" />
            <div className="divide-y divide-border rounded-md border border-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-3.5 flex-1 rounded bg-muted/50 animate-pulse" />
                  <div className="h-5 w-14 rounded-full bg-muted/40 animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-muted/40 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted/30 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Time summary */}
          <div className="space-y-3">
            <div className="h-2.5 w-24 rounded bg-muted/60 animate-pulse" />
            <div className="h-px bg-border" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-md border border-border p-4 space-y-1.5">
                  <div className="h-2.5 w-20 rounded bg-muted/50 animate-pulse" />
                  <div className="h-6 w-14 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Invoice history */}
          <div className="space-y-3">
            <div className="h-2.5 w-28 rounded bg-muted/60 animate-pulse" />
            <div className="h-px bg-border" />
            <div className="divide-y divide-border rounded-md border border-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-3.5 w-20 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 flex-1 w-24 rounded bg-muted/40 animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-muted/40 animate-pulse" />
                  <div className="h-3.5 w-20 rounded bg-muted/50 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Portal access */}
          <div className="space-y-3">
            <div className="h-2.5 w-28 rounded bg-muted/60 animate-pulse" />
            <div className="h-px bg-border" />
            <div className="h-12 rounded-md border border-border bg-muted/20 animate-pulse" />
          </div>

        </div>
      </div>
    </>
  );
}
