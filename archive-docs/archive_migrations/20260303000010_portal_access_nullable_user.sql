-- Allow portal_access rows to be created before a client has signed up.
-- The admin grants access (invited_at set, user_id null), and user_id + accepted_at
-- are filled in when the client first signs in via /auth/callback.
--
-- Also replace the three-column unique constraint with a two-column one:
-- a client can only have one portal-access record per tenant.

ALTER TABLE client_portal_access
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE client_portal_access
  DROP CONSTRAINT client_portal_access_tenant_id_client_id_user_id_key;

ALTER TABLE client_portal_access
  ADD CONSTRAINT client_portal_access_tenant_id_client_id_key UNIQUE (tenant_id, client_id);
