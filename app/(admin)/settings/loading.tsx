function FormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
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
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center border-b border-border px-6">
        <div className="space-y-1">
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-56 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-6">
        <div className="space-y-10 max-w-3xl">

          {/* Business info */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-64 rounded bg-muted/50 animate-pulse" />
            </div>
            <FormSkeleton rows={4} />
          </div>

          <div className="h-px bg-border" />

          {/* Branding */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              <div className="h-3 w-52 rounded bg-muted/50 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-md bg-muted/40 animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 w-24 rounded-md bg-muted/40 animate-pulse" />
                <div className="h-3 w-32 rounded bg-muted/30 animate-pulse" />
              </div>
            </div>
            <div className="h-8 w-20 rounded-md bg-muted/60 animate-pulse" />
          </div>

          <div className="h-px bg-border" />

          {/* Invoice settings */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-3 w-56 rounded bg-muted/50 animate-pulse" />
            </div>
            <FormSkeleton rows={3} />
          </div>

          <div className="h-px bg-border" />

          {/* Email templates */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-3 w-52 rounded bg-muted/50 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-muted/60 animate-pulse" />
              <div className="h-24 w-full rounded-md bg-muted/40 animate-pulse" />
            </div>
            <div className="h-8 w-20 rounded-md bg-muted/60 animate-pulse" />
          </div>

          <div className="h-px bg-border" />

          {/* Portal URL */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-3 w-52 rounded bg-muted/50 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
              <div className="h-9 w-full max-w-sm rounded-md bg-muted/40 animate-pulse" />
            </div>
            <div className="h-8 w-20 rounded-md bg-muted/60 animate-pulse" />
          </div>

        </div>
      </div>
    </>
  );
}
