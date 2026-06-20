import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useCardStore } from '@/store/cardStore'
import type { CardColumn, Database } from '@/db/types'

type Card = Database['public']['Tables']['cards']['Row']

const COLUMNS: { key: CardColumn; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

const COLUMN_ACCENT: Record<CardColumn, string> = {
  backlog: 'var(--color-border)',
  in_progress: 'var(--color-accent)',
  done: 'var(--color-success)',
}

function MiniCard({ card, onDelete }: { card: Card; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  })

  return (
    <div style={{ position: 'relative' }} className="group">
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Translate.toString(transform),
          opacity: isDragging ? 0.5 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          backgroundColor: 'var(--color-surface-3)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '0.375rem',
          padding: '6px 8px',
          fontSize: '12px',
          color: 'var(--color-text-primary)',
          lineHeight: '1.4',
          userSelect: 'none',
        }}
        {...attributes}
        {...listeners}
      >
        {card.title}
      </div>
      <button
        onClick={onDelete}
        style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          display: 'none',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '50%',
          width: '16px',
          height: '16px',
          fontSize: '10px',
          lineHeight: '14px',
          textAlign: 'center',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          padding: 0,
        }}
        className="group-hover:!block"
        aria-label={`Delete card: ${card.title}`}
      >
        ✕
      </button>
    </div>
  )
}

function MiniColumn({ col, label, cards, onDelete }: {
  col: CardColumn
  label: string
  cards: Card[]
  onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col })
  const accent = COLUMN_ACCENT[col]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--color-surface-1)',
        borderRadius: '0.375rem',
        border: `1px solid ${isOver ? accent : 'var(--color-border)'}`,
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px',
          borderBottom: `2px solid ${accent}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: accent,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '0 5px',
            borderRadius: '0.25rem',
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text-muted)',
            minWidth: '16px',
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
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minHeight: '80px',
        }}
      >
        {cards.map(card => (
          <MiniCard key={card.id} card={card} onDelete={() => onDelete(card.id)} />
        ))}
        {cards.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px dashed ${isOver ? accent : 'var(--color-border-subtle)'}`,
              borderRadius: '0.375rem',
              color: 'var(--color-text-muted)',
              fontSize: '11px',
              minHeight: '60px',
              transition: 'border-color 0.15s',
            }}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

export function MiniBoard({ projectId, subProjectId }: { projectId: string; subProjectId: string }) {
  const { cards, loadCards, addCard, moveCard, deleteCard } = useCardStore()
  const [title, setTitle] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  useEffect(() => {
    void loadCards(projectId, subProjectId)
  }, [projectId, subProjectId, loadCards])

  const scoped = cards
    .filter(c => c.sub_project_id === subProjectId)
    .sort((a, b) => a.position - b.position)

  const columnCards = (col: CardColumn) => scoped.filter(c => c.column === col)

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const cardId = active.id as string
    const targetCol = over.id as CardColumn
    const card = scoped.find(c => c.id === cardId)
    if (!card || card.column === targetCol) return
    const position = columnCards(targetCol).length
    void moveCard(cardId, targetCol, position)
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    const position = columnCards('backlog').length
    void addCard({
      project_id: projectId,
      sub_project_id: subProjectId,
      title: t,
      type: 'software',
      column: 'backlog',
      position,
      description: null,
      scratchpad_tag: null,
      meta: null,
      blocked_by: [],
      bom_item_id: null,
      machine_id: null,
      target_timestamp: null,
      status_flags: [],
      machine_session_start: null,
    })
    setTitle('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {COLUMNS.map(col => (
            <MiniColumn
              key={col.key}
              col={col.key}
              label={col.label}
              cards={columnCards(col.key)}
              onDelete={(id) => void deleteCard(id)}
            />
          ))}
        </div>
      </DndContext>

      <form
        onSubmit={handleAdd}
        style={{ display: 'flex', gap: '6px' }}
      >
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Add task…"
          style={{
            flex: 1,
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.375rem',
            padding: '4px 8px',
            fontSize: '12px',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '4px 10px',
            fontSize: '12px',
            borderRadius: '0.375rem',
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </form>
    </div>
  )
}
