-- =============================================================================
-- ProjectPulse — Sub-Projects + master-screen columns
-- 003_sub_projects.sql  (idempotent)
-- =============================================================================

-- sub_projects ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sub_projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  position    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sub_projects_project_id_idx ON sub_projects (project_id);

DROP TRIGGER IF EXISTS set_sub_projects_updated_at ON sub_projects;
CREATE TRIGGER set_sub_projects_updated_at
  BEFORE UPDATE ON sub_projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE sub_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_projects_owner_select" ON sub_projects;
CREATE POLICY "sub_projects_owner_select" ON sub_projects FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "sub_projects_owner_insert" ON sub_projects;
CREATE POLICY "sub_projects_owner_insert" ON sub_projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "sub_projects_owner_update" ON sub_projects;
CREATE POLICY "sub_projects_owner_update" ON sub_projects FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "sub_projects_owner_delete" ON sub_projects;
CREATE POLICY "sub_projects_owner_delete" ON sub_projects FOR DELETE USING (auth.uid() = owner_id);

-- scope columns on existing tables -------------------------------------------
ALTER TABLE cards      ADD COLUMN IF NOT EXISTS sub_project_id UUID REFERENCES sub_projects(id) ON DELETE CASCADE;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS sub_project_id UUID REFERENCES sub_projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS cards_sub_project_id_idx      ON cards (sub_project_id);
CREATE INDEX IF NOT EXISTS objectives_sub_project_id_idx ON objectives (sub_project_id);

-- master-screen columns on projects ------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_pinned   BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
