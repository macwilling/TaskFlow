import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClientForm } from "@/components/clients/ClientForm";
import { updateClientAction } from "@/app/actions/clients";

export default async function EditClientPage({
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

  // Bind the clientId into the action
  const action = updateClientAction.bind(null, clientId);

  return (
    <>
      <TopBar
        title={`Edit — ${client.name}`}
        description="Update client information."
      />
      <PageContainer>
        <ClientForm
          action={action}
          client={client}
          cancelHref={`/clients/${clientId}`}
        />
      </PageContainer>
    </>
  );
}
