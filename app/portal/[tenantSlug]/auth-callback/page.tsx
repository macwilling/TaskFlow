import { PortalAuthCallbackClient } from "@/components/portal/PortalAuthCallbackClient";

export default async function PortalAuthCallbackPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <PortalAuthCallbackClient tenantSlug={tenantSlug} />;
}
