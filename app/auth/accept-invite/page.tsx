import { redirect } from "next/navigation";

// This route was used by the old Supabase inviteUserByEmail flow which has
// been replaced by the OTP magic-link flow. Incoming requests are redirected
// to the login page.
export default function AcceptInvitePage() {
  redirect("/auth/login");
}
