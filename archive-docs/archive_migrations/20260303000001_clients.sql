-- ============================================================
-- TaskFlow — Clients Table
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE clients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  company          TEXT,
  email            TEXT,
  phone            TEXT,
  billing_address  JSONB DEFAULT '{}',
  default_rate     NUMERIC(10,2),
  payment_terms    INT DEFAULT 30,
  currency         TEXT DEFAULT 'USD',
  color            TEXT DEFAULT '#0969da',
  notes            TEXT,
  custom_fields    JSONB DEFAULT '{}',
  is_archived      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX clients_tenant_id_idx ON clients(tenant_id);
CREATE INDEX clients_tenant_archived_idx ON clients(tenant_id, is_archived);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin: full CRUD within their tenant
CREATE POLICY "clients: admin full access"
  ON clients
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
