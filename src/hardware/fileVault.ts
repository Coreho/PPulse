/**
 * FileVaultWatcher — File System Access API integration for ProjectPulse.
 *
 * Watches a user-selected directory for .stl and .step files, compares
 * modification times to stored baselines, and marks entries as 'outdated'
 * when a file has changed.
 *
 * Directory handle is persisted in IndexedDB (`fs_handles` store) so the
 * watcher can attempt a silent restore on page load without prompting the
 * user unless the permission has been revoked.
 */

import { getDB } from '../db/idb'

export interface VaultEntry {
  id: string
  projectId: string
  fileName: string
  filePath: string
  lastSeenMtime: number
  status: 'current' | 'outdated'
  linkedCardId: string | null
}

type ChangeListener = (entry: VaultEntry) => void

const SUPPORTED_EXTENSIONS = ['.stl', '.step', '.stp']

export class FileVaultWatcher {
  private handle: FileSystemDirectoryHandle | null = null
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private changeListeners: ChangeListener[] = []

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Returns true if File System Access API is supported. */
  isSupported(): boolean {
    return 'showDirectoryPicker' in window
  }

  /**
   * Open the OS directory picker and persist the handle in IndexedDB.
   * Must be called from a user gesture.
   */
  async openDirectory(projectId: string): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser.')
    }

    const dirHandle = await window.showDirectoryPicker({ mode: 'read' })
    this.handle = dirHandle
    await this.persistHandle(projectId, dirHandle)
  }

  /**
   * Try to restore a previously stored handle from IndexedDB.
   * Returns true if the handle was restored and permission is already granted.
   * Returns false if the handle doesn't exist or requires re-prompting — in that
   * case the UI should show a "Reconnect folder" button.
   */
  async restoreDirectory(projectId: string): Promise<boolean> {
    const db = await getDB()
    const stored = await db.get('fs_handles', projectId)
    if (!stored) return false

    const dirHandle = stored.handle as FileSystemDirectoryHandle

    // Check permission without prompting
    let perm: PermissionState
    try {
      perm = await dirHandle.queryPermission({ mode: 'read' })
    } catch {
      return false
    }

    if (perm === 'granted') {
      this.handle = dirHandle
      return true
    }

    // 'prompt' state — caller should show "Reconnect folder" button which calls
    // openDirectory() again. We still store the handle reference so openDirectory
    // can be called without a picker by re-requesting permission.
    return false
  }

  /**
   * Start polling the directory every 30 seconds.
   * @param entries    Current vault entries to compare against.
   * @param onOutdated Called when an entry's mtime has changed.
   */
  startPolling(entries: VaultEntry[], onOutdated: (entry: VaultEntry) => void): void {
    if (this.pollInterval !== null) return

    this.pollInterval = setInterval(async () => {
      if (!this.handle) return

      let scanned: { fileName: string; filePath: string; mtime: number }[]
      try {
        scanned = await this.scanDirectory()
      } catch {
        // Directory may have been moved or permission revoked — stop polling
        this.stopPolling()
        return
      }

      for (const entry of entries) {
        const found = scanned.find((s) => s.filePath === entry.filePath)
        if (!found) continue

        if (found.mtime > entry.lastSeenMtime) {
          const outdated: VaultEntry = { ...entry, status: 'outdated' }
          this.emitChange(outdated)
          onOutdated(outdated)
        }
      }
    }, 30_000)
  }

  /** Stop the polling interval. */
  stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * Recursively scan the open directory for .stl and .step files.
   * Returns file name, virtual path, and last modified timestamp.
   */
  async scanDirectory(): Promise<{ fileName: string; filePath: string; mtime: number }[]> {
    if (!this.handle) {
      throw new Error('No directory open. Call openDirectory() or restoreDirectory() first.')
    }

    const results: { fileName: string; filePath: string; mtime: number }[] = []
    await this.walkDirectory(this.handle, '', results)
    return results
  }

  /**
   * Register a listener for file change events.
   * @returns An unsubscribe function.
   */
  onFileChange(cb: ChangeListener): () => void {
    this.changeListeners.push(cb)
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== cb)
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async walkDirectory(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    results: { fileName: string; filePath: string; mtime: number }[],
  ): Promise<void> {
    for await (const [name, entry] of dirHandle.entries()) {
      const entryPath = prefix ? `${prefix}/${name}` : name

      if (entry.kind === 'directory') {
        await this.walkDirectory(entry as FileSystemDirectoryHandle, entryPath, results)
      } else if (entry.kind === 'file') {
        const ext = name.toLowerCase().slice(name.lastIndexOf('.'))
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            const fileHandle = entry as FileSystemFileHandle
            const file = await fileHandle.getFile()
            results.push({
              fileName: name,
              filePath: entryPath,
              mtime: file.lastModified,
            })
          } catch {
            // File may have been deleted between iteration and getFile() — skip
          }
        }
      }
    }
  }

  private async persistHandle(
    projectId: string,
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<void> {
    const db = await getDB()
    await db.put('fs_handles', { key: projectId, handle: dirHandle })
  }

  private emitChange(entry: VaultEntry): void {
    for (const listener of this.changeListeners) {
      try {
        listener(entry)
      } catch (err) {
        console.error('[FileVaultWatcher] Change listener threw:', err)
      }
    }
  }
}

export const fileVaultWatcher = new FileVaultWatcher()
