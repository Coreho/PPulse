-- =============================================================================
-- ProjectPulse — Initial Schema Migration
-- 001_initial_schema.sql
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- Run this against your Supabase project via the SQL editor or CLI.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- future full-text search on title/description

-- ---------------------------------------------------------------------------
-- Helper: updated_at auto-update trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projects (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  description         TEXT,
  scratchpad_content  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects (owner_id);

DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_owner_select" ON projects;
CREATE POLICY "projects_owner_select"
  ON projects FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_owner_insert" ON projects;
CREATE POLICY "projects_owner_insert"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_owner_update" ON projects;
CREATE POLICY "projects_owner_update"
  ON projects FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_owner_delete" ON projects;
CREATE POLICY "projects_owner_delete"
  ON projects FOR DELETE
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cards (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type                  TEXT        NOT NULL CHECK (type IN ('software', 'hardware')),
  title                 TEXT        NOT NULL,
  description           TEXT,
  column                TEXT        NOT NULL DEFAULT 'backlog'
                                    CHECK (column IN ('backlog', 'in_progress', 'done')),
  position              INTEGER     NOT NULL DEFAULT 0,
  scratchpad_tag        TEXT,                              -- UUID comment tag for sync bridge
  meta                  JSONB,                             -- SoftwareMeta | HardwareMeta
  blocked_by            UUID[]      NOT NULL DEFAULT '{}', -- card IDs that block this card
  bom_item_id           UUID        REFERENCES bom_items(id) ON DELETE SET NULL
                                    DEFERRABLE INITIALLY DEFERRED,
  machine_id            UUID        REFERENCES machines(id) ON DELETE SET NULL
                                    DEFERRABLE INITIALLY DEFERRED,
  target_timestamp      TIMESTAMPTZ,
  status_flags          TEXT[]      NOT NULL DEFAULT '{}'
                                    CHECK (status_flags <@ ARRAY['blocked','outdated','low_stock','needs_maintenance']::TEXT[]),
  machine_session_start TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- We need bom_items and machines defined before the FK constraints can be resolved
-- so the deferred constraint above allows the tables to be created in sequence.

CREATE INDEX IF NOT EXISTS cards_project_id_idx     ON cards (project_id);
CREATE INDEX IF NOT EXISTS cards_position_idx        ON cards (project_id, "column", position);
CREATE INDEX IF NOT EXISTS cards_scratchpad_tag_idx  ON cards (scratchpad_tag)
  WHERE scratchpad_tag IS NOT NULL;

DROP TRIGGER IF EXISTS set_cards_updated_at ON cards;
CREATE TRIGGER set_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cards_project_select" ON cards;
CREATE POLICY "cards_project_select"
  ON cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = cards.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cards_project_insert" ON cards;
CREATE POLICY "cards_project_insert"
  ON cards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = cards.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cards_project_update" ON cards;
CREATE POLICY "cards_project_update"
  ON cards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = cards.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cards_project_delete" ON cards;
CREATE POLICY "cards_project_delete"
  ON cards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = cards.project_id AND p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- bom_items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bom_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  sku                 TEXT,
  quantity_required   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity_required >= 0),
  quantity_stock      INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_stock >= 0),
  unit                TEXT        NOT NULL DEFAULT 'pcs',
  bin_location        TEXT,
  linked_card_id      UUID        REFERENCES cards(id) ON DELETE SET NULL
                                  DEFERRABLE INITIALLY DEFERRED,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bom_items_project_id_idx ON bom_items (project_id);

DROP TRIGGER IF EXISTS set_bom_items_updated_at ON bom_items;
CREATE TRIGGER set_bom_items_updated_at
  BEFORE UPDATE ON bom_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bom_items_project_select" ON bom_items;
CREATE POLICY "bom_items_project_select"
  ON bom_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = bom_items.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bom_items_project_insert" ON bom_items;
CREATE POLICY "bom_items_project_insert"
  ON bom_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = bom_items.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bom_items_project_update" ON bom_items;
CREATE POLICY "bom_items_project_update"
  ON bom_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = bom_items.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "bom_items_project_delete" ON bom_items;
