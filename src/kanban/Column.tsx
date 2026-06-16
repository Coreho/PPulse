import { useDroppable } from '@dnd-kit/core'
import type { CardColumn, Database } from '@/db/types'
import { KanbanCard } from './Card'

type Card = Database['public']['Tables']['cards']['Row']

interface ColumnProps {
  id: CardColumn
  title: string
  cards: Card[]
  allCards: Card[]
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

export function Column({ id, title, cards, allCards }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

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
      </div>

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
