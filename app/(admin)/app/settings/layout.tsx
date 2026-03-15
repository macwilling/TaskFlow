import { redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { SettingsNav } from "@/components/settings/SettingsNav";

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
      <div className="flex flex-1 min-h-0">
        <SettingsNav />
        <div className="flex-1 min-w-0 p-6">{children}</div>
      </div>
    </>
  );
}