CREATE POLICY "bom_items_project_delete"
  ON bom_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = bom_items.project_id AND p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS machines (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                        TEXT        NOT NULL,
  type                        TEXT        NOT NULL,
  total_hours_logged          NUMERIC     NOT NULL DEFAULT 0 CHECK (total_hours_logged >= 0),
  maintenance_threshold_hours NUMERIC     NOT NULL DEFAULT 500 CHECK (maintenance_threshold_hours > 0),
  last_maintenance_at         TIMESTAMPTZ,
  is_locked                   BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS machines_project_id_idx ON machines (project_id);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machines_project_select" ON machines;
CREATE POLICY "machines_project_select"
  ON machines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = machines.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "machines_project_insert" ON machines;
CREATE POLICY "machines_project_insert"
  ON machines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = machines.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "machines_project_update" ON machines;
CREATE POLICY "machines_project_update"
  ON machines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = machines.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "machines_project_delete" ON machines;
CREATE POLICY "machines_project_delete"
  ON machines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = machines.project_id AND p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- pinouts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pinouts (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mcu_type      TEXT  NOT NULL,
  variable_name TEXT  NOT NULL,
  pin_number    TEXT  NOT NULL,
  pin_function  TEXT,
  description   TEXT
);

CREATE INDEX IF NOT EXISTS pinouts_project_id_idx ON pinouts (project_id);

ALTER TABLE pinouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pinouts_project_select" ON pinouts;
CREATE POLICY "pinouts_project_select"
  ON pinouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = pinouts.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pinouts_project_insert" ON pinouts;
CREATE POLICY "pinouts_project_insert"
  ON pinouts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = pinouts.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pinouts_project_update" ON pinouts;
CREATE POLICY "pinouts_project_update"
  ON pinouts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = pinouts.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pinouts_project_delete" ON pinouts;
CREATE POLICY "pinouts_project_delete"
  ON pinouts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = pinouts.project_id AND p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- file_vault_entries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS file_vault_entries (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path       TEXT  NOT NULL,
  file_name       TEXT  NOT NULL,
  last_seen_mtime BIGINT NOT NULL,                     -- Unix ms timestamp
  status          TEXT  NOT NULL DEFAULT 'current'
                        CHECK (status IN ('current', 'outdated')),
  linked_card_id  UUID  REFERENCES cards(id) ON DELETE SET NULL
                        DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (project_id, file_path)
);

CREATE INDEX IF NOT EXISTS file_vault_project_id_idx ON file_vault_entries (project_id);

ALTER TABLE file_vault_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_vault_project_select" ON file_vault_entries;
CREATE POLICY "file_vault_project_select"
  ON file_vault_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = file_vault_entries.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "file_vault_project_insert" ON file_vault_entries;
CREATE POLICY "file_vault_project_insert"
  ON file_vault_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = file_vault_entries.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "file_vault_project_update" ON file_vault_entries;
CREATE POLICY "file_vault_project_update"
  ON file_vault_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = file_vault_entries.project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "file_vault_project_delete" ON file_vault_entries;
CREATE POLICY "file_vault_project_delete"
  ON file_vault_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = file_vault_entries.project_id AND p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- timers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS timers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id             UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  phases              JSONB       NOT NULL DEFAULT '[]',  -- TimerPhase[]
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_phase_index INTEGER     NOT NULL DEFAULT 0 CHECK (current_phase_index >= 0),
  completed           BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS timers_card_id_idx ON timers (card_id);

ALTER TABLE timers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timers_project_select" ON timers;
CREATE POLICY "timers_project_select"
  ON timers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = timers.card_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "timers_project_insert" ON timers;
CREATE POLICY "timers_project_insert"
  ON timers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cards c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = timers.card_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "timers_project_update" ON timers;
CREATE POLICY "timers_project_update"
  ON timers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = timers.card_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "timers_project_delete" ON timers;
CREATE POLICY "timers_project_delete"
  ON timers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cards c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = timers.card_id AND p.owner_id = auth.uid()
    )
  );
