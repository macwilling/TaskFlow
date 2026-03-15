export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />

      {/* Title + badges */}
      <div className="space-y-2">
        <div className="h-5 w-64 rounded bg-muted animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 rounded-full bg-muted/50 animate-pulse" />
          <div className="h-5 w-14 rounded-full bg-muted/40 animate-pulse" />
        </div>
      </div>

      {/* Meta panel */}
      <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-muted/20 px-5 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-3 w-20 shrink-0 rounded bg-muted/50 animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Description */}
      <div className="space-y-2">
        <div className="h-2.5 w-20 rounded bg-muted/60 animate-pulse" />
        <div className="h-16 rounded-md bg-muted/30 animate-pulse" />
      </div>

      <div className="h-px bg-border" />

      {/* Comments */}
      <div className="space-y-3">
        <div className="h-2.5 w-20 rounded bg-muted/60 animate-pulse" />
        <div className="divide-y divide-border rounded-md border border-border">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 px-3 py-3">
              <div className="h-7 w-7 shrink-0 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3.5 w-full rounded bg-muted/60 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-20 rounded-md border border-border bg-muted/10 animate-pulse" />
      </div>

      <div className="h-px bg-border" />

      {/* Activity log */}
      <div className="space-y-3">
        <div className="h-2.5 w-16 rounded bg-muted/60 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="h-5 w-5 rounded-full bg-muted/40 animate-pulse shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="h-3 w-48 rounded bg-muted/40 animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-muted/30 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
