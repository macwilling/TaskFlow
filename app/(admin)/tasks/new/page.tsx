import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";

export default async function NewTaskPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, color")
    .eq("is_archived", false)
    .order("name");

  return (
    <>
      <TopBar title="New task" description="Create a new task for a client." />
      <PageContainer>
        <NewTaskForm clients={clients ?? []} />
      </PageContainer>
    </>
  );
}
