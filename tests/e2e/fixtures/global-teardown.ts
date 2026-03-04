/**
 * Playwright global teardown — runs once after all test suites.
 * Deletes the portal test data seeded in global-setup.ts.
 * The pre-existing admin user is not deleted (only the dynamic client/task/client_record).
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import type { SeedData } from "./index";

const SEED_FILE = path.join(__dirname, "seed.json");

export default async function globalTeardown() {
  if (!fs.existsSync(SEED_FILE)) return;

  let seed: SeedData;
  try {
    seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8")) as SeedData;
    if (!seed.tenantId) return;
  } catch {
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return;

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Clean up in reverse-dependency order
  if (seed.clientUserId) {
    await admin.from("client_portal_access").delete().eq("user_id", seed.clientUserId);
    await admin.from("comments").delete().eq("author_id", seed.clientUserId);
    await admin.from("profiles").delete().eq("id", seed.clientUserId);
    await admin.auth.admin.deleteUser(seed.clientUserId);
  }
  if (seed.taskId) {
    await admin.from("comments").delete().eq("task_id", seed.taskId);
    await admin.from("tasks").delete().eq("id", seed.taskId);
  }
  if (seed.clientId) {
    await admin.from("clients").delete().eq("id", seed.clientId);
  }

  fs.unlinkSync(SEED_FILE);
  console.log(`✓ Portal test data cleaned up (client=${seed.clientEmail})`);
}
