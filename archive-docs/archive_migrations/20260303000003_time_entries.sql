-- ============================================================
-- Phase 4: Time Entries
-- ============================================================

CREATE TABLE time_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  task_id        UUID REFERENCES tasks(id) ON DELETE SET NULL,
  description    TEXT NOT NULL,
  entry_date     DATE NOT NULL,
  duration_hours NUMERIC(6,2) NOT NULL,
  billable       BOOLEAN NOT NULL DEFAULT true,
  billed         BOOLEAN NOT NULL DEFAULT false,
  hourly_rate    NUMERIC(10,2),
  invoice_id     UUID,  -- FK to invoices added in Phase 5
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_time_entries_tenant_client ON time_entries(tenant_id, client_id);
CREATE INDEX idx_time_entries_tenant_date   ON time_entries(tenant_id, entry_date);
CREATE INDEX idx_time_entries_billable      ON time_entries(tenant_id, billable, billed);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries: admin full access"
  ON time_entries FOR ALL TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'admin'
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'admin'
  );
