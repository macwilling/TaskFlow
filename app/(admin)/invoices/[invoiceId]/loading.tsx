export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-10 rounded bg-muted/50 animate-pulse" />
          <div className="h-3 w-3 rounded bg-muted/30 animate-pulse" />
          <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 rounded-full bg-muted/50 animate-pulse" />
          <div className="h-7 w-16 rounded bg-muted/40 animate-pulse" />
          <div className="h-7 w-16 rounded bg-muted/40 animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="max-w-3xl space-y-8">

          {/* Meta panel */}
          <div className="grid grid-cols-4 gap-4 text-sm">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2.5 w-12 rounded bg-muted/50 animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted/60 animate-pulse" />
              </div>
            ))}
          </div>

          <div className="h-px bg-border" />

          {/* Line items */}
          <div className="space-y-3">
            <div className="h-2.5 w-20 rounded bg-muted/60 animate-pulse" />
            <div className="rounded-md border border-border overflow-hidden">
              <div className="flex items-center gap-4 h-9 border-b border-border bg-muted/30 px-4">
                <div className="h-2.5 flex-1 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 h-11 border-b border-border last:border-0 px-4"
                >
                  <div className="h-3 flex-1 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-16 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted/50 animate-pulse" />
                </div>
              ))}
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between">
                <div className="h-3.5 w-12 rounded bg-muted animate-pulse" />
                <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Payments */}
          <div className="space-y-3">
            <div className="h-2.5 w-16 rounded bg-muted/60 animate-pulse" />
            <div className="rounded-md border border-border overflow-hidden">
              <div className="flex items-center gap-4 h-9 border-b border-border bg-muted/30 px-4">
                <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
                <div className="h-2.5 flex-1 rounded bg-muted animate-pulse" />
              </div>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 h-11 border-b border-border last:border-0 px-4"
                >
                  <div className="h-3 w-20 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
                  <div className="h-3 flex-1 rounded bg-muted/40 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-9 w-36 rounded-md bg-muted/40 animate-pulse" />
          </div>

        </div>
      </div>
    </>
  );
}
