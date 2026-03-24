-- ============================================================
-- Extend task audit log trigger to capture description and
-- resolution_notes changes. Stores a short snippet (≤120 chars)
-- in metadata rather than the full markdown content.
-- ============================================================

CREATE OR REPLACE FUNCTION log_task_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   UUID;
  v_actor_role TEXT;
BEGIN
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

    -- Description change — store snippet of new value only
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO task_audit_log
        (tenant_id, task_id, actor_id, actor_role, event_type, metadata)
      VALUES
        (NEW.tenant_id, NEW.id, v_actor_id, v_actor_role, 'description_changed',
          jsonb_build_object('snippet', LEFT(COALESCE(NEW.description, ''), 120)));
    END IF;

    -- Resolution notes change — store snippet of new value only
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
