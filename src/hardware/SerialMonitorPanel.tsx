/**
 * SerialMonitorPanel — CKS-60
 *
 * Full-featured serial monitor: connect a device, bind it to a card,
 * watch live log output, and auto-move the card to "done" when the
 * termination string fires.
 */

import { useEffect, useRef, useState } from 'react'
import { useSerialMonitor } from './useSerialMonitor'
import { useCardStore } from '@/store/cardStore'

// ── shared style tokens ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--color-surface-0)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.25rem',
  padding: '4px 8px',
  fontSize: '12px',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const accentBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px 8px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-accent)',
  backgroundColor: 'rgba(34,211,238,0.1)',
  border: '1px solid rgba(34,211,238,0.3)',
  borderRadius: '0.25rem',
  cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: '11px',
  color: 'var(--color-text-secondary)',
  backgroundColor: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: '0.25rem',
  cursor: 'pointer',
}

const BAUD_RATES = [9600, 38400, 57600, 115200] as const

// ── bind form ────────────────────────────────────────────────────────────────

interface BindFormProps {
  port: SerialPort
  cards: { id: string; title: string }[]
  onBind: (cardId: string, cardTitle: string, terminationString: string, baudRate: number) => void
  onCancel: () => void
}

function BindForm({ port: _port, cards, onBind, onCancel }: BindFormProps) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? '')
  const [termination, setTermination] = useState('[STATUS] JOB_DONE')
  const [baudRate, setBaudRate] = useState<number>(9600)

  const valid = cardId.length > 0

  function handleBind() {
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    onBind(cardId, card.title, termination, baudRate)
  }

  return (
    <div
      style={{
        padding: '10px',
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
        Bind port to card
      </span>

      {cards.length === 0 ? (
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          No cards in this project yet.
        </span>
      ) : (
        <select style={selectStyle} value={cardId} onChange={e => setCardId(e.target.value)}>
          {cards.map(c => (
            <option key={c.id} value={c.id}>
              {c.title.slice(0, 50)}
            </option>
          ))}
        </select>
      )}

      <input
        style={inputStyle}
        placeholder="Termination string"
        value={termination}
        onChange={e => setTermination(e.target.value)}
      />

      <select
        style={selectStyle}
        value={baudRate}
        onChange={e => setBaudRate(Number(e.target.value))}
      >
        {BAUD_RATES.map(rate => (
          <option key={rate} value={rate}>
            {rate} baud
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={ghostBtn}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={handleBind}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#09090b',
            backgroundColor: valid ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: valid ? 'pointer' : 'not-allowed',
          }}
        >
          Bind
        </button>
      </div>
    </div>
  )
}

// ── bound card row ───────────────────────────────────────────────────────────

interface BoundCardRowProps {
  cardId: string
  cardTitle: string
  isDone: boolean
  onDisconnect: () => void
}

function BoundCardRow({ cardId: _cardId, cardTitle, isDone, onDisconnect }: BoundCardRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        backgroundColor: 'var(--color-surface-2)',
        border: `1px solid ${isDone ? 'rgba(34,211,238,0.3)' : 'var(--color-border-subtle)'}`,
        borderRadius: '0.375rem',
        flexShrink: 0,
      }}
    >
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
      >
        {cardTitle}
      </span>

      {isDone && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--color-accent)',
            backgroundColor: 'rgba(34,211,238,0.1)',
            padding: '1px 6px',
            borderRadius: '0.25rem',
            border: '1px solid rgba(34,211,238,0.3)',
            flexShrink: 0,
          }}
        >
          ✓ Done
        </span>
      )}

      <button
        type="button"
        onClick={onDisconnect}
        style={{
          padding: '2px 7px',
          fontSize: '10px',
          color: 'var(--color-danger)',
          backgroundColor: 'transparent',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Disconnect
      </button>
    </div>
  )
}

// ── panel root ───────────────────────────────────────────────────────────────

interface BoundEntry {
  cardId: string
  cardTitle: string
  port: SerialPort
}

