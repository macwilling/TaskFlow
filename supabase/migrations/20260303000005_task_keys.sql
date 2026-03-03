-- ─── Phase: Scoped Task Keys (Issue #10) ─────────────────────────────────────
--
-- Adds a human-readable Jira-style ID to every task, scoped to the client
-- (e.g. "AC-1", "AC-2"). Two changes to the schema:
--
--  1. clients.client_key  – short uppercase alphanumeric prefix chosen by the
--                           user when creating a client (e.g. "AC").
--  2. clients.next_task_number – atomic counter: incremented every time a task
--                                is created for this client.
--  3. tasks.task_number   – the sequential integer portion of the task key.
--
-- Uniqueness is enforced at the DB level:
--   • (tenant_id, client_key)  — keys are unique within a tenant
--   • (client_id, task_number) — numbers are unique within a client

-- ── 1. Add client_key to clients ──────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS client_key        TEXT,
  ADD COLUMN IF NOT EXISTS next_task_number  INTEGER NOT NULL DEFAULT 1;

-- Unique key per tenant (allows NULL during backfill / migration window)
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_client_key_key
  ON clients (tenant_id, client_key)
  WHERE client_key IS NOT NULL;

-- ── 2. Add task_number to tasks ───────────────────────────────────────────────

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_number  INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_client_task_number_key
  ON tasks (client_id, task_number)
  WHERE task_number IS NOT NULL;

-- ── 3. Atomic counter function ────────────────────────────────────────────────
--
-- Returns the next task number for a given client and bumps the counter.
-- The UPDATE is a single atomic operation so two concurrent calls always
-- receive distinct numbers.

CREATE OR REPLACE FUNCTION next_task_number_for_client(p_client_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  UPDATE clients
  SET    next_task_number = next_task_number + 1
  WHERE  id = p_client_id
  RETURNING next_task_number - 1 INTO v_num;

  IF v_num IS NULL THEN
    RAISE EXCEPTION 'Client % not found', p_client_id;
  END IF;

  RETURN v_num;
END;
$$;

-- ── 4. Backfill existing tasks ────────────────────────────────────────────────
--
-- Assign sequential task_number values to tasks that don't have one yet,
-- ordered by created_at within each client.

DO $$
DECLARE
  r RECORD;
  v_num INTEGER;
BEGIN
  FOR r IN
    SELECT id, client_id
    FROM   tasks
    WHERE  task_number IS NULL
    ORDER  BY client_id, created_at
  LOOP
    -- Allocate next number for this client atomically
    v_num := next_task_number_for_client(r.client_id);

    UPDATE tasks
    SET    task_number = v_num
    WHERE  id = r.id;
  END LOOP;
END;
$$;
