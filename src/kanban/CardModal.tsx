import { useEffect, useRef, useState } from 'react'
import { X, Plus, Trash, FloppyDisk } from '@phosphor-icons/react'
import { useCardStore } from '@/store/cardStore'
import type {
  Database,
  CardType,
  SoftwareMeta,
  HardwareMeta,
  TimerPhase,
  AlertSeverity,
} from '@/db/types'

type Card = Database['public']['Tables']['cards']['Row']
type BomItem = Database['public']['Tables']['bom_items']['Row']
type Machine = Database['public']['Tables']['machines']['Row']

interface CardModalProps {
  card: Card
  allCards: Card[]
  onClose: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--color-text-secondary)',
        display: 'block',
        marginBottom: '4px',
      }}
    >
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        backgroundColor: 'var(--color-surface-0)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.375rem',
        padding: '6px 10px',
        fontSize: '13px',
        color: 'var(--color-text-primary)',
        outline: 'none',
      }}
    />
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        backgroundColor: 'var(--color-surface-0)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.375rem',
        padding: '6px 10px',
        fontSize: '13px',
        color: 'var(--color-text-primary)',
        outline: 'none',
        resize: 'vertical',
        fontFamily: 'var(--font-sans)',
      }}
    />
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        backgroundColor: 'var(--color-surface-0)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.375rem',
        padding: '6px 10px',
        fontSize: '13px',
        color: 'var(--color-text-primary)',
        outline: 'none',
      }}
    >
      {children}
    </select>
  )
}

