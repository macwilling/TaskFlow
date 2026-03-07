export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center border-b border-border px-6">
        <div className="space-y-1">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-3 w-48 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>

      {/* Content skeleton — mirrors InvoiceBuilderClient layout */}
      <div className="p-6">
        <div className="space-y-6 max-w-3xl">

          {/* Header row: client selector + invoice number */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-muted/60 animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
              <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Line items table */}
          <div className="space-y-2">
            <div className="flex items-center gap-4 h-8 rounded-t-md bg-muted/30 px-4">
              <div className="h-2.5 flex-1 rounded bg-muted/60 animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-muted/60 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-muted/60 animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-muted/60 animate-pulse" />
              <div className="w-8" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2">
                <div className="h-8 flex-1 rounded-md bg-muted/40 animate-pulse" />
                <div className="h-8 w-16 rounded-md bg-muted/40 animate-pulse" />
                <div className="h-8 w-20 rounded-md bg-muted/40 animate-pulse" />
                <div className="h-8 w-24 rounded-md bg-muted/30 animate-pulse" />
                <div className="h-6 w-6 rounded bg-muted/30 animate-pulse" />
              </div>
            ))}
            <div className="px-4">
              <div className="h-8 w-28 rounded-md bg-muted/30 animate-pulse" />
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Totals + memo */}
          <div className="flex justify-between gap-8">
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
              <div className="h-20 w-full rounded-md bg-muted/40 animate-pulse" />
            </div>
            <div className="w-64 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-16 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-muted/50 animate-pulse" />
                </div>
              ))}
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2">
            <div className="h-9 w-24 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-9 w-28 rounded-md bg-muted/60 animate-pulse" />
          </div>

        </div>
      </div>
    </>
  );
}
