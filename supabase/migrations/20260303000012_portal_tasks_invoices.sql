-- ── Portal: client task creation ─────────────────────────────────────────────
-- Allows portal clients to submit new task requests.
CREATE POLICY "client_tasks_insert" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'client'
    AND tenant_id = auth_tenant_id()
    AND client_id IN (
      SELECT client_id FROM client_portal_access WHERE user_id = auth.uid()
    )
  );

-- ── Portal: client invoice visibility ────────────────────────────────────────
-- Clients can see invoices for their account that have been sent/viewed/paid.
-- Draft invoices are intentionally excluded.
CREATE POLICY "client_invoices_select" ON invoices
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND client_id IN (
      SELECT client_id FROM client_portal_access WHERE user_id = auth.uid()
    )
    AND status IN ('sent', 'viewed', 'paid')
  );

CREATE POLICY "client_invoice_line_items_select" ON invoice_line_items
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'client'
    AND invoice_id IN (
      SELECT i.id FROM invoices i
      INNER JOIN client_portal_access cpa ON cpa.client_id = i.client_id
      WHERE cpa.user_id = auth.uid()
        AND i.status IN ('sent', 'viewed', 'paid')
    )
  );
