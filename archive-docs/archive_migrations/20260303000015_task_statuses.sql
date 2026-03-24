-- ============================================================
-- Phase 15: Custom Task Statuses
-- Replaces the hardcoded status CHECK constraint with a
-- per-tenant task_statuses table. Migrates existing data.
-- ============================================================

-- ── A. task_statuses table ────────────────────────────────

CREATE TABLE task_statuses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  color       TEXT        NOT NULL DEFAULT '#6b7280',
  position    INTEGER     NOT NULL DEFAULT 0,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  is_closed   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One default status per tenant
CREATE UNIQUE INDEX idx_task_statuses_one_default
  ON task_statuses(tenant_id)
  WHERE is_default = true;

-- One closed (terminal) status per tenant
CREATE UNIQUE INDEX idx_task_statuses_one_closed
  ON task_statuses(tenant_id)
  WHERE is_closed = true;

-- Index for ordered fetches
CREATE INDEX idx_task_statuses_tenant_position
  ON task_statuses(tenant_id, position);

ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;

-- Admins: full CRUD on their own tenant's statuses
CREATE POLICY "admin_task_statuses_all" ON task_statuses
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' AND tenant_id = auth_tenant_id())
  WITH CHECK (auth_role() = 'admin' AND tenant_id = auth_tenant_id());

-- Portal clients: read all statuses for their tenant (for badge display)
CREATE POLICY "client_task_statuses_select" ON task_statuses
  FOR SELECT TO authenticated
  USING (auth_role() = 'client' AND tenant_id = auth_tenant_id());


-- ── B. Seed defaults for all existing tenants ─────────────

INSERT INTO task_statuses (tenant_id, name, color, position, is_default, is_closed)
SELECT
  t.id AS tenant_id,
  s.name,
  s.color,
  s.position,
  s.is_default,
  s.is_closed
FROM tenants t
CROSS JOIN (VALUES
  ('Backlog',     '#6b7280', 0, true,  false),
  ('In Progress', '#3b82f6', 1, false, false),
  ('In Review',   '#f59e0b', 2, false, false),
  ('Closed',      '#22c55e', 3, false, true)
) AS s(name, color, position, is_default, is_closed);


-- ── C. Add status_id to tasks (nullable first) ───────────

ALTER TABLE tasks
  ADD COLUMN status_id UUID REFERENCES task_statuses(id) ON DELETE RESTRICT;


-- ── D. Backfill status_id from old string values ─────────

UPDATE tasks t
SET status_id = ts.id
FROM task_statuses ts
WHERE ts.tenant_id = t.tenant_id
  AND (
    (t.status = 'backlog'      AND ts.name = 'Backlog'      AND ts.is_closed = false)
    OR (t.status = 'in_progress' AND ts.name = 'In Progress' AND ts.is_closed = false)
    OR (t.status = 'in_review'   AND ts.name = 'In Review'   AND ts.is_closed = false)
    OR (t.status = 'closed'      AND ts.is_closed = true)
  );

-- Safety check: fail migration if any task is unmapped
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tasks WHERE status_id IS NULL) THEN
    RAISE EXCEPTION 'Migration incomplete: % tasks have no status_id',
      (SELECT COUNT(*) FROM tasks WHERE status_id IS NULL);
  END IF;
END $$;


-- ── E. Enforce NOT NULL, drop old column, update indexes ──

ALTER TABLE tasks ALTER COLUMN status_id SET NOT NULL;

ALTER TABLE tasks DROP COLUMN status;

DROP INDEX IF EXISTS idx_tasks_tenant_status;
CREATE INDEX idx_tasks_tenant_status_id ON tasks(tenant_id, status_id);


-- ── F. Update audit log trigger ───────────────────────────
-- Rewritten to join task_statuses for human-readable status names.

CREATE OR REPLACE FUNCTION log_task_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   UUID;
  v_actor_role TEXT;
  v_old_name   TEXT;
  v_new_name   TEXT;
BEGIN
  v_actor_id := auth.uid();
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
    -- Status change: snapshot human-readable names
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
      SELECT name INTO v_old_name FROM task_statuses WHERE id = OLD.status_id;
      SELECT name INTO v_new_name FROM task_statuses WHERE id = NEW.status_id;
      INSERT INTO task_audit_log
        (tenant_id, task_id, actor_id, actor_role, event_type, old_value, new_value)
      VALUES
        (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role,
         'status_changed', v_old_name, v_new_name);
    END IF;

    -- Title change
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO task_audit_log
        (tenant_id, task_id, actor_id, actor_role, event_type, old_value, new_value)
      VALUES
        (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role,
         'title_changed', OLD.title, NEW.title);
    END IF;

    -- Description change — store snippet only
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO task_audit_log
        (tenant_id, task_id, actor_id, actor_role, event_type, metadata)
      VALUES
        (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role, 'description_changed',
          jsonb_build_object('snippet', LEFT(COALESCE(NEW.description, ''), 120)));
    END IF;

    -- Resolution notes change — store snippet only
    IF OLD.resolution_notes IS DISTINCT FROM NEW.resolution_notes THEN
      INSERT INTO task_audit_log
        (tenant_id, task_id, actor_id, actor_role, event_type, metadata)
      VALUES
        (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role, 'resolution_notes_changed',
          jsonb_build_object('snippet', LEFT(COALESCE(NEW.resolution_notes, ''), 120)));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ── G. Auto-seed new tenants on creation ─────────────────

CREATE OR REPLACE FUNCTION seed_default_task_statuses()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO task_statuses (tenant_id, name, color, position, is_default, is_closed)
  VALUES
    (NEW.id, 'Backlog',     '#6b7280', 0, true,  false),
    (NEW.id, 'In Progress', '#3b82f6', 1, false, false),
    (NEW.id, 'In Review',   '#f59e0b', 2, false, false),
    (NEW.id, 'Closed',      '#22c55e', 3, false, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_task_statuses_on_tenant_insert
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION seed_default_task_statuses();
