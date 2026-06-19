-- =============================================================================
-- ProjectPulse — To-Do List Migration
-- 002_todos.sql
--
-- Standalone day-to-day tasks, NOT scoped to a project. Each todo has a title
-- plus up to 3 free-text detail lines (enforced in the UI).
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Run against your Supabase project via the SQL editor or CLI.
-- =============================================================================

CREATE TABLE IF NOT EXISTS todos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  details     TEXT[]      NOT NULL DEFAULT '{}',
  completed   BOOLEAN     NOT NULL DEFAULT FALSE,
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS todos_owner_id_idx ON todos (owner_id);
CREATE INDEX IF NOT EXISTS todos_position_idx ON todos (position);

DROP TRIGGER IF EXISTS set_todos_updated_at ON todos;
CREATE TRIGGER set_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todos_owner_select" ON todos;
CREATE POLICY "todos_owner_select"
  ON todos FOR SELECT
  USING (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "todos_owner_insert" ON todos;
CREATE POLICY "todos_owner_insert"
  ON todos FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "todos_owner_update" ON todos;
CREATE POLICY "todos_owner_update"
  ON todos FOR UPDATE
  USING (auth.uid() = owner_id OR owner_id IS NULL);

DROP POLICY IF EXISTS "todos_owner_delete" ON todos;
CREATE POLICY "todos_owner_delete"
  ON todos FOR DELETE
  USING (auth.uid() = owner_id OR owner_id IS NULL);
