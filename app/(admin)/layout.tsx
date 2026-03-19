import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserMenuAsync } from "@/components/layout/UserMenuAsync";
import { UserMenuSkeleton } from "@/components/layout/UserMenuSkeleton";
import { SidebarShell } from "@/components/layout/SidebarShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();

  if (!user || user.app_metadata?.role !== "admin") {
    redirect("/auth/login");
  }

  const email = user.email ?? "";

  return (
    <SidebarShell
      sidebar={<Sidebar />}
      userMenu={
        <Suspense fallback={<UserMenuSkeleton email={email} />}>
          <UserMenuAsync userId={user.id} email={email} />
        </Suspense>
      }
    >
      {children}
    </SidebarShell>
  );
}
