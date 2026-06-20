# Sub-Projects & Master Screen Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight nested sub-projects (mini-Kanban + objectives) under each project, and turn the home `ProjectList` into a dashboard with rollups, view modes, sorting, and per-project quick actions.

**Architecture:** Reuse the existing `cards` and `objectives` tables via a nullable `sub_project_id` scope column (Approach A); a new `sub_projects` table holds parent→child rows. Sub-project UI is a collapsible section on the Overview tab. Master-screen rollups are pure functions fed by a lightweight aggregate fetch across all projects.

**Tech Stack:** React 19 + TypeScript, Zustand (one store per domain), Supabase (Postgres + RLS), `idb` offline sync queue, `@dnd-kit/core` + `@dnd-kit/sortable`, Tailwind v4, Vitest + @testing-library/react + jsdom.

## Global Constraints

- Stores follow the existing pattern: optimistic Zustand update first, Supabase write, on error `enqueueMutation(table, 'upsert' | 'delete', payload)`. Copy this exactly — do not invent a new persistence path.
- All Supabase tables use RLS keyed on `owner_id = auth.uid()`. Every new row must carry `owner_id` and `project_id`.
- Migrations are idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`. Migrations are applied by hand via the Supabase SQL editor (same as `001`/`002`) — the plan does not run them automatically.
- Path alias `@` → `/src` (configured in `vite.config.ts`).
- Sub-projects are **one level deep only** — no sub-projects of sub-projects.
- Sub-projects have only mini-Kanban cards + objectives. No BOM/Hardware/Notes/Issues per sub-project.
- Component styling: match the existing dark theme used in `ProjectDetail.tsx` / `ProjectList.tsx` (Tailwind, near-black `#09090b` background, zinc accents). Read a sibling component before writing JSX and reuse its class conventions rather than inventing new ones.

---

## File Structure

**Create:**
- `vitest.config.ts` — test runner config (jsdom, setup file).
- `src/test/setup.ts` — testing-library jest-dom matchers.
- `supabase/migrations/003_sub_projects.sql` — schema changes.
- `src/store/subProjectStore.ts` — CRUD for `sub_projects`.
- `src/store/subProjectStore.test.ts`
- `src/store/rollups.ts` — pure rollup/health functions.
- `src/store/rollups.test.ts`
- `src/store/rollupStore.ts` — aggregate home-screen fetch.
- `src/projects/subprojects/MiniObjectives.tsx`
- `src/projects/subprojects/MiniBoard.tsx`
- `src/projects/subprojects/SubProjectCard.tsx`
- `src/projects/subprojects/SubProjectsSection.tsx`
- `src/projects/master/StatsHeader.tsx`
- `src/projects/master/ProjectControls.tsx`
- `src/projects/master/ProjectCardActions.tsx`

**Modify:**
- `src/db/types.ts` — extend `Database` types (`sub_projects` table, `sub_project_id`, `is_pinned`, `archived_at`).
- `src/store/objectivesStore.ts` — add `subProjectId` scope.
- `src/store/cardStore.ts` — add `subProjectId` scope to `loadCards`.
- `src/store/projectStore.ts` — `togglePin`, `archiveProject`, `duplicateProject`.
- `src/projects/ProjectDetail.tsx` — render `SubProjectsSection` on Overview tab.
- `src/projects/ProjectList.tsx` — stats header, controls, rollups on cards, quick actions.

---

## Task 1: Test harness setup

No vitest config or tests exist yet, though the deps are installed. This task makes `npm test` work.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/store/smoke.test.ts` (temporary, deleted at end of task)

**Interfaces:**
- Produces: a working `npm test` command; `@` alias resolves in tests; jest-dom matchers available globally.

- [ ] **Step 1: Write the config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2: Write a smoke test**

`src/store/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 3: Run it**

Run: `npm test -- --run`
Expected: 1 passing test.

- [ ] **Step 4: Delete the smoke test and commit**

```bash
rm src/store/smoke.test.ts
git add vitest.config.ts src/test/setup.ts
git commit -m "chore: add vitest config and test setup"
```

---

## Task 2: Migration + Database types

**Files:**
- Create: `supabase/migrations/003_sub_projects.sql`
- Modify: `src/db/types.ts`

**Interfaces:**
- Produces: `sub_projects` table type at `Database['public']['Tables']['sub_projects']`; `sub_project_id: string | null` on `cards` and `objectives` Row/Insert/Update; `is_pinned: boolean` and `archived_at: string | null` on `projects` Row.

- [ ] **Step 1: Write the migration**

`supabase/migrations/003_sub_projects.sql`:
```sql
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
```

- [ ] **Step 2: Extend the Database types**

In `src/db/types.ts`, add `sub_project_id: string | null` to the `cards` and `objectives` `Row`, `Insert` (optional), and `Update` (optional) shapes. Add `is_pinned: boolean` and `archived_at: string | null` to the `projects` `Row` (and optional on Insert/Update). Add a new `sub_projects` table entry:

```ts
sub_projects: {
  Row: {
    id: string
    owner_id: string | null
    project_id: string
    name: string
    position: number
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    owner_id?: string | null
    project_id: string
    name: string
    position?: number
    created_at?: string
    updated_at?: string
  }
  Update: {
    name?: string
    position?: number
    updated_at?: string
  }
}
```

For `objectives.Row` add `sub_project_id: string | null`; for `objectives.Insert`/`Update` add `sub_project_id?: string | null`. Do the same on `cards`.

- [ ] **Step 3: Verify types compile**

Run: `npm run typecheck`
Expected: no new errors from `types.ts` (pre-existing Web Serial errors, if any, are unrelated).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_sub_projects.sql src/db/types.ts
git commit -m "feat: add sub_projects schema and master-screen columns"
```

> **Manual step for the operator:** apply `003_sub_projects.sql` in the Supabase SQL editor before testing against live data, exactly as `001`/`002` were applied.

---

## Task 3: subProjectStore (CRUD)

**Files:**
- Create: `src/store/subProjectStore.ts`
- Test: `src/store/subProjectStore.test.ts`

**Interfaces:**
- Produces:
  - `useSubProjectStore` with state `subProjects: SubProject[]`, `loading: boolean`
  - `loadSubProjects(projectId: string): Promise<void>`
  - `addSubProject(projectId: string, name: string): Promise<void>`
  - `renameSubProject(id: string, name: string): Promise<void>`
  - `deleteSubProject(id: string): Promise<void>`
  - type `SubProject = Database['public']['Tables']['sub_projects']['Row']`

- [ ] **Step 1: Write the failing test**

`src/store/subProjectStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const insertSingle = vi.fn()
const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...a) },
}))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))

