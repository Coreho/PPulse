# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ProjectPulse (PP)** is a browser-based hybrid workspace for technical creators managing both software development and physical fabrication projects. It combines an infinite-scroll GFM scratchpad (left pane) with a 3-column Kanban board (right pane), with deep integration into browser hardware APIs.

## Intended Tech Stack

- **Frontend**: React + TypeScript (Vite)
- **State**: Zustand (or Redux Toolkit if cross-tab sync is needed)
- **Markdown**: `@codemirror/lang-markdown` for the scratchpad editor; `remark`/`unified` for AST parsing
- **Drag & Drop**: `@dnd-kit/core`
- **Persistence**: IndexedDB via `idb` (offline-first, no backend)
- **Notifications**: Service Worker + Web Push API
- **Hardware APIs**: Web Serial API, WebHID API, File System Access API, Web Audio API
- **Build**: Vite with PWA plugin (`vite-plugin-pwa`) for Service Worker support

## Architecture

### Pane Layout
Two resizable panes rendered side-by-side. The scratchpad and Kanban board share a single project state slice; a bridge layer (the "sync engine") reconciles changes between the AST representation of the scratchpad and the card store.

### Card ↔ Scratchpad Sync
Highlighting text in the scratchpad and clicking "Create Card" parses the selection via remark into an AST node. The node gets a UUID comment tag (`<!-- pp-card:UUID -->`). The card store watches for edits to those tagged lines (debounced 500ms) and updates card titles bidirectionally. This bridge lives in `src/sync/`.

### Card Types
Cards have a `type` field: `"software"` or `"hardware"`. The card schema diverges in `meta`:
- Software: `{ repo, branch, targetMCU, language }`
- Hardware: `{ material, dimensions, slicerProfile, estimatedWeight_g }`

### Key Subsystems

| Subsystem | Location | API Used |
|---|---|---|
| Serial/COM monitor | `src/hardware/serial.ts` | Web Serial API |
| File vault watcher | `src/hardware/fileVault.ts` | File System Access API |
| Notification scheduler | `src/workers/` | Service Worker + Web Push |
| Audio alert engine | `src/audio/alertEngine.ts` | Web Audio API |
| Pinout mapper | `src/pinout/` | — |
| BOM tracker | `src/bom/` | — |

### Service Worker
Registered via Vite PWA plugin. Handles background push events for print-time reminders. The SW communicates with the main thread via `postMessage` / `BroadcastChannel`. SW source is in `src/sw/`.

### Dependency Interlocks
Cards can declare `blockedBy: UUID[]`. The Kanban drag handler checks this list before allowing a drop into "In Progress" or "Done". The dependency graph is a DAG stored in Zustand; cycles are rejected at link creation time.

## Commands

> Commands will be added here once the project is scaffolded with Vite. Typical:

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm test          # Vitest
```

## Browser API Constraints

- Web Serial, WebHID, and File System Access require **HTTPS or localhost** and explicit user gesture to request permissions. Never call `.requestPort()` / `.showOpenFilePicker()` on page load — always gate behind a user action.
- Service Workers require HTTPS in production. The Vite PWA plugin handles dev-mode SW shimming.
- Web Push requires a VAPID key pair. Keys live in `.env` (`VITE_VAPID_PUBLIC_KEY`). Never commit the private key.

## Data Persistence

All project data (cards, BOM, pinouts, machine hours) is stored in IndexedDB under the key `pp-workspace`. No backend. Export/import is JSON. Schema migrations are versioned in `src/db/migrations/`.

## Linear Project

Issues are tracked in Linear under the **PP** team. Feature work follows the spec phases (Architecture → Frontend → Systems → Integration).
