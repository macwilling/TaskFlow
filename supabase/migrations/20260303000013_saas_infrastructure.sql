-- Add custom_domain to tenants (future bring-your-own-domain support)
ALTER TABLE tenants
  ADD COLUMN custom_domain TEXT UNIQUE;

-- Add SMTP columns to tenant_settings (future per-tenant custom email)
-- When null, app falls back to shared Resend + taskflow.com sending domain
ALTER TABLE tenant_settings
  ADD COLUMN smtp_host       TEXT,
  ADD COLUMN smtp_port       INTEGER,
  ADD COLUMN smtp_username   TEXT,
  ADD COLUMN smtp_password   TEXT,
  ADD COLUMN smtp_from_email TEXT,
  ADD COLUMN smtp_from_name  TEXT;
