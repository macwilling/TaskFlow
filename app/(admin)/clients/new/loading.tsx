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

      {/* Content skeleton — mirrors ClientForm layout */}
      <div className="p-6">
        <div className="space-y-8 max-w-2xl">

          {/* Basic info */}
          <div className="space-y-4">
            <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
                  <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Billing info */}
          <div className="space-y-4">
            <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
                  <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Notes */}
          <div className="space-y-4">
            <div className="h-3.5 w-12 rounded bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
              <div className="h-24 w-full rounded-md bg-muted/40 animate-pulse" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-9 w-28 rounded-md bg-muted/60 animate-pulse" />
          </div>

        </div>
      </div>
    </>
  );
}
