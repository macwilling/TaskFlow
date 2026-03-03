export default function PortalDashboardPage({
  params,
}: {
  params: { tenantSlug: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Portal for <strong>{params.tenantSlug}</strong> — coming in Phase 6a.
      </p>
    </div>
  );
}
