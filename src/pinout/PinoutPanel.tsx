import { useEffect, useState } from 'react'
import {
  Plus,
  Trash,
  PencilSimple,
  Check,
  X,
  Circuitry,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { usePinoutStore } from './pinoutStore'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { MCU_OPTIONS, PIN_LAYOUTS, type McuId } from './pinData'
import type { Database } from '@/db/types'

type Pinout = Database['public']['Tables']['pinouts']['Row']

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

// ── add / edit form ────────────────────────────────────────────────────────────

interface PinFormProps {
  initial?: Partial<Pinout>
  activeMcu: string
  onSave: (values: { variable_name: string; pin_number: string; description: string | null }) => void
  onCancel: () => void
}

function PinForm({ initial, activeMcu, onSave, onCancel }: PinFormProps) {
  const [varName, setVarName] = useState(initial?.variable_name ?? '')
  const [pinNum, setPinNum] = useState(initial?.pin_number ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')

  const isKnownMcu = activeMcu in PIN_LAYOUTS
  const refPins = isKnownMcu
    ? [...PIN_LAYOUTS[activeMcu as McuId].left, ...PIN_LAYOUTS[activeMcu as McuId].right]
    : []
  const uniquePins = [...new Map(refPins.map(p => [p.pin_number, p])).values()]

  const valid = varName.trim().length > 0 && pinNum.trim().length > 0

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
      }}
    >
      <input
        style={inputStyle}
        placeholder="Variable name *"
        value={varName}
        onChange={e => setVarName(e.target.value)}
        autoFocus
      />

      {isKnownMcu ? (
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={pinNum}
          onChange={e => setPinNum(e.target.value)}
        >
          <option value="">Select pin *</option>
          {uniquePins.map(p => (
            <option key={p.pin_number} value={p.pin_number}>
              {p.pin_number} — {p.pin_function.split(' /')[0].split(' (')[0].slice(0, 28)}
            </option>
          ))}
        </select>
      ) : (
        <input
          style={inputStyle}
          placeholder="Pin number *"
          value={pinNum}
          onChange={e => setPinNum(e.target.value)}
        />
      )}

      <input
        style={inputStyle}
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          <X size={11} />
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onSave({
              variable_name: varName.trim(),
              pin_number: pinNum.trim(),
              description: desc.trim() || null,
            })
          }
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#09090b',
            backgroundColor: valid ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: valid ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Check size={12} weight="bold" />
          Save
        </button>
      </div>
    </div>
  )
}

// ── pin assignment row ─────────────────────────────────────────────────────────

interface PinRowProps {
  pinout: Pinout
  activeMcu: string
  onEdit: () => void
}

function PinRow({ pinout, activeMcu, onEdit }: PinRowProps) {
  const { deletePinout } = usePinoutStore()

  const refPins = activeMcu in PIN_LAYOUTS
    ? [...PIN_LAYOUTS[activeMcu as McuId].left, ...PIN_LAYOUTS[activeMcu as McuId].right]
    : []
  const ref = refPins.find(p => p.pin_number === pinout.pin_number)

  return (
    <div
      style={{
        padding: '8px 10px',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.375rem',
        border: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-accent)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {pinout.variable_name}
        </span>

        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-surface-3)',
            padding: '1px 6px',
            borderRadius: '0.25rem',
            border: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          {pinout.pin_number}
        </span>

        <button
          type="button"
          onClick={onEdit}
          style={{
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none',
            borderRadius: '0.25rem',
            backgroundColor: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Edit assignment"
        >
          <PencilSimple size={12} />
        </button>

        <button
          type="button"
          onClick={() => deletePinout(pinout.id)}
          style={{
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none',
            borderRadius: '0.25rem',
            backgroundColor: 'transparent',
            color: 'var(--color-danger)',
            cursor: 'pointer',
            flexShrink: 0,
            opacity: 0.6,
          }}
          aria-label="Delete assignment"
        >
          <Trash size={12} />
        </button>
      </div>

      {ref && (
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={ref.pin_function}
        >
          {ref.pin_function.split(' /')[0].slice(0, 40)}
        </span>
      )}

      {pinout.description && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {pinout.description}
        </span>
      )}
    </div>
  )
}

// ── panel root ─────────────────────────────────────────────────────────────────

export function PinoutPanel() {
  const { pinouts, loading, activeMcu, loadPinouts, addPinout, updatePinout, setActiveMcu } =
    usePinoutStore()
  const { activeProject } = useProjectStore()
  const { openPinout } = useUIStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (activeProject?.id) loadPinouts(activeProject.id)
  }, [activeProject?.id, loadPinouts])

  const projectId = activeProject?.id ?? ''
  const mcuPinouts = pinouts.filter(p => p.mcu_type === activeMcu)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* MCU selector row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Circuitry size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <select
            style={{
              ...inputStyle,
              padding: '3px 6px',
              flex: 1,
              cursor: 'pointer',
            }}
            value={activeMcu}
            onChange={e => setActiveMcu(e.target.value)}
            aria-label="MCU type"
          >
            {MCU_OPTIONS.map(o => (
              <option key={o.id} value={o.id} style={{ backgroundColor: '#18181b' }}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => openPinout(activeMcu)}
            title="View pin diagram"
            aria-label="View pin diagram"
            disabled={activeMcu === 'custom'}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 7px',
              fontSize: '11px',
              fontWeight: 600,
              color: activeMcu === 'custom' ? 'var(--color-text-muted)' : 'var(--color-accent)',
              backgroundColor: activeMcu === 'custom' ? 'transparent' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${activeMcu === 'custom' ? 'var(--color-border)' : 'rgba(34,211,238,0.3)'}`,
              borderRadius: '0.25rem',
              cursor: activeMcu === 'custom' ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              opacity: activeMcu === 'custom' ? 0.4 : 1,
            }}
          >
            <ArrowSquareOut size={12} weight="bold" />
          </button>
        </div>

        {/* counts + add */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {mcuPinouts.length} assignment{mcuPinouts.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setEditingId(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px',
              fontSize: '11px', fontWeight: 600,
              color: 'var(--color-accent)',
              backgroundColor: 'rgba(34,211,238,0.1)',
              border: '1px solid rgba(34,211,238,0.3)',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            <Plus size={11} weight="bold" />
            Add
          </button>
        </div>
      </div>

      {/* scrollable list */}
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
        {showAddForm && (
          <PinForm
            activeMcu={activeMcu}
            onSave={async (values) => {
              if (!projectId) return
              await addPinout({
                project_id: projectId,
                mcu_type: activeMcu,
                pin_function: null,
                ...values,
              })
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {loading && mcuPinouts.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '24px' }}>
            Loading…
          </p>
        )}

        {!loading && mcuPinouts.length === 0 && !showAddForm && (
          <div
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '8px',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              paddingTop: '32px',
            }}
          >
            <Circuitry size={28} style={{ opacity: 0.25 }} />
            <span>No pins mapped yet</span>
          </div>
        )}

        {mcuPinouts.map(p =>
          editingId === p.id ? (
            <PinForm
              key={p.id}
              initial={p}
              activeMcu={activeMcu}
              onSave={async (values) => {
                await updatePinout(p.id, values)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <PinRow
              key={p.id}
              pinout={p}
              activeMcu={activeMcu}
              onEdit={() => { setEditingId(p.id); setShowAddForm(false) }}
            />
          )
        )}
      </div>
    </div>
  )
}
