import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClientForm } from "@/components/clients/ClientForm";
import { createClientAction } from "@/app/actions/clients";

export default function NewClientPage() {
  return (
    <>
      <TopBar title="New client" description="Add a new client to your workspace." />
      <PageContainer>
        <ClientForm action={createClientAction} cancelHref="/clients" />
      </PageContainer>
    </>
  );
}
