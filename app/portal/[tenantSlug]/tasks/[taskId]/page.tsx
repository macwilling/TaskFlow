export default function PortalTaskPage({
  params,
}: {
  params: { tenantSlug: string; taskId: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Task {params.taskId} — coming in Phase 6a.
      </p>
    </div>
  );
}
