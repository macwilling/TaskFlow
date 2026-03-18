import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClientForm } from "@/components/clients/ClientForm";
import { updateClientAction } from "@/app/actions/clients";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientKey: string }>;
}) {
  const { clientKey } = await params;
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("client_key", clientKey)
    .single();

  if (error || !client) notFound();

  // Bind the UUID into the action (URL uses client_key, mutation uses UUID)
  const action = updateClientAction.bind(null, client.id);

  return (
    <>
      <TopBar
        title={client.name}
        description={client.company ?? "Edit client"}
      />
      <PageContainer>
        <ClientForm
          action={action}
          client={client}
          cancelHref={`/app/clients/${clientKey}`}
        />
      </PageContainer>
    </>
  );
}
