import { cookies } from "next/headers";

export const IMPERSONATION_COOKIE = "portal_impersonation";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export type ImpersonationPayload = {
  clientId: string;
  userId: string;      // portal user's auth UID
  tenantId: string;
  tenantSlug: string;
  clientName: string;
  adminUserId: string;
  expiresAt: number;   // Date.now() + EXPIRY_MS
};

export function encodePayload(payload: ImpersonationPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodePayload(raw: string): ImpersonationPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString()) as ImpersonationPayload;
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Reads the impersonation cookie from the current request. Returns null if absent or expired. */
export async function getImpersonationPayload(): Promise<ImpersonationPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  return decodePayload(raw);
}

export function makePayload(
  fields: Omit<ImpersonationPayload, "expiresAt">
): ImpersonationPayload {
  return { ...fields, expiresAt: Date.now() + EXPIRY_MS };
}
