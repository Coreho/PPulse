# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ProjectPulse (PP)** is a browser-based project management tool for technical creators managing software and hardware projects. The UI is **project-centric**: a home screen lists all projects; opening one reveals a 7-tab detail view per project.

## Intended Tech Stack

- **Frontend**: React + TypeScript (Vite)
- **State**: Zustand — one store per domain (`projectStore`, `cardStore`, `bomStore`, `objectivesStore`, `issuesStore`, `machineStore`, `pinoutStore`, `fileVaultStore`)
- **Markdown**: `@codemirror/lang-markdown` for the Notes tab editor
- **Drag & Drop**: `@dnd-kit/core` (Kanban board)
- **Persistence**: Supabase (primary) + IndexedDB sync queue via `idb` (offline fallback)
- **Notifications**: Service Worker + Web Push API
- **Hardware APIs**: Web Serial API, File System Access API, Web Audio API
- **Build**: Vite + `vite-plugin-pwa`

## Architecture

### Navigation Model
- **Home** (`activeProject === null`): `ProjectList` — grid of project cards, create/delete projects
- **Detail** (`activeProject` set): `ProjectDetail` — 7-tab view scoped to the active project

### Project Detail Tabs

| Tab | Component | Description |
|---|---|---|
| Overview | inline in `ProjectDetail` | Edit name, classification, status, est. completion date, description |
| Objectives | inline in `ProjectDetail` | Checklist with progress bar; add/check/edit/delete |
| BOM | `BomPanel` | Bill of materials with stock tracking |
| Issues | inline in `ProjectDetail` | Issue tracker with severity, open/closed, notes |
| Kanban | `Board` | 3-column Kanban (Backlog → In Progress → Done) scoped to `projectId` |
| Notes | `Scratchpad` | GFM markdown editor, synced to `projects.scratchpad_content` |
| Hardware | `HardwareTab` | Sub-nav: Serial Monitor, Pinout Mapper, File Vault, Machines, Timers |

### Data Model
Everything is scoped to a `project_id`. Key tables:
- `projects` — name, description, classification, status, estimated_completion_date, scratchpad_content
- `objectives` — checklist items per project (title, completed, position)
- `issues` — issue tracker per project (title, description, severity, status)
- `cards` — Kanban cards per project
- `bom_items`, `machines`, `pinouts`, `file_vault_entries`, `timers` — all scoped to project

### Card Types
Cards have a `type` field: `"software"` or `"hardware"`. The card schema diverges in `meta`:
- Software: `{ repo, branch, targetMCU, language }`
- Hardware: `{ material, dimensions, slicerProfile, estimatedWeight_g, printTime_minutes }`

### Offline Sync
All mutations try Supabase first; on failure they enqueue to `sync_queue` in IndexedDB. On reconnect (`window.online`), `flushQueue()` in `App.tsx` replays the queue.

### Key Subsystems

| Subsystem | Location | API |
|---|---|---|
| Serial/COM monitor | `src/hardware/` | Web Serial API |
| File vault watcher | `src/hardware/fileVault.ts` | File System Access API |
| Audio alert engine | `src/audio/alertEngine.ts` | Web Audio API |
| Pinout mapper | `src/pinout/` | — |
| BOM tracker | `src/bom/` | — |
| Timer + push | `src/timers/`, `src/sw/` | Service Worker + Web Push |

### Service Worker
Registered via Vite PWA plugin. Handles background push events for print-time reminders. SW source: `src/sw/sw.ts`.

### Kanban Dependency Interlocks
Cards declare `blockedBy: UUID[]`. Drag handler blocks movement to In Progress/Done if blockers are unresolved. DAG stored in Zustand; cycles rejected at link creation.

## Commands

```bash
npm run dev       # Start dev server (localhost:5173)
npx vite build    # Production build (used in Docker — skips tsc -b)
npm run typecheck # tsc --noEmit
npm run lint      # ESLint
```

> Note: `npm run build` runs `tsc -b && vite build`. The Docker build uses `npx vite build` directly to skip the tsc project-reference check (Web Serial API types are missing from lib).

## Browser API Constraints

- Web Serial, File System Access require **HTTPS or localhost** and explicit user gesture. Never call `.requestPort()` / `.showOpenFilePicker()` on page load.
- Service Workers require HTTPS in production.
- Web Push requires VAPID keys in `.env.production` (`VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).

## Deployment

Docker + Nginx behind Nginx Proxy Manager on the VPS. `docker compose up -d --build` from `/home/corey/PPulse`. The `ppulse-app` and `ppulse-push-relay` containers join the `proxy-nw` Docker network so NPM can proxy them by container name.

Domain: **pulse.koreokorp.com**

## Linear Project

Issues tracked in Linear under the **PP** team.
