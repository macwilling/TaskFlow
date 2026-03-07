export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="space-y-1.5">
        <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        <div className="h-3.5 w-64 rounded bg-muted/50 animate-pulse" />
      </div>

      {/* Task list */}
      <div className="divide-y divide-border rounded-md border border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 space-y-1">
              <div className="h-3.5 w-48 rounded bg-muted/60 animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-5 w-14 rounded-full bg-muted/40 animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-muted/40 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