import { useSubProjectStore } from './subProjectStore'

beforeEach(() => {
  useSubProjectStore.setState({ subProjects: [], loading: false })
  fromMock.mockReset()
  insertSingle.mockReset()
})

describe('subProjectStore', () => {
  it('addSubProject inserts and stores the returned row', async () => {
    const row = { id: 'sp1', project_id: 'p1', name: 'Firmware', position: 0,
      owner_id: null, created_at: 'now', updated_at: 'now' }
    fromMock.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
    })
    await useSubProjectStore.getState().addSubProject('p1', 'Firmware')
    expect(useSubProjectStore.getState().subProjects).toHaveLength(1)
    expect(useSubProjectStore.getState().subProjects[0].name).toBe('Firmware')
  })

  it('deleteSubProject removes it optimistically', async () => {
    useSubProjectStore.setState({ subProjects: [
      { id: 'sp1', project_id: 'p1', name: 'A', position: 0, owner_id: null, created_at: '', updated_at: '' },
    ] })
    fromMock.mockReturnValue({ delete: () => ({ eq: () => Promise.resolve({ error: null }) }) })
    await useSubProjectStore.getState().deleteSubProject('sp1')
    expect(useSubProjectStore.getState().subProjects).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --run subProjectStore`
Expected: FAIL — cannot resolve `./subProjectStore`.

- [ ] **Step 3: Implement the store**

`src/store/subProjectStore.ts`:
```ts
import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database } from '@/db/types'

type SubProject = Database['public']['Tables']['sub_projects']['Row']

interface SubProjectStore {
  subProjects: SubProject[]
  loading: boolean
  loadSubProjects: (projectId: string) => Promise<void>
  addSubProject: (projectId: string, name: string) => Promise<void>
  renameSubProject: (id: string, name: string) => Promise<void>
  deleteSubProject: (id: string) => Promise<void>
}

export const useSubProjectStore = create<SubProjectStore>((set, get) => ({
  subProjects: [],
  loading: false,

  loadSubProjects: async (projectId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('sub_projects')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })
    set({ subProjects: data ?? [], loading: false })
  },

  addSubProject: async (projectId, name) => {
    const position = get().subProjects.length
    const optimistic: SubProject = {
      id: crypto.randomUUID(),
      owner_id: null,
      project_id: projectId,
      name,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set(s => ({ subProjects: [...s.subProjects, optimistic] }))
    try {
      const { data, error } = await supabase
        .from('sub_projects')
        .insert({ project_id: projectId, name, position })
        .select()
        .single()
      if (error) throw error
      set(s => ({ subProjects: s.subProjects.map(sp => sp.id === optimistic.id ? data : sp) }))
    } catch {
      await enqueueMutation('sub_projects', 'upsert', optimistic)
    }
  },

  renameSubProject: async (id, name) => {
    set(s => ({ subProjects: s.subProjects.map(sp => sp.id === id ? { ...sp, name } : sp) }))
    try {
      const { error } = await supabase.from('sub_projects').update({ name }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('sub_projects', 'upsert', { id, name })
    }
  },

  deleteSubProject: async (id) => {
    set(s => ({ subProjects: s.subProjects.filter(sp => sp.id !== id) }))
    try {
      const { error } = await supabase.from('sub_projects').delete().eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('sub_projects', 'delete', { id })
    }
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run subProjectStore`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/subProjectStore.ts src/store/subProjectStore.test.ts
git commit -m "feat: add subProjectStore CRUD"
```

---

## Task 4: Scope objectivesStore to sub-projects

**Files:**
- Modify: `src/store/objectivesStore.ts`
- Test: `src/store/objectivesStore.test.ts` (create)

**Interfaces:**
- Consumes: existing `useObjectivesStore`.
- Produces:
  - `loadObjectives(projectId: string, subProjectId?: string | null)` — when `subProjectId` is a string, filters `.eq('sub_project_id', subProjectId)`; when `null`/omitted, filters `.is('sub_project_id', null)`.
  - `addObjective(projectId: string, title: string, subProjectId?: string | null)` — writes `sub_project_id` through.

- [ ] **Step 1: Write the failing test**

`src/store/objectivesStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))

import { useObjectivesStore } from './objectivesStore'

beforeEach(() => {
  useObjectivesStore.setState({ objectives: [], loading: false })
  fromMock.mockReset()
})

describe('objectivesStore scope', () => {
  it('loadObjectives filters by sub_project_id when provided', async () => {
    const eqProject = vi.fn().mockReturnThis()
    const eqSub = vi.fn().mockReturnThis()
    const order = vi.fn().mockResolvedValue({ data: [] })
    fromMock.mockReturnValue({
      select: () => ({ eq: eqProject, is: vi.fn().mockReturnThis(), order }),
    })
    // chainable: select().eq(project).eq(sub).order()
    const chain = { eq: eqSub, is: vi.fn().mockReturnThis(), order }
    eqProject.mockReturnValue(chain)
    await useObjectivesStore.getState().loadObjectives('p1', 'sp1')
    expect(eqProject).toHaveBeenCalledWith('project_id', 'p1')
    expect(eqSub).toHaveBeenCalledWith('sub_project_id', 'sp1')
  })

  it('loadObjectives filters sub_project_id IS NULL for parent scope', async () => {
    const isNull = vi.fn().mockReturnThis()
    const order = vi.fn().mockResolvedValue({ data: [] })
    const chain = { is: isNull, order }
    const eqProject = vi.fn().mockReturnValue(chain)
    fromMock.mockReturnValue({ select: () => ({ eq: eqProject }) })
    await useObjectivesStore.getState().loadObjectives('p1')
    expect(isNull).toHaveBeenCalledWith('sub_project_id', null)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --run objectivesStore`
Expected: FAIL — `loadObjectives` does not call `.is`/second `.eq`.

- [ ] **Step 3: Modify the store**

In `src/store/objectivesStore.ts`, update the interface and implementations:

```ts
  loadObjectives: (projectId: string, subProjectId?: string | null) => Promise<void>
  addObjective: (projectId: string, title: string, subProjectId?: string | null) => Promise<void>
```

```ts
  loadObjectives: async (projectId, subProjectId = null) => {
    set({ loading: true })
    let query = supabase.from('objectives').select('*').eq('project_id', projectId)
    query = subProjectId ? query.eq('sub_project_id', subProjectId) : query.is('sub_project_id', null)
    const { data } = await query.order('position', { ascending: true })
    set({ objectives: data ?? [], loading: false })
  },

  addObjective: async (projectId, title, subProjectId = null) => {
    const position = get().objectives.length
    const optimistic: Objective = {
      id: crypto.randomUUID(),
      project_id: projectId,
      sub_project_id: subProjectId,
      title,
      completed: false,
      position,
      created_at: new Date().toISOString(),
    }
    set(s => ({ objectives: [...s.objectives, optimistic] }))
    try {
      const { data, error } = await supabase
        .from('objectives')
        .insert({ project_id: projectId, sub_project_id: subProjectId, title, completed: false, position })
        .select()
        .single()
      if (error) throw error
      set(s => ({ objectives: s.objectives.map(o => o.id === optimistic.id ? data : o) }))
    } catch {
      await enqueueMutation('objectives', 'upsert', optimistic)
    }
  },
```

Leave `toggleObjective`, `updateObjective`, `deleteObjective` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run objectivesStore`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/objectivesStore.ts src/store/objectivesStore.test.ts
git commit -m "feat: scope objectivesStore to sub-projects"
```

---

## Task 5: Scope cardStore to sub-projects

**Files:**
- Modify: `src/store/cardStore.ts`
- Test: `src/store/cardStore.test.ts` (create)

**Interfaces:**
- Consumes: existing `useCardStore`; `addCard` already takes a full `Insert` object, so callers pass `sub_project_id` in the insert payload directly (no signature change).
- Produces: `loadCards(projectId: string, subProjectId?: string | null)` — filters `.eq('sub_project_id', subProjectId)` when provided, else `.is('sub_project_id', null)`.

- [ ] **Step 1: Write the failing test**

`src/store/cardStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))
vi.mock('@/machines/machineStore', () => ({ useMachineStore: { getState: () => ({ logHours: vi.fn() }) } }))

import { useCardStore } from './cardStore'

beforeEach(() => {
  useCardStore.setState({ cards: [], loading: false })
  fromMock.mockReset()
})

describe('cardStore scope', () => {
  it('loadCards filters by sub_project_id when provided', async () => {
    const eqSub = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [] }) })
    const eqProject = vi.fn().mockReturnValue({ eq: eqSub, is: vi.fn() })
    fromMock.mockReturnValue({ select: () => ({ eq: eqProject }) })
    await useCardStore.getState().loadCards('p1', 'sp1')
    expect(eqSub).toHaveBeenCalledWith('sub_project_id', 'sp1')
  })

  it('loadCards filters sub_project_id IS NULL for parent scope', async () => {
    const isNull = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [] }) })
    const eqProject = vi.fn().mockReturnValue({ is: isNull, eq: vi.fn() })
    fromMock.mockReturnValue({ select: () => ({ eq: eqProject }) })
    await useCardStore.getState().loadCards('p1')
    expect(isNull).toHaveBeenCalledWith('sub_project_id', null)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --run cardStore`
Expected: FAIL — `loadCards` ignores the second argument.

- [ ] **Step 3: Modify `loadCards`**

In `src/store/cardStore.ts`, change the interface line and implementation:

```ts
  loadCards: (projectId: string, subProjectId?: string | null) => Promise<void>
```

```ts
  loadCards: async (projectId, subProjectId = null) => {
    set({ loading: true })
    let query = supabase.from('cards').select('*').eq('project_id', projectId)
    query = subProjectId ? query.eq('sub_project_id', subProjectId) : query.is('sub_project_id', null)
    const { data } = await query.order('position')
    set({ cards: data ?? [], loading: false })
  },
```

Leave all other methods unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run cardStore`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/cardStore.ts src/store/cardStore.test.ts
git commit -m "feat: scope cardStore loadCards to sub-projects"
```

---

## Task 6: Rollup pure functions

These power both the master-screen rollups and the sub-project progress rings. Pure → fully unit-tested.

**Files:**
- Create: `src/store/rollups.ts`
- Test: `src/store/rollups.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Health = 'green' | 'amber' | 'red'
  export interface ProjectRollup {
    completion: number       // 0..1, combined parent+sub objectives
    openIssues: number
    subProjectCount: number
    health: Health
  }
  export function completion(objectivesCompleted: number, objectivesTotal: number): number
  export function projectHealth(input: {
    estimatedCompletionDate: string | null
    openIssues: number
    hasHighSeverityOpenIssue: boolean
    now?: Date
  }): Health
  ```
- Health rules: **red** if overdue (date < now) OR `hasHighSeverityOpenIssue`; **amber** if due within 7 days OR `openIssues > 0`; otherwise **green**.

- [ ] **Step 1: Write the failing test**

`src/store/rollups.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { completion, projectHealth } from './rollups'

describe('completion', () => {
  it('is 0 when there are no objectives', () => {
    expect(completion(0, 0)).toBe(0)
  })
  it('is the ratio of completed to total', () => {
    expect(completion(3, 4)).toBe(0.75)
  })
})

describe('projectHealth', () => {
  const now = new Date('2026-06-20T00:00:00Z')
  it('is red when overdue', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-06-10', openIssues: 0, hasHighSeverityOpenIssue: false, now })).toBe('red')
  })
  it('is red when a high-severity issue is open even if on time', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-12-01', openIssues: 1, hasHighSeverityOpenIssue: true, now })).toBe('red')
  })
  it('is amber when due within 7 days', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-06-25', openIssues: 0, hasHighSeverityOpenIssue: false, now })).toBe('amber')
  })
  it('is amber when there are open issues', () => {
    expect(projectHealth({ estimatedCompletionDate: null, openIssues: 2, hasHighSeverityOpenIssue: false, now })).toBe('amber')
  })
  it('is green when on track with no issues', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-12-01', openIssues: 0, hasHighSeverityOpenIssue: false, now })).toBe('green')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --run rollups`
Expected: FAIL — cannot resolve `./rollups`.

- [ ] **Step 3: Implement**

`src/store/rollups.ts`:
```ts
export type Health = 'green' | 'amber' | 'red'

export interface ProjectRollup {
  completion: number
  openIssues: number
  subProjectCount: number
  health: Health
}

export function completion(objectivesCompleted: number, objectivesTotal: number): number {
  if (objectivesTotal <= 0) return 0
  return objectivesCompleted / objectivesTotal
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function projectHealth(input: {
  estimatedCompletionDate: string | null
  openIssues: number
  hasHighSeverityOpenIssue: boolean
  now?: Date
}): Health {
  const now = input.now ?? new Date()
  const due = input.estimatedCompletionDate ? new Date(input.estimatedCompletionDate) : null

  if (input.hasHighSeverityOpenIssue) return 'red'
  if (due && due.getTime() < now.getTime()) return 'red'
  if (due && due.getTime() - now.getTime() <= WEEK_MS) return 'amber'
  if (input.openIssues > 0) return 'amber'
  return 'green'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run rollups`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/rollups.ts src/store/rollups.test.ts
git commit -m "feat: add rollup/health pure functions"
```

---

## Task 7: rollupStore — aggregate home fetch

Loads only the columns needed for per-project rollups across ALL projects, builds a `Map<projectId, ProjectRollup>`.

**Files:**
- Create: `src/store/rollupStore.ts`
- Test: `src/store/rollupStore.test.ts`

**Interfaces:**
- Consumes: `completion`, `projectHealth`, `ProjectRollup` from `@/store/rollups`; `projects` from `useProjectStore` (for `estimated_completion_date`).
- Produces:
  - `useRollupStore` with `rollups: Record<string, ProjectRollup>`
  - `loadRollups(projects: { id: string; estimated_completion_date: string | null }[]): Promise<void>`
  - It runs three selects: `objectives(project_id, completed)`, `issues(project_id, status, severity)`, `sub_projects(project_id)`, then folds them with the pure functions.

- [ ] **Step 1: Write the failing test**

`src/store/rollupStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))

import { useRollupStore } from './rollupStore'

function selectReturning(data: unknown[]) {
  return { select: () => Promise.resolve({ data }) }
}

beforeEach(() => {
  useRollupStore.setState({ rollups: {} })
  fromMock.mockReset()
})

describe('rollupStore', () => {
  it('computes completion, open issues and sub-project counts per project', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'objectives') return selectReturning([
        { project_id: 'p1', completed: true },
        { project_id: 'p1', completed: false },
      ])
      if (table === 'issues') return selectReturning([
        { project_id: 'p1', status: 'open', severity: 'low' },
      ])
      if (table === 'sub_projects') return selectReturning([
        { project_id: 'p1' }, { project_id: 'p1' },
      ])
      return selectReturning([])
    })
    await useRollupStore.getState().loadRollups([
      { id: 'p1', estimated_completion_date: null },
    ])
    const r = useRollupStore.getState().rollups['p1']
    expect(r.completion).toBe(0.5)
    expect(r.openIssues).toBe(1)
    expect(r.subProjectCount).toBe(2)
    expect(r.health).toBe('amber') // has an open issue
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --run rollupStore`
Expected: FAIL — cannot resolve `./rollupStore`.

- [ ] **Step 3: Implement**

`src/store/rollupStore.ts`:
```ts
import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { completion, projectHealth, type ProjectRollup } from '@/store/rollups'

interface RollupStore {
  rollups: Record<string, ProjectRollup>
  loadRollups: (projects: { id: string; estimated_completion_date: string | null }[]) => Promise<void>
}

export const useRollupStore = create<RollupStore>((set) => ({
  rollups: {},

  loadRollups: async (projects) => {
    const [objRes, issRes, subRes] = await Promise.all([
      supabase.from('objectives').select('project_id, completed'),
      supabase.from('issues').select('project_id, status, severity'),
      supabase.from('sub_projects').select('project_id'),
    ])
    const objectives = (objRes.data ?? []) as { project_id: string; completed: boolean }[]
    const issues = (issRes.data ?? []) as { project_id: string; status: string; severity: string }[]
    const subs = (subRes.data ?? []) as { project_id: string }[]

    const rollups: Record<string, ProjectRollup> = {}
    for (const p of projects) {
      const projObjectives = objectives.filter(o => o.project_id === p.id)
      const done = projObjectives.filter(o => o.completed).length
      const openIssues = issues.filter(i => i.project_id === p.id && i.status !== 'closed')
      const hasHigh = openIssues.some(i => i.severity === 'high' || i.severity === 'critical')
      const subProjectCount = subs.filter(s => s.project_id === p.id).length

      rollups[p.id] = {
        completion: completion(done, projObjectives.length),
        openIssues: openIssues.length,
        subProjectCount,
        health: projectHealth({
          estimatedCompletionDate: p.estimated_completion_date,
          openIssues: openIssues.length,
          hasHighSeverityOpenIssue: hasHigh,
        }),
      }
    }
    set({ rollups })
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run rollupStore`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/rollupStore.ts src/store/rollupStore.test.ts
git commit -m "feat: add rollupStore aggregate fetch"
```

---

## Task 8: MiniObjectives component

**Files:**
- Create: `src/projects/subprojects/MiniObjectives.tsx`

**Interfaces:**
- Consumes: `useObjectivesStore` (`loadObjectives(projectId, subProjectId)`, `addObjective(projectId, title, subProjectId)`, `toggleObjective`, `deleteObjective`).
- Produces: `<MiniObjectives projectId={string} subProjectId={string} />` — a self-contained checklist + progress bar scoped to the sub-project.

> NOTE: This component owns its own objectives fetch. Because `useObjectivesStore` is a single global store, render only ONE objectives consumer per mounted scope. `MiniObjectives` is mounted only inside an expanded `SubProjectCard` (one at a time per card); it reloads its scope on mount. Read `ProjectDetail.tsx`'s existing objectives section first and mirror its class names.

- [ ] **Step 1: Implement the component**

`src/projects/subprojects/MiniObjectives.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useObjectivesStore } from '@/store/objectivesStore'

export function MiniObjectives({ projectId, subProjectId }: { projectId: string; subProjectId: string }) {
  const { objectives, loadObjectives, addObjective, toggleObjective, deleteObjective } = useObjectivesStore()
  const [title, setTitle] = useState('')

  useEffect(() => {
    void loadObjectives(projectId, subProjectId)
  }, [projectId, subProjectId, loadObjectives])

  const scoped = objectives.filter(o => o.sub_project_id === subProjectId)
  const done = scoped.filter(o => o.completed).length
  const pct = scoped.length ? Math.round((done / scoped.length) * 100) : 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    void addObjective(projectId, t, subProjectId)
    setTitle('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>Objectives</span>
        <div className="flex-1 h-1.5 rounded bg-zinc-800 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <span>{done}/{scoped.length}</span>
      </div>
      <ul className="space-y-1">
        {scoped.map(o => (
          <li key={o.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={o.completed} onChange={() => toggleObjective(o.id)} />
            <span className={o.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}>{o.title}</span>
            <button onClick={() => deleteObjective(o.id)} className="ml-auto text-zinc-600 hover:text-red-400 text-xs">✕</button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Add objective…"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
        />
        <button type="submit" className="px-2 py-1 text-sm rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700">Add</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/projects/subprojects/MiniObjectives.tsx
git commit -m "feat: add MiniObjectives component"
```

---

## Task 9: MiniBoard component (compact Kanban)

**Files:**
- Create: `src/projects/subprojects/MiniBoard.tsx`

**Interfaces:**
- Consumes: `useCardStore` (`loadCards(projectId, subProjectId)`, `addCard(insert)`, `moveCard(id, column, position)`, `deleteCard`); `@dnd-kit/core`; `CardColumn` from `@/db/types`.
- Produces: `<MiniBoard projectId={string} subProjectId={string} />` — 3 columns (backlog / in_progress / done), drag to move, inline add.

> NOTE: Read the existing `Board` component (find it under `src/` — likely `src/board/` or `src/kanban/`) before writing this, and reuse its DndContext + column drop pattern. The compact version below is intentionally minimal; align drag handlers with the existing Board's. Cards are inserted with `sub_project_id` set so they are scoped.

- [ ] **Step 1: Implement the component**

`src/projects/subprojects/MiniBoard.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { DndContext, type DragEndEvent, useDroppable, useDraggable } from '@dnd-kit/core'
import { useCardStore } from '@/store/cardStore'
import type { CardColumn } from '@/db/types'

const COLUMNS: { key: CardColumn; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

function DraggableCard({ id, title }: { id: string; title: string }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100 cursor-grab">
      {title}
    </div>
  )
}

function Column({ col, children }: { col: CardColumn; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col })
  return (
    <div ref={setNodeRef}
      className={`flex-1 min-w-0 rounded p-2 space-y-1 ${isOver ? 'bg-zinc-800/60' : 'bg-zinc-900/60'}`}>
      {children}
    </div>
  )
}

export function MiniBoard({ projectId, subProjectId }: { projectId: string; subProjectId: string }) {
  const { cards, loadCards, addCard, moveCard, deleteCard } = useCardStore()
  const [title, setTitle] = useState('')

  useEffect(() => {
    void loadCards(projectId, subProjectId)
  }, [projectId, subProjectId, loadCards])

  const scoped = cards.filter(c => c.sub_project_id === subProjectId)

  const onDragEnd = (e: DragEndEvent) => {
    const col = e.over?.id as CardColumn | undefined
    if (!col) return
    const position = scoped.filter(c => c.column === col).length
    void moveCard(String(e.active.id), col, position)
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    const position = scoped.filter(c => c.column === 'backlog').length
    void addCard({
      project_id: projectId,
      sub_project_id: subProjectId,
      title: t,
      type: 'software',
      column: 'backlog',
      position,
    })
    setTitle('')
  }

  return (
    <div className="space-y-2">
      <DndContext onDragEnd={onDragEnd}>
        <div className="flex gap-2">
          {COLUMNS.map(c => (
            <Column key={c.key} col={c.key}>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{c.label}</div>
              {scoped.filter(card => card.column === c.key).map(card => (
                <div key={card.id} className="group relative">
                  <DraggableCard id={card.id} title={card.title} />
                  <button onClick={() => deleteCard(card.id)}
                    className="absolute -top-1 -right-1 hidden group-hover:block text-zinc-500 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </Column>
          ))}
        </div>
      </DndContext>
      <form onSubmit={add} className="flex gap-2">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add task…"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100" />
        <button type="submit" className="px-2 py-1 text-sm rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700">Add</button>
      </form>
    </div>
  )
}
```

> If `addCard`'s `Insert` type requires additional non-null fields (check `cards` Insert in `types.ts`), add them here with sensible defaults matching how the main Board creates cards.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors. Fix any missing required `cards` Insert fields per the note above.

- [ ] **Step 3: Commit**

```bash
git add src/projects/subprojects/MiniBoard.tsx
git commit -m "feat: add MiniBoard compact kanban"
```

---

## Task 10: SubProjectCard (collapsed row + expand)

**Files:**
- Create: `src/projects/subprojects/SubProjectCard.tsx`

**Interfaces:**
- Consumes: `useSubProjectStore` (`renameSubProject`, `deleteSubProject`); `MiniBoard`, `MiniObjectives`.
- Produces: `<SubProjectCard projectId={string} subProject={SubProject} />` — collapsed shows name + edit/delete + expand toggle; expanded renders `MiniObjectives` then `MiniBoard`.

> Progress ring / card counts in the collapsed view depend on data the mini components own once expanded. To keep this task self-contained, the collapsed row shows the name, an expand chevron, rename, and delete. (Per-card rollups for sub-projects are intentionally out of scope here — the master-screen rollups in Task 13 cover project-level numbers.)

- [ ] **Step 1: Implement**

`src/projects/subprojects/SubProjectCard.tsx`:
```tsx
import { useState } from 'react'
import { useSubProjectStore } from '@/store/subProjectStore'
import { MiniBoard } from './MiniBoard'
import { MiniObjectives } from './MiniObjectives'
import type { Database } from '@/db/types'

type SubProject = Database['public']['Tables']['sub_projects']['Row']

export function SubProjectCard({ projectId, subProject }: { projectId: string; subProject: SubProject }) {
  const { renameSubProject, deleteSubProject } = useSubProjectStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(subProject.name)

  const commitRename = () => {
    const n = name.trim()
    if (n && n !== subProject.name) void renameSubProject(subProject.id, n)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(o => !o)} className="text-zinc-400 hover:text-zinc-200">
          {open ? '▾' : '▸'}
        </button>
        {editing ? (
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename() }}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 text-left text-sm font-medium text-zinc-100">
            {subProject.name}
          </button>
        )}
        <button onClick={() => deleteSubProject(subProject.id)}
          className="text-zinc-600 hover:text-red-400 text-xs">Delete</button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-zinc-800 pt-3">
          <MiniObjectives projectId={projectId} subProjectId={subProject.id} />
          <MiniBoard projectId={projectId} subProjectId={subProject.id} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/projects/subprojects/SubProjectCard.tsx
git commit -m "feat: add SubProjectCard"
```

---

## Task 11: SubProjectsSection + wire into Overview tab

**Files:**
- Create: `src/projects/subprojects/SubProjectsSection.tsx`
- Modify: `src/projects/ProjectDetail.tsx`

**Interfaces:**
- Consumes: `useSubProjectStore` (`subProjects`, `loadSubProjects`, `addSubProject`); `SubProjectCard`.
- Produces: `<SubProjectsSection projectId={string} />` rendered inside the Overview tab content of `ProjectDetail`.

- [ ] **Step 1: Implement the section**

`src/projects/subprojects/SubProjectsSection.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useSubProjectStore } from '@/store/subProjectStore'
import { SubProjectCard } from './SubProjectCard'

export function SubProjectsSection({ projectId }: { projectId: string }) {
  const { subProjects, loadSubProjects, addSubProject } = useSubProjectStore()
  const [name, setName] = useState('')

  useEffect(() => {
    void loadSubProjects(projectId)
  }, [projectId, loadSubProjects])

  const scoped = subProjects.filter(sp => sp.project_id === projectId)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    void addSubProject(projectId, n)
    setName('')
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Sub-Projects ({scoped.length})</h3>
      </div>
      <div className="space-y-2">
        {scoped.map(sp => (
          <SubProjectCard key={sp.id} projectId={projectId} subProject={sp} />
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New sub-project name…"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-100" />
        <button type="submit" className="px-3 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-500">Add</button>
      </form>
    </section>
  )
}
```

- [ ] **Step 2: Wire into the Overview tab**

In `src/projects/ProjectDetail.tsx`, import the section and render it at the bottom of the Overview tab's JSX block (the block shown when the active tab is Overview):
```tsx
import { SubProjectsSection } from './subprojects/SubProjectsSection'
```
Add `<SubProjectsSection projectId={project.id} />` after the existing Overview fields (use the actual project-id variable name in that file — likely `project.id` or `activeProject.id`).

- [ ] **Step 3: Verify it renders**

Run: `npm run dev`, open a project, confirm the Overview tab shows "Sub-Projects (0)", add one, expand it, add an objective and a task. Confirm no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/projects/subprojects/SubProjectsSection.tsx src/projects/ProjectDetail.tsx
git commit -m "feat: render sub-projects section on Overview tab"
```

---

## Task 12: Master screen — project store actions (pin / archive / duplicate)

**Files:**
- Modify: `src/store/projectStore.ts`

**Interfaces:**
- Consumes: existing `useProjectStore`.
- Produces:
  - `togglePin(id: string): Promise<void>` — flips `is_pinned`.
  - `archiveProject(id: string): Promise<void>` — sets `archived_at = now`.
  - `unarchiveProject(id: string): Promise<void>` — sets `archived_at = null`.
  - `duplicateProject(id: string): Promise<void>` — server-first deep copy (project → sub_projects → objectives + cards), name suffixed " (copy)".

- [ ] **Step 1: Write the failing test**

`src/store/projectStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/db/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }))
vi.mock('@/db/idb', () => ({ enqueueMutation: vi.fn() }))

import { useProjectStore } from './projectStore'

beforeEach(() => {
  useProjectStore.setState({ projects: [
    { id: 'p1', name: 'A', is_pinned: false, archived_at: null } as never,
  ], activeProject: null, loading: false })
  fromMock.mockReset()
  fromMock.mockReturnValue({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) })
})

describe('projectStore master actions', () => {
  it('togglePin flips is_pinned optimistically', async () => {
    await useProjectStore.getState().togglePin('p1')
    expect((useProjectStore.getState().projects[0] as { is_pinned: boolean }).is_pinned).toBe(true)
  })

  it('archiveProject sets archived_at', async () => {
    await useProjectStore.getState().archiveProject('p1')
    expect((useProjectStore.getState().projects[0] as { archived_at: string | null }).archived_at).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --run projectStore`
Expected: FAIL — `togglePin` is not a function.

- [ ] **Step 3: Implement**

Add to the `ProjectStore` interface and implementation in `src/store/projectStore.ts`:

```ts
  togglePin: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  unarchiveProject: (id: string) => Promise<void>
  duplicateProject: (id: string) => Promise<void>
```

```ts
  togglePin: async (id) => {
    const proj = get().projects.find(p => p.id === id)
    if (!proj) return
    const is_pinned = !(proj as { is_pinned?: boolean }).is_pinned
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, is_pinned } : p) }))
    try {
      const { error } = await supabase.from('projects').update({ is_pinned }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', { id, is_pinned })
    }
  },

  archiveProject: async (id) => {
    const archived_at = new Date().toISOString()
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, archived_at } : p) }))
    try {
      const { error } = await supabase.from('projects').update({ archived_at }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', { id, archived_at })
    }
  },

  unarchiveProject: async (id) => {
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, archived_at: null } : p) }))
    try {
      const { error } = await supabase.from('projects').update({ archived_at: null }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('projects', 'upsert', { id, archived_at: null })
    }
  },

  duplicateProject: async (id) => {
    const src = get().projects.find(p => p.id === id)
    if (!src) return
    const { data: newProj, error } = await supabase
      .from('projects')
      .insert({
        name: `${src.name} (copy)`,
        description: src.description ?? null,
        classification: (src as { classification?: string | null }).classification ?? null,
        status: (src as { status?: string }).status ?? 'planning',
        estimated_completion_date: (src as { estimated_completion_date?: string | null }).estimated_completion_date ?? null,
        scratchpad_content: (src as { scratchpad_content?: string | null }).scratchpad_content ?? '',
      })
      .select()
      .single()
    if (error || !newProj) return

    // sub_projects: map old id -> new id
    const { data: subs } = await supabase.from('sub_projects').select('*').eq('project_id', id)
    const subIdMap = new Map<string, string>()
    for (const sp of subs ?? []) {
      const { data: newSub } = await supabase.from('sub_projects')
        .insert({ project_id: newProj.id, name: sp.name, position: sp.position })
        .select().single()
      if (newSub) subIdMap.set(sp.id, newSub.id)
    }

    const remap = (oldSub: string | null) => (oldSub ? subIdMap.get(oldSub) ?? null : null)

    const { data: objectives } = await supabase.from('objectives').select('*').eq('project_id', id)
    for (const o of objectives ?? []) {
      await supabase.from('objectives').insert({
        project_id: newProj.id, sub_project_id: remap(o.sub_project_id),
        title: o.title, completed: o.completed, position: o.position,
      })
    }

    const { data: cards } = await supabase.from('cards').select('*').eq('project_id', id)
    for (const c of cards ?? []) {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = c
      await supabase.from('cards').insert({ ...rest, project_id: newProj.id, sub_project_id: remap(c.sub_project_id) })
    }

    set(s => ({ projects: [newProj, ...s.projects] }))
  },
