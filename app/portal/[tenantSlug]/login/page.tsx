export default function PortalLoginPage({
  params,
}: {
  params: { tenantSlug: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-4 px-4">
        <h1 className="text-xl font-semibold">Client Portal</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to {params.tenantSlug} — coming in Phase 6a.
        </p>
      </div>
    </div>
  );
}
