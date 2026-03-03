export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="space-y-1.5">
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
        </div>
        <div className="h-7 w-24 rounded bg-muted/50 animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="max-w-4xl space-y-8">
          {/* Meta panel */}
          <div className="grid grid-cols-2 gap-6 rounded-md border border-border bg-muted/20 px-5 py-4">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="h-3 w-28 shrink-0 rounded bg-muted/60 animate-pulse" />
                  <div className="h-5 w-20 rounded-full bg-muted/40 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="h-3 w-28 shrink-0 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* Editors */}
          <div className="space-y-6">
            <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
            <div className="h-24 rounded-md bg-muted/30 animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-24 rounded-md bg-muted/30 animate-pulse" />
          </div>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* Attachments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
              <div className="h-6 w-20 rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="h-12 rounded-md border border-dashed border-border bg-muted/10 animate-pulse" />
          </div>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* Time entries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
              <div className="h-6 w-24 rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="h-20 rounded-md border border-dashed border-border bg-muted/10 animate-pulse" />
          </div>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* Comments */}
          <div className="space-y-3">
            <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
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
        </div>
      </div>
    </>
  );
}
