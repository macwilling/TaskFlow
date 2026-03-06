-- Add last_seen_at to track when portal clients last accessed the portal.
-- Used to display "last login" in the admin portal management UI.

ALTER TABLE client_portal_access
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
