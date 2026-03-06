import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { SidebarShell } from "@/components/layout/SidebarShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, supabase] = await Promise.all([getCachedUser(), createClient()]);

  if (!user || user.app_metadata?.role !== "admin") {
    redirect("/auth/login");
  }

  // Fetch the profile for display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <SidebarShell
      sidebar={<Sidebar />}
      userMenu={
        <UserMenu
          email={user.email ?? ""}
          name={profile?.full_name ?? undefined}
        />
      }
    >
      {children}
    </SidebarShell>
  );
}