export function SerialMonitorPanel() {
  const { isSupported, lines, completedCards, requestPort, bindCard, unbindCard, clearLines } =
    useSerialMonitor()
  const { cards, moveCard } = useCardStore()

  // pending port waiting for bind form
  const [pendingPort, setPendingPort] = useState<SerialPort | null>(null)
  // list of currently bound card entries (local — serialMonitor is the real source of truth)
  const [boundEntries, setBoundEntries] = useState<BoundEntry[]>([])
  // track which completions we've already actioned (to avoid double move)
  const actionedRef = useRef<Set<string>>(new Set())

  const logRef = useRef<HTMLDivElement>(null)

  // auto-scroll log to bottom on new lines
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [lines])

  // move cards to done when completion fires
  useEffect(() => {
    // Snapshot the current done-column length once; use an offset so that when
    // multiple cards complete in the same batch they don't all land at the same
    // position index (the optimistic updates in moveCard don't update `cards`
    // mid-loop since it's a closure over the render-time snapshot).
    const baseDoneCount = cards.filter(c => c.column === 'done').length
    let offset = 0
    for (const cardId of completedCards) {
      if (actionedRef.current.has(cardId)) continue
      actionedRef.current.add(cardId)
      void moveCard(cardId, 'done', baseDoneCount + offset)
      offset++
    }
  }, [completedCards, cards, moveCard])

  async function handleConnectDevice() {
    const port = await requestPort()
    if (port) setPendingPort(port)
  }

  async function handleBind(
    cardId: string,
    cardTitle: string,
    terminationString: string,
    baudRate: number,
  ) {
    if (!pendingPort) return
    const port = pendingPort
    setPendingPort(null)
    await bindCard(port, cardId, cardTitle, terminationString, baudRate)
    setBoundEntries(prev => [...prev.filter(e => e.cardId !== cardId), { cardId, cardTitle, port }])
  }

  async function handleDisconnect(cardId: string) {
    await unbindCard(cardId)
    setBoundEntries(prev => prev.filter(e => e.cardId !== cardId))
  }

  const cardOptions = cards.map(c => ({ id: c.id, title: c.title }))

  // Build a lookup from cardId → cardTitle for the log prefix
  const cardTitleMap = new Map(boundEntries.map(e => [e.cardId, e.cardTitle]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── header bar ──────────────────────────────────────────────────── */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!isSupported && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.12)',
                padding: '1px 6px',
                borderRadius: '0.25rem',
                border: '1px solid rgba(251,191,36,0.3)',
              }}
            >
              NOT SUPPORTED
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {boundEntries.length} bound
          </span>
        </div>

        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            type="button"
            onClick={clearLines}
            style={ghostBtn}
            title="Clear log"
          >
            Clear log
          </button>

          <button
            type="button"
            onClick={handleConnectDevice}
            disabled={!isSupported}
            style={{
              ...accentBtn,
              opacity: isSupported ? 1 : 0.45,
              cursor: isSupported ? 'pointer' : 'not-allowed',
            }}
          >
            Connect Device
          </button>
        </div>
      </div>

      {/* ── body ────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          gap: '0',
        }}
      >
        {/* browser compat warning */}
        {!isSupported && (
          <div
            style={{
              margin: '10px',
              padding: '8px 12px',
              backgroundColor: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: '0.375rem',
              fontSize: '11px',
              color: '#fbbf24',
              flexShrink: 0,
            }}
          >
            Web Serial API requires a Chromium-based browser (Chrome, Edge, Opera).
          </div>
        )}

        {/* bind form — shown after port picker */}
        {pendingPort && (
          <div style={{ padding: '8px 10px', flexShrink: 0 }}>
            <BindForm
              port={pendingPort}
              cards={cardOptions}
              onBind={handleBind}
              onCancel={() => setPendingPort(null)}
            />
          </div>
        )}

        {/* bound card rows */}
        {boundEntries.length > 0 && (
          <div
            style={{
              padding: '6px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              flexShrink: 0,
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            {boundEntries.map(entry => (
              <BoundCardRow
                key={entry.cardId}
                cardId={entry.cardId}
                cardTitle={entry.cardTitle}
                isDone={completedCards.has(entry.cardId)}
                onDisconnect={() => void handleDisconnect(entry.cardId)}
              />
            ))}
          </div>
        )}

        {/* empty state */}
        {boundEntries.length === 0 && lines.length === 0 && !pendingPort && isSupported && (
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
            }}
          >
            <span style={{ fontSize: '24px', opacity: 0.3 }}>⎌</span>
            <span>No devices connected</span>
          </div>
        )}

        {/* log output */}
        {(lines.length > 0 || boundEntries.length > 0) && (
          <div
            ref={logRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
            }}
          >
            {lines.length === 0 && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)',
                  paddingTop: '4px',
                }}
              >
                Waiting for data…
              </span>
            )}
            {lines.map((entry, i) => {
              const title = cardTitleMap.get(entry.cardId) ?? entry.cardId
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    lineHeight: 1.5,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  <span style={{ color: 'var(--color-text-muted)' }}>[{title}]</span>
                  {' '}
                  {entry.line}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
