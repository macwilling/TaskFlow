-- ── client_portal_access ──────────────────────────────────────────────────────
CREATE TABLE client_portal_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at  TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_id, user_id)
);
ALTER TABLE client_portal_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_portal_access_all" ON client_portal_access
  FOR ALL TO authenticated
  USING (auth_role() = 'admin' AND tenant_id = auth_tenant_id())
  WITH CHECK (auth_role() = 'admin' AND tenant_id = auth_tenant_id());

CREATE POLICY "client_portal_access_select_own" ON client_portal_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- tasks: client SELECT
CREATE POLICY "client_tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND client_id IN (
      SELECT client_id FROM client_portal_access WHERE user_id = auth.uid()
    )
  );

-- task_attachments: client SELECT
CREATE POLICY "client_attachments_select" ON task_attachments
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN client_portal_access cpa ON cpa.client_id = t.client_id
      WHERE cpa.user_id = auth.uid()
    )
  );

-- Drop Phase 3 placeholder, add granular comment policies
DROP POLICY IF EXISTS "client_comments_own" ON comments;

CREATE POLICY "client_comments_select" ON comments
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN client_portal_access cpa ON cpa.client_id = t.client_id
      WHERE cpa.user_id = auth.uid()
    )
  );

CREATE POLICY "client_comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'client'
    AND author_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND task_id IN (
      SELECT t.id FROM tasks t
      INNER JOIN client_portal_access cpa ON cpa.client_id = t.client_id
      WHERE cpa.user_id = auth.uid()
    )
  );

CREATE POLICY "client_comments_update_own" ON comments
  FOR UPDATE TO authenticated
  USING (auth_role() = 'client' AND author_id = auth.uid() AND tenant_id = auth_tenant_id());

CREATE POLICY "client_comments_delete_own" ON comments
  FOR DELETE TO authenticated
  USING (auth_role() = 'client' AND author_id = auth.uid() AND tenant_id = auth_tenant_id());
