import { useEffect, useRef, useState } from 'react'
import { Timer, BellRinging, CheckCircle } from '@phosphor-icons/react'
import { timerManager } from './timerManager'
import type { ActiveTimer } from './timerManager'
import { alertEngine } from '@/audio/alertEngine'
import { useCardStore } from '@/store/cardStore'
import { useProjectStore } from '@/store/projectStore'
import type { TimerPhase, HardwareMeta } from '@/db/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function buildPhases(printTime_minutes: number): TimerPhase[] {
  return [
    {
      name: 'Print',
      duration_minutes: printTime_minutes,
      alert_severity: 'medium',
    },
  ]
}

// ── countdown hook ────────────────────────────────────────────────────────────

function useCountdown(timer: ActiveTimer | null): number {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!timer) {
      setRemaining(0)
      return
    }
    // Initial calculation
    setRemaining(timerManager.getRemainingTime(timer))

    const id = window.setInterval(() => {
      const r = timerManager.getRemainingTime(timer)
      setRemaining(r)
      if (r <= 0) clearInterval(id)
    }, 1000)

    return () => clearInterval(id)
  }, [timer])

  return remaining
}

// ── single card timer row ─────────────────────────────────────────────────────

interface CardTimerRowProps {
  cardId: string
  cardTitle: string
  printTime_minutes: number
  activeTimer: ActiveTimer | null
  onStart: (cardId: string, cardTitle: string, phases: TimerPhase[]) => void
  onCancel: (cardId: string) => void
}

function CardTimerRow({
  cardId,
  cardTitle,
  printTime_minutes,
  activeTimer,
  onStart,
  onCancel,
}: CardTimerRowProps) {
  const phases = buildPhases(printTime_minutes)
  const remaining = useCountdown(activeTimer)
  const isRunning = activeTimer !== null
  const isDone = isRunning && remaining <= 0

  return (
    <div
      style={{
        padding: '8px 10px',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.375rem',
        border: `1px solid ${isRunning ? 'rgba(34,211,238,0.25)' : 'var(--color-border-subtle)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {/* title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Timer
          size={13}
          style={{ color: isRunning ? 'var(--color-accent)' : 'var(--color-text-muted)', flexShrink: 0 }}
        />
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={cardTitle}
        >
          {cardTitle}
        </span>
      </div>

      {/* phase badge */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {phases.map((p) => (
          <span
            key={p.name}
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-surface-3)',
              padding: '1px 5px',
              borderRadius: '0.25rem',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {p.name} · {p.duration_minutes}m
          </span>
        ))}
      </div>

      {/* countdown + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isRunning && (
          <span
            style={{
              fontSize: '14px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: isDone ? 'var(--color-success)' : 'var(--color-accent)',
              flex: 1,
            }}
          >
            {isDone ? 'Done!' : formatMs(remaining)}
          </span>
        )}

        {!isRunning && (
          <button
            type="button"
            onClick={() => onStart(cardId, cardTitle, phases)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#09090b',
              backgroundColor: 'var(--color-accent)',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Start Timer
          </button>
        )}

        {isRunning && (
          <button
            type="button"
            onClick={() => onCancel(cardId)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-danger)',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// ── panel root ────────────────────────────────────────────────────────────────

export function TimerPanel() {
  const { cards } = useCardStore()
  const { activeProject } = useProjectStore()

  const [activeTimers, setActiveTimers] = useState<Map<string, ActiveTimer>>(new Map())
  const [pushEnabled, setPushEnabled] = useState(false)
  const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator

  // Track subscription state across mounts
  const subscriptionRef = useRef<PushSubscription | null>(null)

  const hardwareCards = cards.filter(
    (c) =>
      c.type === 'hardware' &&
      typeof (c.meta as HardwareMeta)?.printTime_minutes === 'number' &&
      ((c.meta as HardwareMeta).printTime_minutes ?? 0) > 0,
  )

  function handleStart(cardId: string, cardTitle: string, phases: TimerPhase[]) {
    alertEngine.unlock()
    timerManager.schedule(cardId, cardTitle, phases)

    const timer: ActiveTimer = {
      cardId,
      cardTitle,
      phases,
      startedAt: Date.now(),
      currentPhaseIndex: 0,
    }

    setActiveTimers((prev) => {
      const next = new Map(prev)
      next.set(cardId, timer)
      return next
    })
  }

  function handleCancel(cardId: string) {
    timerManager.cancel(cardId)
    setActiveTimers((prev) => {
      const next = new Map(prev)
      next.delete(cardId)
      return next
    })
  }

  async function handleEnablePush() {
    if (!activeProject?.id) return
    alertEngine.unlock()
    const sub = await timerManager.subscribeToPush(activeProject.id)
    if (sub) {
      subscriptionRef.current = sub
      setPushEnabled(true)
    }
  }

  // Check if we already have a push subscription on mount
  useEffect(() => {
    if (!hasSW) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          subscriptionRef.current = sub
          setPushEnabled(true)
        }
      })
      .catch(() => {/* push not supported */})
  }, [hasSW])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* panel sub-header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BellRinging size={13} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {hardwareCards.length} card{hardwareCards.length !== 1 ? 's' : ''}
          </span>
        </div>

        {pushEnabled ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-success)',
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              padding: '2px 8px',
              borderRadius: '0.25rem',
            }}
          >
            <CheckCircle size={11} weight="fill" />
            Push enabled
          </span>
        ) : (
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={!hasSW}
            title={!hasSW ? 'Requires HTTPS or localhost' : undefined}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: hasSW ? 'var(--color-accent)' : 'var(--color-text-muted)',
              backgroundColor: hasSW ? 'rgba(34,211,238,0.1)' : 'transparent',
              border: `1px solid ${hasSW ? 'rgba(34,211,238,0.3)' : 'var(--color-border)'}`,
              borderRadius: '0.25rem',
              cursor: hasSW ? 'pointer' : 'not-allowed',
              opacity: hasSW ? 1 : 0.5,
            }}
          >
            Enable Push
          </button>
        )}
      </div>

      {/* SW warning */}
      {!hasSW && (
        <div
          style={{
            margin: '8px 10px 0',
            padding: '7px 10px',
            fontSize: '11px',
            color: 'var(--color-warn)',
            backgroundColor: 'rgba(251,146,60,0.1)',
            border: '1px solid rgba(251,146,60,0.25)',
            borderRadius: '0.375rem',
            lineHeight: 1.5,
          }}
        >
          Timers require a Service Worker (HTTPS or localhost)
        </div>
      )}

      {/* scrollable card list */}
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
        {hardwareCards.length === 0 ? (
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
              textAlign: 'center',
              padding: '24px 12px',
            }}
          >
            <Timer size={28} style={{ opacity: 0.3 }} />
            <span>No hardware cards with print time set.</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', opacity: 0.7 }}>
              Add printTime_minutes in the card modal.
            </span>
          </div>
        ) : (
          hardwareCards.map((card) => (
            <CardTimerRow
              key={card.id}
              cardId={card.id}
              cardTitle={card.title}
              printTime_minutes={(card.meta as HardwareMeta).printTime_minutes ?? 0}
              activeTimer={activeTimers.get(card.id) ?? null}
              onStart={handleStart}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>
    </div>
  )
}
