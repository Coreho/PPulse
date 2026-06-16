import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  LockSimple,
  Warning,
  Package,
  Wrench,
} from '@phosphor-icons/react'
import type { Database, StatusFlag } from '@/db/types'
import { CardModal } from './CardModal'

type Card = Database['public']['Tables']['cards']['Row']

interface CardProps {
  card: Card
  allCards: Card[]
}

function CountdownTimer({ targetTimestamp }: { targetTimestamp: string }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(targetTimestamp).getTime() - Date.now()
    return Math.max(0, diff)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(targetTimestamp).getTime() - Date.now()
      setRemaining(Math.max(0, diff))
    }, 10000)
    return () => clearInterval(interval)
  }, [targetTimestamp])

  const totalMinutes = Math.floor(remaining / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (remaining === 0) {
    return (
      <span style={{ color: 'var(--color-success)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
        Done
      </span>
    )
  }

  return (
    <span style={{ color: 'var(--color-accent)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
      {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
    </span>
  )
}

const STATUS_FLAG_ICONS: Record<StatusFlag, React.ReactNode> = {
  blocked: <LockSimple size={12} weight="fill" style={{ color: 'var(--color-danger)' }} />,
  outdated: <Warning size={12} weight="fill" style={{ color: 'var(--color-warn)' }} />,
  low_stock: <Package size={12} weight="fill" style={{ color: 'var(--color-warn)' }} />,
  needs_maintenance: <Wrench size={12} weight="fill" style={{ color: 'var(--color-danger)' }} />,
}

export function KanbanCard({ card, allCards }: CardProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const hasUnmetDeps = card.blocked_by.length > 0 && card.blocked_by.some(depId => {
    const dep = allCards.find(c => c.id === depId)
    return dep && dep.column !== 'done'
  })

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: hasUnmetDeps,
    data: { card },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: hasUnmetDeps ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
  }

  const isHardware = card.type === 'hardware'
  const hardwareMeta = isHardware ? (card.meta as { binLocation?: string; printTime_minutes?: number } | null) : null

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          backgroundColor: 'var(--color-surface-3)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '0.5rem',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          transition: isDragging ? 'none' : 'border-color 0.15s',
          userSelect: 'none',
        }}
        className="hover:border-[color:var(--color-border)]"
        {...attributes}
        {...listeners}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`Card: ${card.title}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setModalOpen(true) }}
      >
        {/* Header row: type badge + status flags */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '1px 5px',
              borderRadius: '0.25rem',
              backgroundColor: card.type === 'software' ? 'rgba(96,165,250,0.15)' : 'rgba(251,146,60,0.15)',
              color: card.type === 'software' ? '#60a5fa' : '#fb923c',
            }}
          >
            {card.type === 'software' ? 'SW' : 'HW'}
          </span>

          {card.status_flags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {card.status_flags.map(flag => (
                <span key={flag} title={flag.replace('_', ' ')}>
                  {STATUS_FLAG_ICONS[flag]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Title */}
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.title}
        </p>

        {/* Footer */}
        {(hardwareMeta?.binLocation || card.target_timestamp) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
            {hardwareMeta?.binLocation && (
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-muted)',
                  backgroundColor: 'var(--color-surface-2)',
                  padding: '1px 5px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {hardwareMeta.binLocation}
              </span>
            )}
            {card.target_timestamp && (
              <CountdownTimer targetTimestamp={card.target_timestamp} />
            )}
          </div>
        )}

        {hasUnmetDeps && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <LockSimple size={10} style={{ color: 'var(--color-danger)' }} />
            <span style={{ fontSize: '10px', color: 'var(--color-danger)' }}>Blocked</span>
          </div>
        )}
      </div>

      {modalOpen && (
        <CardModal card={card} allCards={allCards} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
