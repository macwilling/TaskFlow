export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        <div className="h-7 w-20 rounded bg-muted/50 animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="p-6 space-y-4">
        {/* Filter row */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-48 rounded bg-muted/40 animate-pulse" />
          <div className="h-7 w-64 rounded bg-muted/40 animate-pulse" />
        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden">
          {/* thead */}
          <div className="flex items-center gap-4 h-9 border-b border-border bg-muted/30 px-4">
            <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
            <div className="h-2.5 flex-1 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
          </div>
          {/* tbody rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 h-11 border-b border-border last:border-0 px-4"
            >
              <div className="h-4 w-12 rounded bg-muted/60 animate-pulse font-mono" />
              <div className="h-3.5 flex-1 rounded bg-muted/50 animate-pulse" />
              <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-muted/40 animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-muted/40 animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
