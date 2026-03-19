import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./UserMenu";

interface UserMenuAsyncProps {
  userId: string;
  email: string;
}

export async function UserMenuAsync({ userId, email }: UserMenuAsyncProps) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  return <UserMenu email={email} name={profile?.full_name ?? undefined} />;
}
