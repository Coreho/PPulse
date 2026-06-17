/**
 * FileVaultPanel — UI for the File Vault subsystem.
 *
 * Displays watched CAD files (.stl / .step / .stp), their change status,
 * and lets the user link each file to a Kanban card.
 */

import { useEffect } from 'react'
import {
  FolderOpen,
  ArrowClockwise,
  WarningCircle,
  File,
} from '@phosphor-icons/react'
import { useFileVaultStore } from './fileVaultStore'
import { fileVaultWatcher } from './fileVault'
import { useProjectStore } from '@/store/projectStore'
import { useCardStore } from '@/store/cardStore'
import type { VaultEntry } from './fileVault'

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-0)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.25rem',
  padding: '3px 6px',
  fontSize: '11px',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  maxWidth: '140px',
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: VaultEntry['status'] }) {
  const isOutdated = status === 'outdated'
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: isOutdated ? '#fb923c' : '#4ade80',
        backgroundColor: isOutdated ? 'rgba(251,146,60,0.12)' : 'rgba(74,222,128,0.12)',
        padding: '1px 6px',
        borderRadius: '0.25rem',
        border: `1px solid ${isOutdated ? 'rgba(251,146,60,0.3)' : 'rgba(74,222,128,0.3)'}`,
        flexShrink: 0,
        textTransform: 'uppercase',
      }}
    >
      {isOutdated ? 'OUTDATED' : 'current'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// File entry row
// ---------------------------------------------------------------------------

interface EntryRowProps {
  entry: VaultEntry
  cards: { id: string; title: string }[]
  onLinkCard: (entryId: string, cardId: string | null) => void
}

function EntryRow({ entry, cards, onLinkCard }: EntryRowProps) {
  const linkedCard = entry.linkedCardId
    ? cards.find((c) => c.id === entry.linkedCardId)
    : null
  const isOutdated = entry.status === 'outdated'

  return (
    <div
      style={{
        padding: '8px 10px',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.375rem',
        border: `1px solid ${isOutdated ? 'rgba(251,146,60,0.3)' : 'var(--color-border-subtle)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
      }}
    >
      {/* Top row: filename + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <File
          size={12}
          style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
        />
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={entry.filePath}
        >
          {entry.fileName}
        </span>
        <StatusBadge status={entry.status} />
      </div>

      {/* Path row */}
      <span
        style={{
          fontSize: '10px',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingLeft: '18px',
        }}
        title={entry.filePath}
      >
        {entry.filePath}
      </span>

      {/* Bottom row: card link selector + outdated card warning */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '18px' }}>
        <select
          style={selectStyle}
          value={entry.linkedCardId ?? ''}
          onChange={(e) =>
            onLinkCard(entry.id, e.target.value || null)
          }
          aria-label="Link to card"
        >
          <option value="">No linked card</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title.slice(0, 36)}
            </option>
          ))}
        </select>

        {isOutdated && linkedCard && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              color: '#fb923c',
              fontWeight: 600,
            }}
          >
            <WarningCircle size={12} weight="fill" />
            {linkedCard.title.slice(0, 24)}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel root
// ---------------------------------------------------------------------------

export function FileVaultPanel() {
  const {
    entries,
    hasDirectory,
    loadEntries,
    openDirectory,
    linkCard,
    refreshScan,
  } = useFileVaultStore()

  const { activeProject } = useProjectStore()
  const { cards } = useCardStore()

  const supported = fileVaultWatcher.isSupported()
  const projectId = activeProject?.id ?? ''

  // On mount: restore handle + load persisted entries.
  // The store's startPolling callback already routes file-change events through
  // markOutdated — no extra onFileChange listener needed here.
  useEffect(() => {
    if (!projectId) return
    loadEntries(projectId)
  }, [projectId, loadEntries])

  const cardOptions = cards.map((c) => ({ id: c.id, title: c.title }))
  const outdatedCount = entries.filter((e) => e.status === 'outdated').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          gap: '6px',
        }}
      >
        {/* Left: icon + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <FolderOpen size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <span
            style={{
              fontSize: '11px',
              color: hasDirectory
                ? 'var(--color-text-secondary)'
                : 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hasDirectory
              ? `${entries.length} file${entries.length !== 1 ? 's' : ''} watched`
              : 'No folder open'}
          </span>
          {outdatedCount > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#fb923c',
                backgroundColor: 'rgba(251,146,60,0.12)',
                padding: '1px 5px',
                borderRadius: '0.25rem',
                flexShrink: 0,
              }}
            >
              {outdatedCount} OUTDATED
            </span>
          )}
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {hasDirectory && (
            <button
              type="button"
              onClick={() => projectId && refreshScan(projectId)}
              title="Refresh scan"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                cursor: 'pointer',
              }}
            >
              <ArrowClockwise size={11} />
              Refresh
            </button>
          )}

          <button
            type="button"
            disabled={!supported}
            onClick={() => projectId && openDirectory(projectId)}
            title={
              supported
                ? 'Open a directory to watch'
                : 'File System Access API requires Chrome or Edge'
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: supported ? 'var(--color-accent)' : 'var(--color-text-muted)',
              backgroundColor: supported
                ? 'rgba(34,211,238,0.1)'
                : 'var(--color-surface-2)',
              border: supported
                ? '1px solid rgba(34,211,238,0.3)'
                : '1px solid var(--color-border)',
              borderRadius: '0.25rem',
              cursor: supported ? 'pointer' : 'not-allowed',
              opacity: supported ? 1 : 0.5,
            }}
          >
            <FolderOpen size={11} weight="bold" />
            Open Folder
          </button>
        </div>
      </div>

      {/* ── Compat warning ─────────────────────────────────────────────── */}
      {!supported && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            margin: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            color: '#fb923c',
            backgroundColor: 'rgba(251,146,60,0.08)',
            border: '1px solid rgba(251,146,60,0.25)',
            borderRadius: '0.375rem',
          }}
        >
          <WarningCircle size={13} weight="fill" />
          File System Access API requires Chrome or Edge.
        </div>
      )}

      {/* ── Scrollable file list ────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {/* Empty state */}
        {entries.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              paddingTop: '32px',
            }}
          >
            <FolderOpen size={30} style={{ opacity: 0.25 }} />
            <span style={{ textAlign: 'center', maxWidth: '180px', lineHeight: 1.5 }}>
              No folder open. Click <strong>Open Folder</strong> to watch CAD files.
            </span>
          </div>
        )}

        {/* Entry rows */}
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            cards={cardOptions}
            onLinkCard={linkCard}
          />
        ))}
      </div>
    </div>
  )
}
