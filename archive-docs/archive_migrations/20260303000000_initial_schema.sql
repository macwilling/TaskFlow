-- ============================================================
-- TaskFlow — Initial Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── tenants ──────────────────────────────────────────────────

CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- No direct client access — all operations via service role.

-- ── profiles ─────────────────────────────────────────────────
-- Created before tenant_settings so helper functions can reference it.

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX profiles_tenant_id_idx ON profiles(tenant_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Helper functions ─────────────────────────────────────────
-- Defined after profiles exists. SECURITY DEFINER means they run
-- as the function owner (postgres) and bypass RLS, allowing them
-- to safely read profiles for any authenticated user.

CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ── profiles RLS ─────────────────────────────────────────────
-- Defined after helper functions exist.

-- Admin: can read all profiles in their tenant
CREATE POLICY "profiles: admin read all in tenant"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'admin'
  );

-- Client: can read only their own profile
CREATE POLICY "profiles: client read own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ── tenant_settings ──────────────────────────────────────────

CREATE TABLE tenant_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  business_name               TEXT,
  logo_url                    TEXT,
  address_line1               TEXT,
  address_line2               TEXT,
  city                        TEXT,
  state                       TEXT,
  postal_code                 TEXT,
  country                     TEXT DEFAULT 'US',
  email                       TEXT,
  phone                       TEXT,
  primary_color               TEXT DEFAULT '#0969da',
  accent_color                TEXT DEFAULT '#0550ae',
  default_currency            TEXT DEFAULT 'USD',
  date_format                 TEXT DEFAULT 'MM/DD/YYYY',
  default_payment_terms       INT DEFAULT 30,
  invoice_number_prefix       TEXT DEFAULT 'INV-',
  invoice_number_next         INT DEFAULT 1001,
  tax_label                   TEXT DEFAULT 'Tax',
  default_tax_rate            NUMERIC(5,4) DEFAULT 0,
  payment_method_options      TEXT[] DEFAULT ARRAY['Check','ACH','Wire','Credit Card','Other'],
  portal_welcome_message      TEXT DEFAULT 'Welcome to your client portal.',
  email_task_closed_subject   TEXT DEFAULT 'Your task has been completed',
  email_task_closed_body      TEXT,
  email_invoice_subject       TEXT DEFAULT 'Invoice {{invoice_number}} from {{business_name}}',
  email_invoice_body          TEXT,
  email_comment_subject       TEXT DEFAULT 'New comment on your task',
  email_comment_body          TEXT,
  email_signature             TEXT,
  email_sender_name           TEXT,
  email_reply_to              TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin: full access to their own tenant's settings
CREATE POLICY "tenant_settings: admin full access"
  ON tenant_settings
  FOR ALL
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'admin'
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'admin'
  );
