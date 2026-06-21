import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Plus, X } from '@phosphor-icons/react'
import { useCardStore } from '@/store/cardStore'
import type { CardColumn, CardType, Database } from '@/db/types'
import { KanbanCard } from './Card'

type Card = Database['public']['Tables']['cards']['Row']

interface ColumnProps {
  id: CardColumn
  title: string
  cards: Card[]
  allCards: Card[]
  projectId: string
}

const COLUMN_ACCENT: Record<CardColumn, string> = {
  backlog: 'var(--color-border)',
  in_progress: 'var(--color-accent)',
  done: 'var(--color-success)',
}

const COLUMN_BADGE_BG: Record<CardColumn, string> = {
  backlog: 'rgba(63,63,70,0.5)',
  in_progress: 'rgba(34,211,238,0.15)',
  done: 'rgba(74,222,128,0.15)',
}

const COLUMN_BADGE_COLOR: Record<CardColumn, string> = {
  backlog: 'var(--color-text-muted)',
  in_progress: 'var(--color-accent)',
  done: 'var(--color-success)',
}

export function Column({ id, title, cards, allCards, projectId }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const { addCard } = useCardStore()

  const [composerOpen, setComposerOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<CardType>('software')

  const handleAdd = async () => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    await addCard({
      project_id: projectId,
      sub_project_id: null,
      type: newType,
      title: trimmed,
      description: null,
      column: id,
      position: cards.length,
      scratchpad_tag: null,
      meta: null,
      blocked_by: [],
      bom_item_id: null,
      machine_id: null,
      target_timestamp: null,
      status_flags: [],
      machine_session_start: null,
    })
    setNewTitle('')
    setNewType('software')
    setComposerOpen(false)
  }

  const handleCancel = () => {
    setNewTitle('')
    setNewType('software')
    setComposerOpen(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--color-surface-1)',
        borderRadius: '0.5rem',
        border: `1px solid ${isOver ? COLUMN_ACCENT[id] : 'var(--color-border)'}`,
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: `2px solid ${COLUMN_ACCENT[id]}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: COLUMN_ACCENT[id],
          }}
        >
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: '0.25rem',
              backgroundColor: COLUMN_BADGE_BG[id],
              color: COLUMN_BADGE_COLOR[id],
              minWidth: '20px',
              textAlign: 'center',
            }}
          >
            {cards.length}
          </span>
          <button
            type="button"
            onClick={() => setComposerOpen(o => !o)}
            aria-label={`Add card to ${title}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '0.25rem',
              border: 'none',
              background: composerOpen ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)',
              color: composerOpen ? '#a855f7' : 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Plus size={12} weight="bold" />
          </button>
        </div>
      </div>

      {/* Inline card composer */}
      {composerOpen && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '8px',
            margin: '8px 8px 0',
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            placeholder="Card title..."
            value={newTitle}
            autoFocus
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleAdd()
              if (e.key === 'Escape') handleCancel()
            }}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '7px 10px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['software', 'hardware'] as CardType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: newType === t
                      ? (t === 'software' ? '#8b5cf6' : '#22d3ee')
                      : 'rgba(255,255,255,0.06)',
                    color: newType === t ? '#fff' : 'var(--color-text-muted)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {t === 'software' ? 'SW' : 'HW'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={!newTitle.trim()}
                style={{
                  padding: '5px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
                  background: newTitle.trim() ? '#a855f7' : 'rgba(255,255,255,0.06)',
                  color: newTitle.trim() ? '#fff' : 'var(--color-text-muted)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minHeight: '120px',
        }}
      >
        {cards.map(card => (
          <KanbanCard key={card.id} card={card} allCards={allCards} />
        ))}

        {cards.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px dashed ${isOver ? COLUMN_ACCENT[id] : 'var(--color-border-subtle)'}`,
              borderRadius: '0.5rem',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              minHeight: '80px',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            Drop cards here
          </div>
        )}
      </div>
    </div>
  )
}
