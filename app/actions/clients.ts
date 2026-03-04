"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ClientFields {
  name: string;
  client_key: string;
  company: string;
  email: string;
  phone: string;
  default_rate: string;
  payment_terms: string;
  currency: string;
  color: string;
  notes: string;
  billing_line1: string;
  billing_line2: string;
  billing_city: string;
  billing_state: string;
  billing_postal_code: string;
  billing_country: string;
}

const CLIENT_KEY_RE = /^[A-Z0-9]{2,10}$/;

function validateClientKey(key: string): string | null {
  const normalized = key.trim().toUpperCase();
  if (!normalized) return "Client key is required.";
  if (!CLIENT_KEY_RE.test(normalized)) {
    return "Client key must be 2–10 uppercase letters or digits (e.g. AC, ACME).";
  }
  return null;
}

function buildClientPayload(fields: ClientFields) {
  return {
    name: fields.name.trim(),
    client_key: fields.client_key.trim().toUpperCase() || null,
    company: fields.company.trim() || null,
    email: fields.email.trim() || null,
    phone: fields.phone.trim() || null,
    default_rate: fields.default_rate ? parseFloat(fields.default_rate) : null,
    payment_terms: fields.payment_terms ? parseInt(fields.payment_terms) : 30,
    currency: fields.currency || "USD",
    color: fields.color || "#0969da",
    notes: fields.notes.trim() || null,
    billing_address: {
      line1: fields.billing_line1.trim() || null,
      line2: fields.billing_line2.trim() || null,
      city: fields.billing_city.trim() || null,
      state: fields.billing_state.trim() || null,
      postal_code: fields.billing_postal_code.trim() || null,
      country: fields.billing_country.trim() || null,
    },
  };
}

export async function createClientAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const keys = [
    "name", "client_key", "company", "email", "phone", "default_rate", "payment_terms",
    "currency", "color", "notes", "billing_line1", "billing_line2",
    "billing_city", "billing_state", "billing_postal_code", "billing_country",
  ] as const;
  const fields = Object.fromEntries(
    keys.map((k) => [k, (formData.get(k) as string) ?? ""])
  ) as unknown as ClientFields;

  if (!fields.name.trim()) return { error: "Client name is required." };

  const keyError = validateClientKey(fields.client_key);
  if (keyError) return { error: keyError };

  const { data, error } = await supabase
    .from("clients")
    .insert({ tenant_id: profile.tenant_id, ...buildClientPayload(fields) })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(
  clientId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const keys = [
    "name", "client_key", "company", "email", "phone", "default_rate", "payment_terms",
    "currency", "color", "notes", "billing_line1", "billing_line2",
    "billing_city", "billing_state", "billing_postal_code", "billing_country",
  ] as const;
  const fields = Object.fromEntries(
    keys.map((k) => [k, (formData.get(k) as string) ?? ""])
  ) as unknown as ClientFields;

  if (!fields.name.trim()) return { error: "Client name is required." };

  if (fields.client_key.trim()) {
    const keyError = validateClientKey(fields.client_key);
    if (keyError) return { error: keyError };
  }

  // Fetch current email before update to detect changes
  const { data: existing } = await supabase
    .from("clients")
    .select("email")
    .eq("id", clientId)
    .single();

  const { error } = await supabase
    .from("clients")
    .update(buildClientPayload(fields))
    .eq("id", clientId);

  if (error) return { error: error.message };

  // Sync auth user email if it changed and client has portal access
  const newEmail = fields.email.trim();
  if (existing && existing.email !== newEmail && newEmail) {
    const admin = createAdminClient();
    const { data: access } = await admin
      .from("client_portal_access")
      .select("user_id")
      .eq("client_id", clientId)
      .single();
    if (access?.user_id) {
      await admin.auth.admin.updateUserById(access.user_id as string, {
        email: newEmail,
        email_confirm: true,
      });
    }
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}

export async function archiveClientAction(clientId: string, archive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") return;

  await supabase
    .from("clients")
    .update({ is_archived: archive })
    .eq("id", clientId);

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}
