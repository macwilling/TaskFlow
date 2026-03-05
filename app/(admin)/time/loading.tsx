export default function Loading() {
  return (
    <>
      {/* TopBar skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6 pl-14 md:pl-6">
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded bg-muted/50 animate-pulse" />
          <div className="h-7 w-20 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>

      {/* Calendar placeholder */}
      <div className="p-6">
        <div className="rounded-md border border-border animate-pulse bg-muted/20" style={{ minHeight: 540 }} />
      </div>
    </>
  );
}
