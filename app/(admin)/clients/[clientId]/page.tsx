import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ArchiveClientButton } from "@/components/clients/ArchiveClientButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, CheckSquare, Clock, FileText } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-4 py-2 text-sm">
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error || !client) notFound();

  const addr = client.billing_address as {
    line1?: string; line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  } | null;

  const billingAddress = [
    addr?.line1, addr?.line2,
    [addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", "),
    addr?.country,
  ].filter(Boolean).join("\n");

  return (
    <>
      <TopBar
        title={client.name}
        description={client.company ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <ArchiveClientButton
              clientId={client.id}
              isArchived={client.is_archived}
            />
            <Button asChild size="sm" className="h-7 gap-1 text-xs">
              <Link href={`/clients/${client.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <PageContainer>
        <div className="space-y-8 max-w-4xl">
          {/* Status */}
          {client.is_archived && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Badge variant="secondary">Archived</Badge>
              <span>This client is archived and hidden from the main list.</span>
            </div>
          )}

          {/* Contact + billing side by side */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </h2>
              <Separator className="mb-3" />
              <dl>
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Phone" value={client.phone} />
                <InfoRow label="Company" value={client.company} />
              </dl>
            </div>

            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Billing
              </h2>
              <Separator className="mb-3" />
              <dl>
                <InfoRow
                  label="Hourly rate"
                  value={
                    client.default_rate != null
                      ? `${client.currency} ${Number(client.default_rate).toFixed(2)}/hr`
                      : undefined
                  }
                />
                <InfoRow
                  label="Payment terms"
                  value={client.payment_terms ? `Net ${client.payment_terms}` : undefined}
                />
                <InfoRow label="Currency" value={client.currency} />
                {billingAddress && (
                  <div className="flex gap-4 py-2 text-sm">
                    <dt className="w-36 shrink-0 text-muted-foreground">Billing address</dt>
                    <dd className="whitespace-pre-line text-foreground">{billingAddress}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <>
              <Separator />
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </h2>
                <p className="text-sm text-foreground whitespace-pre-line">{client.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Placeholder sections */}
          <div className="grid grid-cols-3 gap-4">
            <PlaceholderSection
              icon={<CheckSquare className="h-4 w-4" />}
              label="Tasks"
              description="Available in Phase 3"
            />
            <PlaceholderSection
              icon={<Clock className="h-4 w-4" />}
              label="Time entries"
              description="Available in Phase 4"
            />
            <PlaceholderSection
              icon={<FileText className="h-4 w-4" />}
              label="Invoices"
              description="Available in Phase 5"
            />
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function PlaceholderSection({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-center">
      <div className="flex justify-center text-muted-foreground mb-2">{icon}</div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}
