-- ============================================================
-- Phase 7: Task Audit Log
-- ============================================================

-- ── task_audit_log ───────────────────────────────────────────

CREATE TABLE task_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role  TEXT CHECK (actor_role IN ('admin', 'client', 'system')) DEFAULT 'system',
  event_type  TEXT NOT NULL,
  -- CHECK enforced values: 'created','status_changed','title_changed',
  --   'comment_added','attachment_added','attachment_deleted'
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_task ON task_audit_log(task_id, created_at DESC);
CREATE INDEX idx_audit_log_tenant ON task_audit_log(tenant_id, created_at DESC);

ALTER TABLE task_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin: see all audit events for their tenant's tasks
CREATE POLICY "admin_audit_log_select" ON task_audit_log
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' AND tenant_id = auth_tenant_id());

-- Client: see only non-sensitive events for tasks they have portal access to
CREATE POLICY "client_audit_log_select" ON task_audit_log
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND event_type IN ('created', 'status_changed', 'comment_added', 'attachment_added')
    AND task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN client_portal_access cpa ON cpa.client_id = t.client_id
      WHERE cpa.user_id = auth.uid()
    )
  );

-- Service role: INSERT (used by server actions and triggers)
CREATE POLICY "service_audit_log_insert" ON task_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── DB trigger: auto-log task creation and status/title changes ─────────────

CREATE OR REPLACE FUNCTION log_task_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   UUID;
  v_actor_role TEXT;
BEGIN
  -- Capture current auth context (null for system/migrations)
  v_actor_id   := auth.uid();
  BEGIN
    v_actor_role := auth_role();
  EXCEPTION WHEN OTHERS THEN
    v_actor_role := 'system';
  END;
  IF v_actor_role IS NULL THEN
    v_actor_role := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_audit_log
      (tenant_id, task_id, actor_id, actor_role, event_type, new_value)
    VALUES
      (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role, 'created', NEW.title);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO task_audit_log
        (tenant_id, task_id, actor_id, actor_role, event_type, old_value, new_value)
      VALUES
        (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role, 'status_changed', OLD.status, NEW.status);
    END IF;

    -- Title change
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO task_audit_log
        (tenant_id, task_id, actor_id, actor_role, event_type, old_value, new_value)
      VALUES
        (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role, 'title_changed', OLD.title, NEW.title);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_audit_log_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_mutation();
