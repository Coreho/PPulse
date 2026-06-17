/**
 * fileVaultStore — Zustand store for the File Vault panel.
 *
 * Manages vault entries (watched CAD files), directory open state, and
 * card-link associations. Persists entries to IndexedDB under the
 * `vault_entries` store so they survive page reloads.
 */

import { create } from 'zustand'
import { getDB } from '@/db/idb'
import { fileVaultWatcher, type VaultEntry } from './fileVault'
import { useCardStore } from '@/store/cardStore'

interface FileVaultStore {
  entries: VaultEntry[]
  hasDirectory: boolean
  directoryName: string | null

  /** Restore handle from IDB + load persisted entries. Call on mount. */
  loadEntries: (projectId: string) => Promise<void>
  /** Open OS directory picker (must be user gesture) + run initial scan. */
  openDirectory: (projectId: string) => Promise<void>
  /** Mark an entry as outdated and propagate to its linked card. */
  markOutdated: (entry: VaultEntry) => void
  /** Link (or unlink) a vault entry to a Kanban card. */
  linkCard: (entryId: string, cardId: string | null) => void
  /** Re-scan the open directory and reconcile with stored entries. */
  refreshScan: (projectId: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// IDB helpers
// ---------------------------------------------------------------------------

async function persistEntries(projectId: string, entries: VaultEntry[]): Promise<void> {
  const db = await getDB()
  await db.put('vault_entries', { projectId, entries })
}

async function loadPersistedEntries(projectId: string): Promise<VaultEntry[]> {
  const db = await getDB()
  const stored = await db.get('vault_entries', projectId)
  return stored?.entries ?? []
}

// ---------------------------------------------------------------------------
// Scan reconciliation: merge fresh scan results with existing entries so that
// card links and status are preserved.
// ---------------------------------------------------------------------------

function reconcile(
  existing: VaultEntry[],
  scanned: { fileName: string; filePath: string; mtime: number }[],
  projectId: string,
): VaultEntry[] {
  const updated: VaultEntry[] = scanned.map((s) => {
    const prev = existing.find((e) => e.filePath === s.filePath)
    if (prev) {
      return {
        ...prev,
        lastSeenMtime: s.mtime,
        status: s.mtime > prev.lastSeenMtime ? 'outdated' : prev.status,
      }
    }
    return {
      id: crypto.randomUUID(),
      projectId,
      fileName: s.fileName,
      filePath: s.filePath,
      lastSeenMtime: s.mtime,
      status: 'current' as const,
      linkedCardId: null,
    }
  })
  return updated
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFileVaultStore = create<FileVaultStore>((set, get) => ({
  entries: [],
  hasDirectory: false,
  directoryName: null,

  loadEntries: async (projectId) => {
    const restored = await fileVaultWatcher.restoreDirectory(projectId)
    const entries = await loadPersistedEntries(projectId)
    set({ entries, hasDirectory: restored })

    if (restored) {
      // Start polling with the loaded entries
      fileVaultWatcher.startPolling(entries, (outdated) => {
        get().markOutdated(outdated)
      })
    }
  },

  openDirectory: async (projectId) => {
    await fileVaultWatcher.openDirectory(projectId)

    // Resolve the directory name from the handle via a fresh scan
    let scanned: { fileName: string; filePath: string; mtime: number }[] = []
    try {
      scanned = await fileVaultWatcher.scanDirectory()
    } catch {
      // directory opened but scan failed; start with empty list
    }

    const existing = get().entries
    const entries = reconcile(existing, scanned, projectId)

    set({ entries, hasDirectory: true })
    await persistEntries(projectId, entries)

    fileVaultWatcher.stopPolling()
    fileVaultWatcher.startPolling(entries, (outdated) => {
      get().markOutdated(outdated)
    })
  },

  markOutdated: (entry) => {
    set((s) => {
      const entries = s.entries.map((e) =>
        e.id === entry.id ? { ...e, status: 'outdated' as const } : e,
      )
      return { entries }
    })

    // Propagate to linked card
    if (entry.linkedCardId) {
      useCardStore.getState().addStatusFlag(entry.linkedCardId, 'outdated')
    }

    // Persist async (fire-and-forget; the panel will show the new state)
    const { entries } = get()
    if (entries.length > 0) {
      const projectId = entries[0].projectId
      persistEntries(projectId, entries).catch((err) =>
        console.error('[FileVaultStore] Failed to persist after markOutdated:', err),
      )
    }

    // Restart polling with the updated entries so the stale closure in
    // startPolling no longer fires for the same file on every subsequent tick.
    fileVaultWatcher.stopPolling()
    fileVaultWatcher.startPolling(get().entries, (outdated) => get().markOutdated(outdated))
  },

  linkCard: (entryId, cardId) => {
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, linkedCardId: cardId } : e,
      ),
    }))

    const { entries } = get()
    if (entries.length > 0) {
      const projectId = entries[0].projectId
      persistEntries(projectId, entries).catch((err) =>
        console.error('[FileVaultStore] Failed to persist after linkCard:', err),
      )
    }
  },

  refreshScan: async (projectId) => {
    let scanned: { fileName: string; filePath: string; mtime: number }[] = []
    try {
      scanned = await fileVaultWatcher.scanDirectory()
    } catch {
      // Permission revoked or directory moved — stop polling
      fileVaultWatcher.stopPolling()
      set({ hasDirectory: false })
      return
    }

    const existing = get().entries
    const entries = reconcile(existing, scanned, projectId)

    set({ entries })
    await persistEntries(projectId, entries)

    // Restart polling with updated entry list
    fileVaultWatcher.stopPolling()
    fileVaultWatcher.startPolling(entries, (outdated) => {
      get().markOutdated(outdated)
    })
  },
}))
