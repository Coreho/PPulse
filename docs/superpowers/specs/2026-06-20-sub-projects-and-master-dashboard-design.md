# Sub-Projects & Master Screen Depth — Design

**Date:** 2026-06-20
**Status:** Approved (design), pending implementation plan

## Overview

Two features for ProjectPulse:

1. **Sub-Projects** — lightweight projects nested under a parent, each holding its own
   mini-Kanban cards and objectives checklist. They surface as a section on the parent's
   **Overview** tab (no new top-level tab).
2. **Master screen depth** — turn the home `ProjectList` into a real dashboard: global stats
   header, per-card progress/health rollups, view modes & sorting, and per-project quick actions.

Chosen data approach: **reuse existing `cards` and `objectives` tables** via a nullable
`sub_project_id` scope column (Approach A), rather than dedicated tables or JSON blobs.

## 1. Data Model

Migration `supabase/migrations/003_sub_projects.sql`, idempotent (CREATE … IF NOT EXISTS,
ADD COLUMN IF NOT EXISTS), with `updated_at` trigger and RLS policies mirroring existing tables.

### New table: `sub_projects`
| column | type | notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| project_id | UUID FK → projects(id) ON DELETE CASCADE | parent |
| owner_id | UUID FK → auth.users(id) | for RLS, mirrors `projects` |
| name | TEXT NOT NULL | |
| position | INT NOT NULL DEFAULT 0 | ordering within parent |
| created_at / updated_at | TIMESTAMPTZ | trigger on update |

RLS: select/insert/update/delete `USING (auth.uid() = owner_id)`.

### Altered tables
- `cards.sub_project_id` — UUID FK → sub_projects(id) ON DELETE CASCADE, **nullable**.
- `objectives.sub_project_id` — UUID FK → sub_projects(id) ON DELETE CASCADE, **nullable**.

Semantics: `sub_project_id = NULL` → row belongs to the parent project directly (unchanged
existing behavior). Non-null → belongs to that sub-project. `project_id` stays populated on
every row so RLS and existing queries are unaffected.

### Project-level columns (for master-screen quick actions)
Add to `projects` (migration `003`):
- `is_pinned BOOLEAN NOT NULL DEFAULT false`
- `archived_at TIMESTAMPTZ` (nullable; non-null = archived, hidden by default)

## 2. Sub-Projects UI (Overview tab section)

New `subProjectStore` (Zustand) — CRUD over `sub_projects`, same Supabase-first +
`enqueueMutation` offline pattern as `projectStore`.

`cardStore` and `objectivesStore` gain an optional `subProjectId` scope:
- Load/query filters by `sub_project_id` (null for parent board, a UUID for a mini-board).
- Create writes the `sub_project_id` through.
- Existing parent-level callers pass `null`/omit → behavior unchanged.

### Components
- `SubProjectsSection` — rendered on the Overview tab below project fields. Header
  "Sub-Projects (n)" + inline "+ Add" input. Lists `SubProjectCard`s ordered by `position`.
- `SubProjectCard` — collapsed row: name, progress ring (objectives % done), per-column card
  counts (e.g. `2 / 1 / 4`), edit + delete. Click to expand.
- Expanded inline content:
  - `MiniBoard` — compact 3-column Kanban (Backlog → In Progress → Done) with `@dnd-kit`
    drag, scoped to the sub-project. A compact variant of `Board`; the existing `Board`
    component is left untouched for the parent Kanban tab.
  - `MiniObjectives` — checklist with progress bar, scoped to the sub-project.

Deleting a sub-project cascades its cards and objectives (FK ON DELETE CASCADE).

## 3. Master Screen Depth (`ProjectList.tsx`)

### a. Global stats header
A band above the grid: Total projects · Overall completion % · Overdue · Open issues ·
Due this week. Aggregated client-side from the home-screen rollup load (below).

### b. Per-card progress & health rollups
- Progress ring = combined objectives completion (parent + all its sub-projects).
- Open-issues badge.
- Health dot: **green** on track; **amber** due ≤7 days or some open issues; **red** overdue
  or has an open high-severity issue.
- Sub-project count chip.

### c. View modes & sorting (control bar)
- View toggle: **Grid** (current) / **List** (dense rows) / **Board** (columns by status).
- Sort: due date · progress · last activity · status · name.
- Existing classification tabs, search, and group-by-classification are preserved.
- Pinned projects sort first within any view/sort.

### d. Per-project quick actions (card hover/menu)
- Change status inline.
- Pin/favorite (toggles `is_pinned`; pinned sort first).
- Archive (sets `archived_at`; archived hidden by default, shown via an "Archived" filter).
- Duplicate — copies the project row plus its objectives, cards, and sub-projects (with their
  cards/objectives). New IDs; name suffixed " (copy)".
- Quick-add sub-project — inline, without opening the project.

### Rollup data loading
Rollups need objectives/issues/cards/sub-projects for **all** projects, not just the open one.
Add a lightweight aggregate load on the home screen that selects only the columns needed for
rollups (e.g. `objectives(project_id, sub_project_id, completed)`, `issues(project_id, status,
severity)`, `sub_projects(project_id)`), rather than full records. Store derived per-project
rollup objects in a selector/`uiStore` or computed in `ProjectList`. Keep it to a few queries
so the home screen stays fast.

## Offline Sync & Error Handling

- All new mutations follow the existing pattern: Supabase first, on failure
  `enqueueMutation(table, op, payload)` to the IndexedDB sync queue; `flushQueue()` replays on
  reconnect. New tables/columns (`sub_projects`, `sub_project_id`, `is_pinned`, `archived_at`)
  are added to the sync-queue table whitelist / `Database` types in `src/db/types.ts`.
- Duplicate is a multi-row operation; perform it server-side-first and only enqueue if offline,
  duplicating in dependency order (project → sub_projects → objectives/cards).

## Testing

- `subProjectStore`: create/rename/reorder/delete; delete cascades cards + objectives.
- `cardStore` / `objectivesStore` scope: parent queries (sub_project_id null) exclude
  sub-project rows and vice-versa; create writes correct scope.
- Rollup computation: completion %, health-dot thresholds (overdue / ≤7 days / high-severity),
  combined parent+sub objectives — pure functions, unit-tested.
- Sort + view-mode + pinned ordering: pinned first, then chosen sort key.
- Duplicate: produces independent copies with new IDs across all nested rows.

## Out of Scope (YAGNI)

- Deep nesting (sub-projects of sub-projects) — one level only.
- Sub-projects having their own BOM / Hardware / Notes / Issues tabs.
- A separate top-level "Sub-Projects" tab.
