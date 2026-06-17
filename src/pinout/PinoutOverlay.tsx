import { useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { useUIStore } from '@/store/uiStore'
import { usePinoutStore } from './pinoutStore'
import { PIN_LAYOUTS, type McuId } from './pinData'

// ── layout constants ───────────────────────────────────────────────────────────

const SVG_W = 800
const LABEL_W = 220
const ARM_LEN = 36
const CHIP_W = SVG_W - 2 * LABEL_W - 2 * ARM_LEN // 88 px — we'll make chip wider
// Recalculate: chip body from LABEL_W + ARM_LEN to SVG_W - LABEL_W - ARM_LEN
const CHIP_X1 = LABEL_W + ARM_LEN        // left edge of chip body
const CHIP_X2 = SVG_W - LABEL_W - ARM_LEN // right edge of chip body
const ACTUAL_CHIP_W = CHIP_X2 - CHIP_X1   // 800 - 220 - 36 - 220 - 36 = 88 … too narrow

// Adjust: reduce label width
const L_W = 190   // label area width
const A_L = 30    // arm length
const C_X1 = L_W + A_L           // 220
const C_X2 = SVG_W - L_W - A_L   // 580
const C_W = C_X2 - C_X1           // 360  ← chip body width
const ROW_H = 30
const TOP_PAD = 50

// ── SVG chip component ─────────────────────────────────────────────────────────

interface ChipDiagramProps {
  mcuId: McuId
  /** map from pin_number → variable_names (ordered, for pins appearing multiple times) */
  assignmentMap: Map<string, string[]>
}

function ChipDiagram({ mcuId, assignmentMap }: ChipDiagramProps) {
  const layout = PIN_LAYOUTS[mcuId]
  const nRows = Math.max(layout.left.length, layout.right.length)
  const chipH = nRows * ROW_H
  const svgH = TOP_PAD + chipH + TOP_PAD

  // Track how many times we've consumed each pin_number's assignment list
  const usageL = new Map<string, number>()
  const usageR = new Map<string, number>()

  function getAssignment(map: Map<string, number>, pin: string): string | undefined {
    const used = map.get(pin) ?? 0
    const list = assignmentMap.get(pin) ?? []
    const result = list[used]
    if (result !== undefined) map.set(pin, used + 1)
    return result
  }

  const accent = '#22d3ee'
  const border = '#27272a'
  const textMuted = '#71717a'
  const textSec = '#a1a1aa'
  const surface1 = '#18181b'
  const surface3 = '#27272a'
  const pinPad = '#3f3f46'

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${svgH}`}
      width="100%"
      style={{ display: 'block', fontFamily: 'ui-monospace, monospace' }}
      aria-label={`${layout.label} pinout diagram`}
    >
      {/* Chip body */}
      <rect
        x={C_X1}
        y={TOP_PAD}
        width={C_W}
        height={chipH}
        rx={6}
        fill={surface1}
        stroke={border}
        strokeWidth={1.5}
      />

      {/* Orientation notch */}
      <path
        d={`M ${C_X1 + C_W / 2 - 16} ${TOP_PAD} A 16 16 0 0 0 ${C_X1 + C_W / 2 + 16} ${TOP_PAD}`}
        fill="#09090b"
        stroke={border}
        strokeWidth={1}
      />

      {/* MCU label */}
      <text
        x={C_X1 + C_W / 2}
        y={TOP_PAD + chipH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textMuted}
        fontSize={14}
        fontWeight={600}
        letterSpacing={1}
      >
        {layout.label}
      </text>

      {/* ── Left pins ── */}
      {layout.left.map((pin, i) => {
        const y = TOP_PAD + i * ROW_H + ROW_H / 2
        const varName = getAssignment(usageL, pin.pin_number)
        const assigned = varName !== undefined
        const isGnd = pin.pin_number === 'GND' || pin.pin_number === 'AGND'
        const padColor = assigned ? accent : isGnd ? '#3f3f46' : pinPad
        const numColor = assigned ? accent : textSec
        const short = pin.pin_function.split(' /')[0].slice(0, 22)

        return (
          <g key={`l-${i}`}>
            {/* arm line */}
            <line
              x1={L_W}
              y1={y}
              x2={C_X1}
              y2={y}
              stroke={assigned ? accent : border}
              strokeWidth={assigned ? 1.5 : 1}
            />

            {/* pad */}
            <circle cx={C_X1} cy={y} r={4} fill={padColor} />

            {/* pin number — right-aligned just before arm */}
            <text
              x={L_W - 8}
              y={y + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fill={numColor}
              fontSize={11}
              fontWeight={assigned ? 700 : 400}
            >
              {pin.pin_number}
            </text>

            {/* variable name — left side, accent */}
            {assigned && (
              <text
                x={8}
                y={y + 1}
                dominantBaseline="middle"
                fill={accent}
                fontSize={11}
                fontWeight={700}
              >
                {varName}
              </text>
            )}

            {/* function — below pin number, muted */}
            <text
              x={L_W - 8}
              y={y + 11}
              textAnchor="end"
              fill={textMuted}
              fontSize={8.5}
            >
              {short}
            </text>
          </g>
        )
      })}

      {/* ── Right pins ── */}
      {layout.right.map((pin, i) => {
        const y = TOP_PAD + i * ROW_H + ROW_H / 2
        const varName = getAssignment(usageR, pin.pin_number)
        const assigned = varName !== undefined
        const isGnd = pin.pin_number === 'GND' || pin.pin_number === 'AGND'
        const padColor = assigned ? accent : isGnd ? '#3f3f46' : pinPad
        const numColor = assigned ? accent : textSec
        const short = pin.pin_function.split(' /')[0].slice(0, 22)

        return (
          <g key={`r-${i}`}>
            {/* arm line */}
            <line
              x1={C_X2}
              y1={y}
              x2={SVG_W - L_W}
              y2={y}
              stroke={assigned ? accent : border}
              strokeWidth={assigned ? 1.5 : 1}
            />

            {/* pad */}
            <circle cx={C_X2} cy={y} r={4} fill={padColor} />

            {/* pin number */}
            <text
              x={SVG_W - L_W + 8}
              y={y + 1}
              dominantBaseline="middle"
              fill={numColor}
              fontSize={11}
              fontWeight={assigned ? 700 : 400}
            >
              {pin.pin_number}
            </text>

            {/* variable name — right side, accent */}
            {assigned && (
              <text
                x={SVG_W - 8}
                y={y + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fill={accent}
                fontSize={11}
                fontWeight={700}
              >
                {varName}
              </text>
            )}

            {/* function */}
            <text
              x={SVG_W - L_W + 8}
              y={y + 11}
              fill={textMuted}
              fontSize={8.5}
            >
              {short}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── overlay root ───────────────────────────────────────────────────────────────

export function PinoutOverlay() {
  const { pinoutMcu, closePinout } = useUIStore()
  const { pinouts, activeMcu } = usePinoutStore()

  const effectiveMcu = (pinoutMcu ?? activeMcu) as McuId
  const isKnown = effectiveMcu in PIN_LAYOUTS
  const layout = isKnown ? PIN_LAYOUTS[effectiveMcu] : null

  const mcuPinouts = pinouts.filter(p => p.mcu_type === effectiveMcu)

  // Build assignment map: pin_number → [variable_name, ...] (in order)
  const assignmentMap = new Map<string, string[]>()
  for (const p of mcuPinouts) {
    const existing = assignmentMap.get(p.pin_number) ?? []
    existing.push(p.variable_name)
    assignmentMap.set(p.pin_number, existing)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePinout()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closePinout])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${layout?.label ?? effectiveMcu} pinout map`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'rgba(9,9,11,0.88)',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) closePinout() }}
    >
      {/* header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            {layout?.label ?? effectiveMcu}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-surface-3)',
              padding: '2px 8px',
              borderRadius: '0.25rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Pinout Map
          </span>
        </div>

        {/* legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3f3f46', border: '1px solid #52525b' }} />
            <span>unassigned</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22d3ee' }} />
            <span>assigned</span>
          </div>
          <span style={{ color: 'var(--color-border)', margin: '0 4px' }}>|</span>
          <span style={{ fontSize: '10px' }}>ESC to close</span>
        </div>

        <button
          type="button"
          onClick={closePinout}
          aria-label="Close pinout overlay"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px',
            border: '1px solid var(--color-border)',
            borderRadius: '0.375rem',
            backgroundColor: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* scrollable diagram area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        {!isKnown ? (
          <div
            style={{
              marginTop: '80px',
              color: 'var(--color-text-muted)',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            <p>No diagram available for custom MCU types.</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              Select a known MCU in the Pinout Mapper panel.
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '900px' }}>
            <ChipDiagram mcuId={effectiveMcu} assignmentMap={assignmentMap} />
          </div>
        )}

        {/* assignment summary */}
        {mcuPinouts.length > 0 && (
          <div
            style={{
              width: '100%',
              maxWidth: '900px',
              borderTop: '1px solid var(--color-border)',
              paddingTop: '16px',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '10px',
              }}
            >
              Assignments
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '6px',
              }}
            >
              {mcuPinouts.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 10px',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: '#22d3ee',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.variable_name}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', flexShrink: 0 }}>→</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {p.pin_number}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
