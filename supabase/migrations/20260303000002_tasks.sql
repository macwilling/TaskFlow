-- ============================================================
-- Phase 3: Tasks, Attachments, Comments, Email Log
-- ============================================================

-- ── tasks ────────────────────────────────────────────────────
CREATE TABLE tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  resolution_notes TEXT,
  status           TEXT NOT NULL DEFAULT 'backlog'
                   CHECK (status IN ('backlog', 'in_progress', 'in_review', 'closed')),
  priority         TEXT NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date         DATE,
  estimated_hours  NUMERIC(6,2),
  tags             TEXT[] DEFAULT ARRAY[]::TEXT[],
  closed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_tenant_client ON tasks(tenant_id, client_id);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_tenant_due ON tasks(tenant_id, due_date);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD on their own tenant's tasks
CREATE POLICY "admin_tasks_all" ON tasks
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' AND tenant_id = auth_tenant_id())
  WITH CHECK (auth_role() = 'admin' AND tenant_id = auth_tenant_id());

-- Client: SELECT only where task belongs to their linked client
CREATE POLICY "client_tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND tenant_id = auth_tenant_id()
    AND client_id IN (
      SELECT c.id FROM clients c
      JOIN client_portal_access a ON a.client_id = c.id
      WHERE a.user_id = auth.uid()
    )
  );

-- ── task_attachments ─────────────────────────────────────────
CREATE TABLE task_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_size    INT,
  mime_type    TEXT,
  r2_key       TEXT NOT NULL,
  public_url   TEXT NOT NULL,
  uploaded_by  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_attachments_all" ON task_attachments
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' AND tenant_id = auth_tenant_id())
  WITH CHECK (auth_role() = 'admin' AND tenant_id = auth_tenant_id());

CREATE POLICY "client_attachments_select" ON task_attachments
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND tenant_id = auth_tenant_id()
    AND task_id IN (
      SELECT t.id FROM tasks t
      JOIN client_portal_access a ON a.client_id = t.client_id
      WHERE a.user_id = auth.uid()
    )
  );

-- ── comments ─────────────────────────────────────────────────
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id),
  author_role TEXT NOT NULL CHECK (author_role IN ('admin', 'client')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_comments_task ON comments(task_id, created_at);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD on their tenant's comments
CREATE POLICY "admin_comments_all" ON comments
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' AND tenant_id = auth_tenant_id())
  WITH CHECK (auth_role() = 'admin' AND tenant_id = auth_tenant_id());

-- Client: SELECT all comments on their tasks
CREATE POLICY "client_comments_select" ON comments
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND tenant_id = auth_tenant_id()
    AND task_id IN (
      SELECT t.id FROM tasks t
      JOIN client_portal_access a ON a.client_id = t.client_id
      WHERE a.user_id = auth.uid()
    )
  );

-- Client: INSERT their own comments on their tasks
CREATE POLICY "client_comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'client'
    AND tenant_id = auth_tenant_id()
    AND author_id = auth.uid()
    AND task_id IN (
      SELECT t.id FROM tasks t
      JOIN client_portal_access a ON a.client_id = t.client_id
      WHERE a.user_id = auth.uid()
    )
  );

-- Client: UPDATE/DELETE their own comments
CREATE POLICY "client_comments_own" ON comments
  FOR ALL TO authenticated
  USING (
    auth_role() = 'client'
    AND tenant_id = auth_tenant_id()
    AND author_id = auth.uid()
  )
  WITH CHECK (
    auth_role() = 'client'
    AND tenant_id = auth_tenant_id()
    AND author_id = auth.uid()
  );

-- ── email_log ─────────────────────────────────────────────────
CREATE TABLE email_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_email      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  type          TEXT NOT NULL,
  related_id    UUID,
  resend_id     TEXT,
  status        TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_tenant ON email_log(tenant_id, sent_at DESC);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_email_log_select" ON email_log
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' AND tenant_id = auth_tenant_id());
