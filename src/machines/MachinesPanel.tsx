import { useEffect, useState } from 'react'
import {
  Plus,
  Trash,
  PencilSimple,
  Check,
  Lock,
  LockOpen,
  Wrench,
  GearSix,
  Timer,
} from '@phosphor-icons/react'
import { useMachineStore, withStatus } from './machineStore'
import { useProjectStore } from '@/store/projectStore'
import type { Database } from '@/db/types'

type Machine = Database['public']['Tables']['machines']['Row']

const MACHINE_TYPES = ['3D Printer', 'CNC Router', 'Laser Cutter', 'Lathe', 'Mill', 'Other']

// ── progress bar ────────────────────────────────────────────────────────────

function MaintenanceBar({ percent, locked }: { percent: number; locked: boolean }) {
  const color =
    locked
      ? 'var(--color-danger)'
      : percent >= 100
      ? 'var(--color-danger)'
      : percent >= 80
      ? 'var(--color-warn)'
      : 'var(--color-accent)'

  return (
    <div
      style={{
        height: '3px',
        backgroundColor: 'var(--color-surface-3)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, percent)}%`,
          backgroundColor: color,
          borderRadius: '2px',
          transition: 'width 0.3s ease, background-color 0.3s',
        }}
      />
    </div>
  )
}

// ── add hours mini-form ─────────────────────────────────────────────────────

function LogHoursRow({ machineId, onClose }: { machineId: string; onClose: () => void }) {
  const [val, setVal] = useState('')
  const { logHours } = useMachineStore()

  const submit = async (h: number) => {
    if (h <= 0) return
    await logHours(machineId, h)
    onClose()
  }

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
      <button type="button" onClick={() => submit(1)} style={quickBtn}>+1h</button>
      <button type="button" onClick={() => submit(8)} style={quickBtn}>+8h</button>
      <input
        type="number"
        min={0.1}
        step={0.5}
        placeholder="h"
        value={val}
        onChange={e => setVal(e.target.value)}
        style={{
          width: '52px',
          backgroundColor: 'var(--color-surface-0)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.25rem',
          padding: '3px 6px',
          fontSize: '11px',
          color: 'var(--color-text-primary)',
          outline: 'none',
          fontFamily: 'var(--font-mono)',
        }}
        onKeyDown={e => { if (e.key === 'Enter') submit(parseFloat(val)) }}
      />
      <button
        type="button"
        onClick={() => submit(parseFloat(val))}
        disabled={!val || parseFloat(val) <= 0}
        style={{
          ...quickBtn,
          color: '#09090b',
          backgroundColor: 'var(--color-accent)',
          borderColor: 'transparent',
          opacity: !val || parseFloat(val) <= 0 ? 0.4 : 1,
        }}
      >
        <Check size={10} weight="bold" />
      </button>
      <button type="button" onClick={onClose} style={{ ...quickBtn, marginLeft: 'auto' }}>
        ✕
      </button>
    </div>
  )
}

const quickBtn: React.CSSProperties = {
  padding: '2px 7px',
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  backgroundColor: 'var(--color-surface-3)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.25rem',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
}

// ── single machine card ─────────────────────────────────────────────────────

interface MachineCardProps {
  machine: Machine
  onEdit: () => void
}

