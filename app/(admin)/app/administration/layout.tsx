import { redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase/server";

export default async function AdministrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();
  if (!user || user.app_metadata?.role !== "admin") redirect("/auth/login");

  return <>{children}</>;
}