export function CardModal({ card, allCards, onClose }: CardModalProps) {
  const { updateCard, deleteCard } = useCardStore()
  const overlayRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [type, setType] = useState<CardType>(card.type)

  // Software fields
  const swMeta = (card.type === 'software' ? card.meta : null) as SoftwareMeta | null
  const [repo, setRepo] = useState(swMeta?.repo ?? '')
  const [branch, setBranch] = useState(swMeta?.branch ?? '')
  const [targetMCU, setTargetMCU] = useState(swMeta?.targetMCU ?? '')
  const [language, setLanguage] = useState(swMeta?.language ?? '')

  // Hardware fields
  const hwMeta = (card.type === 'hardware' ? card.meta : null) as HardwareMeta | null
  const [material, setMaterial] = useState(hwMeta?.material ?? '')
  const [dimensions, setDimensions] = useState(hwMeta?.dimensions ?? '')
  const [slicerProfile, setSlicerProfile] = useState(hwMeta?.slicerProfile ?? '')
  const [estimatedWeight, setEstimatedWeight] = useState(String(hwMeta?.estimatedWeight_g ?? ''))
  const [binLocation, setBinLocation] = useState(hwMeta?.binLocation ?? '')
  const [printTimeMinutes, setPrintTimeMinutes] = useState(String(hwMeta?.printTime_minutes ?? ''))

  // Timer phases
  const [phases, setPhases] = useState<TimerPhase[]>([])

  // Dependencies
  const [blockedBy, setBlockedBy] = useState<string[]>(card.blocked_by)

  // BOM + Machine
  const [_bomItems, _setBomItems] = useState<BomItem[]>([])
  const [_machines, _setMachines] = useState<Machine[]>([])
  const [bomItemId, setBomItemId] = useState(card.bom_item_id ?? '')
  const [machineId, setMachineId] = useState(card.machine_id ?? '')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const toggleDep = (id: string) => {
    setBlockedBy(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  const addPhase = () => {
    setPhases(prev => [...prev, { name: '', duration_minutes: 0, alert_severity: 'low' as AlertSeverity }])
  }

  const updatePhase = (index: number, field: keyof TimerPhase, value: string | number) => {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const removePhase = (index: number) => {
    setPhases(prev => prev.filter((_, i) => i !== index))
  }

  const buildMeta = (): SoftwareMeta | HardwareMeta | null => {
    if (type === 'software') {
      const meta: SoftwareMeta = {}
      if (repo) meta.repo = repo
      if (branch) meta.branch = branch
      if (targetMCU) meta.targetMCU = targetMCU
      if (language) meta.language = language
      return meta
    }
    if (type === 'hardware') {
      const meta: HardwareMeta = {}
      if (material) meta.material = material
      if (dimensions) meta.dimensions = dimensions
      if (slicerProfile) meta.slicerProfile = slicerProfile
      if (estimatedWeight) meta.estimatedWeight_g = parseFloat(estimatedWeight)
      if (binLocation) meta.binLocation = binLocation
      if (printTimeMinutes) meta.printTime_minutes = parseInt(printTimeMinutes, 10)
      return meta
    }
    return null
  }

  const handleSave = async () => {
    await updateCard(card.id, {
      title,
      description: description || null,
      type,
      meta: buildMeta(),
      blocked_by: blockedBy,
      bom_item_id: bomItemId || null,
      machine_id: machineId || null,
    })
    onClose()
  }

  const handleDelete = async () => {
    await deleteCard(card.id)
    onClose()
  }

  const otherCards = allCards.filter(c => c.id !== card.id)

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit card: ${card.title}`}
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Edit Card
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Title */}
          <div>
            <FieldLabel>Title</FieldLabel>
            <Input value={title} onChange={setTitle} placeholder="Card title" />
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={description}
              onChange={setDescription}
              placeholder="Add a description..."
              rows={3}
            />
          </div>

          {/* Type selector */}
          <div>
            <FieldLabel>Type</FieldLabel>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['software', 'hardware'] as CardType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '0.375rem',
                    border: '1px solid',
                    borderColor: type === t
                      ? (t === 'software' ? '#60a5fa' : '#fb923c')
                      : 'var(--color-border)',
                    backgroundColor: type === t
                      ? (t === 'software' ? 'rgba(96,165,250,0.15)' : 'rgba(251,146,60,0.15)')
                      : 'transparent',
                    color: type === t
                      ? (t === 'software' ? '#60a5fa' : '#fb923c')
                      : 'var(--color-text-secondary)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Software fields */}
          {type === 'software' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--color-surface-1)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div>
                <FieldLabel>Repo URL</FieldLabel>
                <Input value={repo} onChange={setRepo} placeholder="https://github.com/..." />
              </div>
              <div>
                <FieldLabel>Branch</FieldLabel>
                <Input value={branch} onChange={setBranch} placeholder="main" />
              </div>
              <div>
                <FieldLabel>Target MCU</FieldLabel>
                <Input value={targetMCU} onChange={setTargetMCU} placeholder="STM32F4" />
              </div>
              <div>
                <FieldLabel>Language</FieldLabel>
                <Input value={language} onChange={setLanguage} placeholder="C, Rust, Python..." />
              </div>
            </div>
          )}

          {/* Hardware fields */}
          {type === 'hardware' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--color-surface-1)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div>
                <FieldLabel>Material</FieldLabel>
                <Input value={material} onChange={setMaterial} placeholder="PLA, PETG, ABS..." />
              </div>
              <div>
                <FieldLabel>Dimensions</FieldLabel>
                <Input value={dimensions} onChange={setDimensions} placeholder="100x50x25mm" />
              </div>
              <div>
                <FieldLabel>Slicer Profile</FieldLabel>
                <Input value={slicerProfile} onChange={setSlicerProfile} placeholder="0.2mm Quality" />
              </div>
              <div>
                <FieldLabel>Est. Weight (g)</FieldLabel>
                <Input
                  value={estimatedWeight}
                  onChange={setEstimatedWeight}
                  type="number"
                  placeholder="0"
                />
              </div>
              <div>
                <FieldLabel>Bin Location</FieldLabel>
                <Input value={binLocation} onChange={setBinLocation} placeholder="A1" />
              </div>
              <div>
                <FieldLabel>Print Time (min)</FieldLabel>
                <Input
                  value={printTimeMinutes}
                  onChange={setPrintTimeMinutes}
                  type="number"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Post-processing phases (hardware only) */}
          {type === 'hardware' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <FieldLabel>Post-Processing Phases</FieldLabel>
                <button
                  type="button"
                  onClick={addPhase}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: 'var(--color-accent)',
                    backgroundColor: 'rgba(34,211,238,0.1)',
                    border: '1px solid rgba(34,211,238,0.3)',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={11} />
                  Add Phase
                </button>
              </div>
              {phases.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>
                  No phases added
                </p>
              )}
              {phases.map((phase, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 100px auto',
                    gap: '8px',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <Input
                    value={phase.name}
                    onChange={v => updatePhase(i, 'name', v)}
                    placeholder="Phase name"
                  />
                  <Input
                    value={String(phase.duration_minutes)}
                    onChange={v => updatePhase(i, 'duration_minutes', parseInt(v, 10) || 0)}
                    type="number"
                    placeholder="min"
                  />
                  <Select
                    value={phase.alert_severity}
                    onChange={v => updatePhase(i, 'alert_severity', v)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removePhase(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-danger)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                    aria-label="Remove phase"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Dependencies */}
          {otherCards.length > 0 && (
            <div>
              <FieldLabel>Blocked By</FieldLabel>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '8px',
                  backgroundColor: 'var(--color-surface-1)',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--color-border)',
                }}
              >
                {otherCards.map(c => (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={blockedBy.includes(c.id)}
                      onChange={() => toggleDep(c.id)}
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <span>{c.title}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                      ({c.column})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* BOM Link */}
          <div>
            <FieldLabel>BOM Item</FieldLabel>
            <Input
              value={bomItemId}
              onChange={setBomItemId}
              placeholder="BOM item ID (optional)"
            />
          </div>

          {/* Machine Link */}
          <div>
            <FieldLabel>Machine</FieldLabel>
            <Input
              value={machineId}
              onChange={setMachineId}
              placeholder="Machine ID (optional)"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-danger)',
              backgroundColor: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            <Trash size={14} />
            Delete
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#09090b',
                backgroundColor: 'var(--color-accent)',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              <FloppyDisk size={14} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
