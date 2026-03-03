import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserMenu } from "@/components/layout/UserMenu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-background">
        <Sidebar />
        <UserMenu
          email={user.email ?? ""}
          name={profile?.full_name ?? undefined}
        />
      </aside>
      <div className="flex flex-1 flex-col pl-56">{children}</div>
    </div>
  );
}
