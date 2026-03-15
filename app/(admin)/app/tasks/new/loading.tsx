export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center border-b border-border px-6">
        <div className="space-y-1">
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-44 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>

      {/* Content skeleton — mirrors NewTaskForm layout */}
      <div className="p-6">
        <div className="max-w-xl space-y-5">

          {/* Title */}
          <div className="space-y-1.5">
            <div className="h-3 w-10 rounded bg-muted/60 animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
          </div>

          {/* Client */}
          <div className="space-y-1.5">
            <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <div className="h-3 w-14 rounded bg-muted/60 animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
            <div className="h-9 w-48 rounded-md bg-muted/40 animate-pulse" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <div className="h-8 w-16 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-8 w-24 rounded-md bg-muted/60 animate-pulse" />
          </div>

        </div>
      </div>
    </>
  );
}