function MachineCard({ machine, onEdit }: MachineCardProps) {
  const { deleteMachine, markMaintained, toggleLock } = useMachineStore()
  const [showLogHours, setShowLogHours] = useState(false)
  const m = withStatus(machine)

  const statusColor =
    m.is_locked
      ? 'var(--color-danger)'
      : m.needsMaintenance
      ? 'var(--color-danger)'
      : m.maintenancePercent >= 80
      ? 'var(--color-warn)'
      : 'var(--color-success)'

  return (
    <div
      style={{
        padding: '10px',
        backgroundColor: 'var(--color-surface-2)',
        borderRadius: '0.375rem',
        border: `1px solid ${m.is_locked || m.needsMaintenance ? 'rgba(248,113,113,0.3)' : 'var(--color-border-subtle)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}
    >
      {/* top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <GearSix
          size={13}
          weight={m.is_locked ? 'fill' : 'regular'}
          style={{ color: statusColor, flexShrink: 0 }}
        />

        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {machine.name}
        </span>

        <span
          style={{
            fontSize: '10px',
            padding: '1px 5px',
            borderRadius: '0.25rem',
            backgroundColor: 'var(--color-surface-3)',
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}
        >
          {machine.type}
        </span>

        {/* lock toggle */}
        <button
          type="button"
          onClick={() => toggleLock(machine.id)}
          title={machine.is_locked ? 'Unlock machine' : 'Lock machine'}
          style={{
            width: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: '0.25rem',
            backgroundColor: 'transparent',
            color: machine.is_locked ? 'var(--color-danger)' : 'var(--color-text-muted)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {machine.is_locked ? <Lock size={12} weight="fill" /> : <LockOpen size={12} />}
        </button>

        <button
          type="button"
          onClick={onEdit}
          style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '0.25rem', backgroundColor: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0 }}
          aria-label="Edit machine"
        >
          <PencilSimple size={12} />
        </button>

        <button
          type="button"
          onClick={() => deleteMachine(machine.id)}
          style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '0.25rem', backgroundColor: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', flexShrink: 0, opacity: 0.6 }}
          aria-label="Delete machine"
        >
          <Trash size={12} />
        </button>
      </div>

      {/* maintenance progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            maintenance
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: statusColor, fontWeight: 600 }}>
            {m.hoursSinceLastMaintenance.toFixed(1)}h / {machine.maintenance_threshold_hours}h
          </span>
        </div>
        <MaintenanceBar percent={m.maintenancePercent} locked={machine.is_locked} />
      </div>

      {/* total hours + action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Timer size={11} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', flex: 1 }}>
          {machine.total_hours_logged.toFixed(1)}h total
        </span>

        {(m.needsMaintenance || machine.is_locked) && (
          <button
            type="button"
            onClick={() => markMaintained(machine.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', fontSize: '10px', fontWeight: 700,
              color: '#09090b',
              backgroundColor: 'var(--color-warn)',
              border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
            }}
          >
            <Wrench size={10} weight="bold" />
            Done
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowLogHours(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            padding: '2px 7px', fontSize: '10px', fontWeight: 600,
            color: 'var(--color-accent)',
            backgroundColor: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.25)',
            borderRadius: '0.25rem', cursor: 'pointer',
          }}
        >
          <Plus size={10} weight="bold" />
          Log
        </button>
      </div>

      {showLogHours && (
        <LogHoursRow machineId={machine.id} onClose={() => setShowLogHours(false)} />
      )}
    </div>
  )
}

// ── add / edit form ─────────────────────────────────────────────────────────

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
}

interface MachineFormProps {
  initial?: Partial<Machine>
  onSave: (values: {
    name: string
    type: string
    maintenance_threshold_hours: number
    total_hours_logged: number
    is_locked: boolean
  }) => void
  onCancel: () => void
}

function MachineForm({ initial, onSave, onCancel }: MachineFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState(initial?.type ?? '3D Printer')
  const [threshold, setThreshold] = useState(String(initial?.maintenance_threshold_hours ?? 500))
  const [hours, setHours] = useState(String(initial?.total_hours_logged ?? 0))

  const valid = name.trim().length > 0

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
      <input style={inputStyle} placeholder="Machine name *" value={name} onChange={e => setName(e.target.value)} autoFocus />

      <select
        style={{ ...inputStyle, cursor: 'pointer' }}
        value={type}
        onChange={e => setType(e.target.value)}
      >
        {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Maint. threshold (h)</div>
          <input style={inputStyle} type="number" min={1} value={threshold} onChange={e => setThreshold(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Hours logged so far</div>
          <input style={inputStyle} type="number" min={0} value={hours} onChange={e => setHours(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--color-text-secondary)', backgroundColor: 'transparent', border: '1px solid var(--color-border)', borderRadius: '0.25rem', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSave({
            name: name.trim(),
            type,
            maintenance_threshold_hours: Math.max(1, parseFloat(threshold) || 500),
            total_hours_logged: Math.max(0, parseFloat(hours) || 0),
            is_locked: initial?.is_locked ?? false,
          })}
          style={{
            padding: '4px 10px', fontSize: '11px', fontWeight: 600,
            color: '#09090b',
            backgroundColor: valid ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none', borderRadius: '0.25rem',
            cursor: valid ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          <Check size={12} weight="bold" />
          Save
        </button>
      </div>
    </div>
  )
}

// ── panel root ──────────────────────────────────────────────────────────────

export function MachinesPanel() {
  const { machines, loading, loadMachines, addMachine, updateMachine } = useMachineStore()
  const { activeProject } = useProjectStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (activeProject?.id) loadMachines(activeProject.id)
  }, [activeProject?.id, loadMachines])

  const projectId = activeProject?.id ?? ''
  const needsMaint = machines.filter(m => withStatus(m).needsMaintenance || m.is_locked).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GearSix size={13} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {machines.length} machine{machines.length !== 1 ? 's' : ''}
          </span>
          {needsMaint > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-danger)', backgroundColor: 'rgba(248,113,113,0.12)', padding: '1px 5px', borderRadius: '0.25rem' }}>
              {needsMaint} MAINT
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => { setShowAddForm(true); setEditingId(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--color-accent)', backgroundColor: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '0.25rem', cursor: 'pointer' }}
        >
          <Plus size={11} weight="bold" />
          Add
        </button>
      </div>

      {/* list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {showAddForm && (
          <MachineForm
            onSave={async (values) => {
              if (!projectId) return
              await addMachine({
                project_id: projectId,
                hours_at_last_maintenance: 0,
                last_maintenance_at: null,
                ...values,
              })
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {loading && machines.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '24px' }}>Loading…</p>
        )}

        {!loading && machines.length === 0 && !showAddForm && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            <GearSix size={28} style={{ opacity: 0.3 }} />
            <span>No machines yet</span>
          </div>
        )}

        {machines.map(m =>
          editingId === m.id ? (
            <MachineForm
              key={m.id}
              initial={m}
              onSave={async (values) => {
                await updateMachine(m.id, values)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <MachineCard
              key={m.id}
              machine={m}
              onEdit={() => { setEditingId(m.id); setShowAddForm(false) }}
            />
          )
        )}
      </div>
    </div>
  )
}