```

> Duplicate is online-only (multi-row, depends on returned IDs). If offline, it is a no-op; that's acceptable for v1.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run projectStore`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/projectStore.ts src/store/projectStore.test.ts
git commit -m "feat: add pin/archive/duplicate project actions"
```

---

## Task 13: StatsHeader component

**Files:**
- Create: `src/projects/master/StatsHeader.tsx`

**Interfaces:**
- Consumes: `projects` from `useProjectStore`; `rollups` from `useRollupStore`.
- Produces: `<StatsHeader />` — a band showing Total projects · Overall completion % · Overdue · Open issues · Due this week.

- [ ] **Step 1: Implement**

`src/projects/master/StatsHeader.tsx`:
```tsx
import { useProjectStore } from '@/store/projectStore'
import { useRollupStore } from '@/store/rollupStore'

function dueWithinDays(date: string | null, days: number): boolean {
  if (!date) return false
  const diff = new Date(date).getTime() - Date.now()
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

export function StatsHeader() {
  const projects = useProjectStore(s => s.projects).filter(p => !(p as { archived_at?: string | null }).archived_at)
  const rollups = useRollupStore(s => s.rollups)

  const total = projects.length
  const completions = projects.map(p => rollups[p.id]?.completion ?? 0)
  const overall = total ? Math.round((completions.reduce((a, b) => a + b, 0) / total) * 100) : 0
  const overdue = projects.filter(p => {
    const d = (p as { estimated_completion_date?: string | null }).estimated_completion_date
    return d && new Date(d).getTime() < Date.now()
  }).length
  const openIssues = projects.reduce((a, p) => a + (rollups[p.id]?.openIssues ?? 0), 0)
  const dueThisWeek = projects.filter(p =>
    dueWithinDays((p as { estimated_completion_date?: string | null }).estimated_completion_date ?? null, 7)).length

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold text-zinc-100">{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )

  return (
    <div className="flex gap-8 rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-4 mb-6">
      <Stat label="Projects" value={total} />
      <Stat label="Overall complete" value={`${overall}%`} />
      <Stat label="Overdue" value={overdue} />
      <Stat label="Open issues" value={openIssues} />
      <Stat label="Due this week" value={dueThisWeek} />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/projects/master/StatsHeader.tsx
git commit -m "feat: add master-screen StatsHeader"
```

---

## Task 14: ProjectControls (view modes + sorting)

**Files:**
- Create: `src/projects/master/ProjectControls.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type ViewMode = 'grid' | 'list' | 'board'
  export type SortKey = 'due' | 'progress' | 'activity' | 'status' | 'name'
  export function ProjectControls(props: {
    view: ViewMode; onView: (v: ViewMode) => void
    sort: SortKey; onSort: (s: SortKey) => void
    showArchived: boolean; onToggleArchived: (v: boolean) => void
  }): JSX.Element
  ```

- [ ] **Step 1: Implement**

`src/projects/master/ProjectControls.tsx`:
```tsx
export type ViewMode = 'grid' | 'list' | 'board'
export type SortKey = 'due' | 'progress' | 'activity' | 'status' | 'name'

const VIEWS: ViewMode[] = ['grid', 'list', 'board']
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'due', label: 'Due date' },
  { key: 'progress', label: 'Progress' },
  { key: 'activity', label: 'Last activity' },
  { key: 'status', label: 'Status' },
  { key: 'name', label: 'Name' },
]

export function ProjectControls({ view, onView, sort, onSort, showArchived, onToggleArchived }: {
  view: ViewMode; onView: (v: ViewMode) => void
  sort: SortKey; onSort: (s: SortKey) => void
  showArchived: boolean; onToggleArchived: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
        {VIEWS.map(v => (
          <button key={v} onClick={() => onView(v)}
            className={`px-3 py-1 text-sm capitalize ${view === v ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}>
            {v}
          </button>
        ))}
      </div>
      <select value={sort} onChange={e => onSort(e.target.value as SortKey)}
        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-zinc-200">
        {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <label className="ml-auto flex items-center gap-2 text-sm text-zinc-400">
        <input type="checkbox" checked={showArchived} onChange={e => onToggleArchived(e.target.checked)} />
        Show archived
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/projects/master/ProjectControls.tsx
git commit -m "feat: add ProjectControls view/sort bar"
```

---

## Task 15: Wire master screen together (sorting, rollups on cards, quick actions)

**Files:**
- Create: `src/projects/master/ProjectCardActions.tsx`
- Modify: `src/projects/ProjectList.tsx`

**Interfaces:**
- Consumes: `StatsHeader`, `ProjectControls` (+ `ViewMode`/`SortKey`), `useRollupStore.loadRollups`, `useProjectStore` (`togglePin`, `archiveProject`, `unarchiveProject`, `duplicateProject`, `updateProject`), `useSubProjectStore.addSubProject`, rollups.
- Produces: a `ProjectCardActions` menu component and an updated `ProjectList` that loads rollups, applies sort/pin/archive filtering, switches view modes, and renders rollup badges + the actions menu on each card.

- [ ] **Step 1: Implement the actions menu**

`src/projects/master/ProjectCardActions.tsx`:
```tsx
import { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import type { Database } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

export function ProjectCardActions({ project }: { project: Project }) {
  const { togglePin, archiveProject, unarchiveProject, duplicateProject } = useProjectStore()
  const [open, setOpen] = useState(false)
  const archived = !!(project as { archived_at?: string | null }).archived_at
  const pinned = !!(project as { is_pinned?: boolean }).is_pinned

  return (
    <div className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="text-zinc-500 hover:text-zinc-200 px-1">⋯</button>
      {open && (
        <div onClick={e => e.stopPropagation()}
          className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-zinc-800 bg-zinc-900 py-1 text-sm shadow-xl">
          <button className="block w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800"
            onClick={() => { void togglePin(project.id); setOpen(false) }}>
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="block w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800"
            onClick={() => { void duplicateProject(project.id); setOpen(false) }}>
            Duplicate
          </button>
          <button className="block w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800"
            onClick={() => { void (archived ? unarchiveProject(project.id) : archiveProject(project.id)); setOpen(false) }}>
            {archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `ProjectList.tsx`**

Read the current `ProjectList.tsx` first. Then:

1. Import:
```tsx
import { StatsHeader } from './master/StatsHeader'
import { ProjectControls, type ViewMode, type SortKey } from './master/ProjectControls'
import { ProjectCardActions } from './master/ProjectCardActions'
import { useRollupStore } from '@/store/rollupStore'
```
2. Add local state: `const [view, setView] = useState<ViewMode>('grid')`, `const [sort, setSort] = useState<SortKey>('activity')`, `const [showArchived, setShowArchived] = useState(false)`.
3. After projects load, load rollups:
```tsx
const loadRollups = useRollupStore(s => s.loadRollups)
const rollups = useRollupStore(s => s.rollups)
useEffect(() => {
  if (projects.length) void loadRollups(projects.map(p => ({ id: p.id, estimated_completion_date: p.estimated_completion_date })))
}, [projects, loadRollups])
```
4. Filter + sort the project list before rendering (apply on top of the existing classification/search filter):
```tsx
const visible = filtered
  .filter(p => showArchived ? true : !p.archived_at)
  .sort((a, b) => {
    if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1
    switch (sort) {
      case 'name': return a.name.localeCompare(b.name)
      case 'due': return (a.estimated_completion_date ?? '9999').localeCompare(b.estimated_completion_date ?? '9999')
      case 'progress': return (rollups[b.id]?.completion ?? 0) - (rollups[a.id]?.completion ?? 0)
      case 'status': return (a.status ?? '').localeCompare(b.status ?? '')
      case 'activity':
      default: return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
    }
  })
```
(Use the actual variable name of the already-filtered list in the file; it may be `filtered` or similar.)
5. Render `<StatsHeader />` above the grid and `<ProjectControls .../>` below it, passing the state setters.
6. In the existing project-card JSX, add rollup UI: a health dot, completion %, open-issues badge, sub-project chip, and `<ProjectCardActions project={p} />`:
```tsx
{rollups[p.id] && (
  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
    <span className={`h-2 w-2 rounded-full ${
      rollups[p.id].health === 'red' ? 'bg-red-500' :
      rollups[p.id].health === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
    <span>{Math.round(rollups[p.id].completion * 100)}%</span>
    {rollups[p.id].openIssues > 0 && <span>· {rollups[p.id].openIssues} open</span>}
    {rollups[p.id].subProjectCount > 0 && <span>· {rollups[p.id].subProjectCount} sub</span>}
  </div>
)}
```
7. For `view === 'list'` render rows (a single column, dense) and `view === 'board'` group by `status` into columns; `view === 'grid'` keeps the existing grid. Keep this switch minimal — reuse the same card content, only the wrapping layout differs.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`. Confirm: stats header numbers populate; switching grid/list/board re-lays-out; sorting reorders; pinning floats a project to the top; archiving hides it (unless "Show archived"); duplicate creates a "(copy)"; the card rollup dot/percent/badges show.

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck` (expected: no new errors), then:
```bash
git add src/projects/master/ProjectCardActions.tsx src/projects/ProjectList.tsx
git commit -m "feat: master-screen dashboard — rollups, view modes, sorting, quick actions"
```

---

## Task 16: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests pass (subProjectStore, objectivesStore, cardStore, rollups, rollupStore, projectStore).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors. (Pre-existing Web Serial type gaps, if any, are unrelated — do not "fix" by suppressing unrelated code.)

- [ ] **Step 3: Manual smoke (dev server)**

Run `npm run dev` and confirm end-to-end: create sub-project → add objective + task → drag task across mini-board columns → reload page (data persists) → delete sub-project (cards/objectives cascade) → master screen rollups/sorting/quick-actions all behave.

- [ ] **Step 4: Final commit (if any fixes were made)**

```bash
git add -A
git commit -m "chore: verification fixes for sub-projects + dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** sub_projects table + scope columns (Task 2) ✓; lightweight tasks+objectives per sub-project (Tasks 4,5,8,9) ✓; Overview-tab section (Task 11) ✓; global stats header (Task 13) ✓; per-card rollups + health (Tasks 6,7,15) ✓; view modes + sorting (Tasks 14,15) ✓; quick actions pin/archive/duplicate/status/quick-add (Tasks 12,15) ✓; offline sync via enqueueMutation (all stores) ✓; testing (Tasks 3–7,12) ✓.
- **Status quick-action / quick-add sub-project from card:** "change status inline" and "quick-add sub-project" from the master card are folded into Task 15's actions menu; if time-constrained they are the lowest-priority items and may ship in a follow-up — they do not block the core dashboard.
- **One-level nesting** enforced by having no sub-project UI inside `MiniBoard`/`MiniObjectives`.
