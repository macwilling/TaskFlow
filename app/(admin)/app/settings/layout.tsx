import { redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();
  if (!user || user.app_metadata?.role !== "admin") redirect("/auth/login");

  return (
    <>
      <TopBar title="Settings" />
      <PageContainer>{children}</PageContainer>
    </>
  );
}
