import { useEffect } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useCardStore } from '@/store/cardStore'
import { supabase } from '@/db/supabase'
import { useToast } from '@/ui/Toast'
import type { CardColumn, Database, HardwareMeta } from '@/db/types'
import { Column } from './Column'

type Card = Database['public']['Tables']['cards']['Row']

interface BoardProps {
  projectId: string
}

const COLUMNS: { id: CardColumn; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

export function Board({ projectId }: BoardProps) {
  const { cards, loadCards, moveCard, updateCard } = useCardStore()
  const addToast = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  useEffect(() => {
    loadCards(projectId)
  }, [projectId, loadCards])

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`cards:project_id=eq.${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Re-load cards on any remote change
          loadCards(projectId)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, loadCards])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const cardId = active.id as string
    const targetColumn = over.id as CardColumn

    const card = cards.find(c => c.id === cardId)
    if (!card) return

    // Don't do anything if dropped on same column
    if (card.column === targetColumn) return

    // Check dependency interlocks
    if (targetColumn === 'in_progress' || targetColumn === 'done') {
      const unmetDeps = card.blocked_by.filter(depId => {
        const dep = cards.find(c => c.id === depId)
        return dep && dep.column !== 'done'
      })
      if (unmetDeps.length > 0) {
        addToast(`Cannot move card: ${unmetDeps.length} blocking dependency not done`, 'error')
        return
      }
    }

    // BOM interlock: target is in_progress and BOM item has low_stock flag
    if (targetColumn === 'in_progress' && card.status_flags.includes('low_stock')) {
      addToast('Cannot move to In Progress: BOM item is out of stock', 'warn')
      return
    }

    // Machine lock interlock
    if (targetColumn === 'in_progress' && card.status_flags.includes('needs_maintenance')) {
      addToast('Cannot move to In Progress: machine requires maintenance', 'warn')
      return
    }

    // Compute position as end of target column
    const targetCards = cards.filter(c => c.column === targetColumn)
    const newPosition = targetCards.length

    // If moving to in_progress and hardware card with printTime, set target_timestamp
    if (targetColumn === 'in_progress' && card.type === 'hardware') {
      const hwMeta = card.meta as HardwareMeta | null
      if (hwMeta?.printTime_minutes) {
        const targetTs = new Date(Date.now() + hwMeta.printTime_minutes * 60 * 1000).toISOString()
        updateCard(card.id, { target_timestamp: targetTs })
      }
    }

    moveCard(cardId, targetColumn, newPosition)
  }

  const columnCards = (col: CardColumn) =>
    cards.filter(c => c.column === col).sort((a, b) => a.position - b.position)

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        gap: '10px',
        padding: '10px',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            cards={columnCards(col.id)}
            allCards={cards}
            projectId={projectId}
          />
        ))}
      </DndContext>
    </div>
  )
}
