/**
 * Re-exports the admin storageState path so specs don't need to import auth.setup.ts.
 */
import path from "path";
export const ADMIN_STATE = path.join(__dirname, ".auth/admin.json");
