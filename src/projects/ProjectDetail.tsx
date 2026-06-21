import { useEffect, useState } from 'react'
import {
  ArrowLeft, CheckSquare, Package, Warning, Columns, Notepad,
  Cpu, Check, Trash, Plus, PencilSimple, X, Terminal, Circuitry,
  FolderOpen, Wrench, Timer, Circle,
} from '@phosphor-icons/react'
import { useProjectStore } from '@/store/projectStore'
import { useObjectivesStore } from '@/store/objectivesStore'
import { useIssuesStore } from '@/store/issuesStore'
import { Board } from '@/kanban/Board'
import { Scratchpad } from '@/scratchpad/Scratchpad'
import { BomPanel } from '@/bom/BomPanel'
import { SerialMonitorPanel } from '@/hardware/SerialMonitorPanel'
import { FileVaultPanel } from '@/hardware/FileVaultPanel'
import { PinoutPanel } from '@/pinout/PinoutPanel'
import { PinoutOverlay } from '@/pinout/PinoutOverlay'
import { MachinesPanel } from '@/machines/MachinesPanel'
import { TimerPanel } from '@/timers/TimerPanel'
import { useUIStore } from '@/store/uiStore'
import type { Database, ProjectClassification, ProjectStatus, IssueSeverity } from '@/db/types'
import { getClassAccent } from '@/projects/ProjectList'
import { SubProjectsSection } from '@/projects/subprojects/SubProjectsSection'

type Project = Database['public']['Tables']['projects']['Row']
type Objective = Database['public']['Tables']['objectives']['Row']
type Issue = Database['public']['Tables']['issues']['Row']

type Tab = 'overview' | 'objectives' | 'bom' | 'issues' | 'kanban' | 'notes' | 'hardware'
type HardwarePanel = 'serial' | 'pinout' | 'vault' | 'machines' | 'timers'

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-0)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.375rem',
  padding: '7px 10px',
  fontSize: '13px',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  width: '100%',
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

// ── Overview tab helpers ───────────────────────────────────────────────────────

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  margin: '0 0 10px',
}

const META_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '10px',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  planning:  { label: 'Planning',  color: '#888',    bg: 'rgba(136,136,136,0.15)' },
  active:    { label: 'Active',    color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  paused:    { label: 'Paused',    color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  completed: { label: 'Completed', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  cancelled: { label: 'Cancelled', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
}

function OverviewProgressRing({ pct, accent }: { pct: number; accent: string }) {
  const [animPct, setAnimPct] = useState(0)
  const r = 44, circ = 2 * Math.PI * r

  useEffect(() => {
    const timer = setTimeout(() => setAnimPct(pct), 50)
    return () => clearTimeout(timer)
  }, [pct])

  const dash = (animPct / 100) * circ
  return (
    <svg width={108} height={108} viewBox="0 0 108 108" style={{ display: 'block' }}>
      <circle cx={54} cy={54} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} />
      <circle
        cx={54} cy={54} r={r} fill="none" stroke={accent} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={54} y={50} textAnchor="middle" fill="#fff" fontSize={18} fontWeight="bold" fontFamily="Archivo Black, sans-serif">{Math.round(animPct)}%</text>
      <text x={54} y={67} textAnchor="middle" fill="#666" fontSize={10} fontFamily="Inter, sans-serif">Complete</text>
    </svg>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ project }: { project: Project }) {
  const { updateProject } = useProjectStore()
  const { objectives, loading: objLoading, loadObjectives, toggleObjective } = useObjectivesStore()

  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [classification, setClassification] = useState<ProjectClassification | ''>(project.classification ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project.status ?? 'planning')
  const [estDate, setEstDate] = useState(project.estimated_completion_date ?? '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setName(project.name)
    setDescription(project.description ?? '')
    setClassification(project.classification ?? '')
    setStatus(project.status ?? 'planning')
    setEstDate(project.estimated_completion_date ?? '')
  }, [project.id])

  useEffect(() => { loadObjectives(project.id) }, [project.id, loadObjectives])

  const done = objectives.filter(o => o.completed).length
  const total = objectives.length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  const accent = getClassAccent(classification || null)

  const handleSave = async (overrides?: Partial<Parameters<typeof updateProject>[1]>) => {
    await updateProject(project.id, {
      name: name.trim() || project.name,
      description: description.trim() || null,
      classification: classification || null,
      status,
      estimated_completion_date: estDate || null,
      ...overrides,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  const handleStatusChange = (s: ProjectStatus) => {
    setStatus(s)
    void handleSave({ status: s })
  }

  const handleClassChange = (c: ProjectClassification | '') => {
    setClassification(c)
    void handleSave({ classification: c || null })
  }

  const handleEstDateChange = (d: string) => {
    setEstDate(d)
    void handleSave({ estimated_completion_date: d || null })
  }

  const SkeletonLine = ({ w = '100%' }: { w?: string }) => (
    <div style={{
      height: 12, width: w, borderRadius: 6,
      background: 'linear-gradient(90deg, #1a1a1a 25%, #242424 50%, #1a1a1a 75%)',
      backgroundSize: '800px 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )

  return (
    <div style={{ maxWidth: '680px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Project header ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: '14px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'fadeUp 0.35s ease both',
        animationDelay: '0ms',
      }}>
        {editingName ? (
          <input
            autoFocus
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${accent}55`,
              borderRadius: '8px', padding: '6px 10px', fontSize: '20px', fontWeight: 700,
              color: '#fff', outline: 'none', fontFamily: 'var(--font-display)',
            }}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => { setEditingName(false); void handleSave({ name: name.trim() || project.name }) }}
            onKeyDown={e => { if (e.key === 'Enter') { setEditingName(false); void handleSave({ name: name.trim() || project.name }) } if (e.key === 'Escape') { setName(project.name); setEditingName(false) } }}
          />
        ) : (
          <h2 style={{
            flex: 1, fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff',
            margin: 0, lineHeight: 1.2, cursor: 'pointer',
          }}
            onClick={() => setEditingName(true)}
          >
            {name}
          </h2>
        )}
        {classification && (
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
            background: `${accent}18`, color: accent, flexShrink: 0,
          }}>
            {classification}
          </span>
        )}
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
          background: STATUS_CONFIG[status]?.bg ?? 'rgba(255,255,255,0.07)',
          color: STATUS_CONFIG[status]?.color ?? '#888',
          flexShrink: 0,
        }}>
          {STATUS_CONFIG[status]?.label ?? status}
        </span>
        <button
          type="button"
          onClick={() => setEditingName(true)}
          aria-label="Edit name"
          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
        >
          <PencilSimple size={14} />
        </button>
        {saved && (
          <span style={{ fontSize: '11px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Check size={12} weight="bold" /> Saved
          </span>
        )}
      </div>

      {/* ── Two-column: ring + metadata ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '124px 1fr', gap: '16px', alignItems: 'start', animation: 'fadeUp 0.35s ease both', animationDelay: '80ms' }}>

        {/* Progress ring */}
        <div style={{
          ...META_CARD,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          minHeight: '140px',
        }}>
          <OverviewProgressRing pct={pct} accent={accent} />
          {total > 0 && (
            <span style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
              {done}/{total} objectives
            </span>
          )}
        </div>

        {/* Metadata cards column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Classification */}
          <div style={META_CARD}>
            <span style={SECTION_LABEL}>Classification</span>
            <select
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
                color: accent, outline: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontWeight: 600,
              }}
              value={classification}
              onChange={e => handleClassChange(e.target.value as ProjectClassification | '')}
            >
              <option value="">— None —</option>
              <option value="home">Home</option>
              <option value="software">Software</option>
              <option value="hardware">Hardware</option>
              <option value="mixed">Mixed</option>
              <option value="research">Research</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Status pills */}
          <div style={META_CARD}>
            <span style={SECTION_LABEL}>Status</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(Object.entries(STATUS_CONFIG) as [ProjectStatus, typeof STATUS_CONFIG[ProjectStatus]][]).map(([s, cfg]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  style={{
                    padding: '4px 11px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                    background: status === s ? cfg.bg : 'rgba(255,255,255,0.04)',
                    color: status === s ? cfg.color : '#444',
                    outline: status === s ? `1px solid ${cfg.color}55` : '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Est. completion */}
          <div style={META_CARD}>
            <span style={SECTION_LABEL}>Est. Completion</span>
            <input
              type="date"
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
                color: '#ccc', outline: 'none', fontFamily: 'var(--font-sans)',
                colorScheme: 'dark',
              }}
              value={estDate}
              onChange={e => handleEstDateChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Objectives & KRs ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        padding: '18px 20px',
        animation: 'fadeUp 0.35s ease both',
        animationDelay: '160ms',
      }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ ...SECTION_LABEL, margin: 0 }}>Objectives &amp; KRs</h3>
          <span style={{ fontSize: '11px', color: '#444' }}>{done} / {total} complete</span>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden', marginBottom: '14px' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: '2px', transition: 'width 0.4s' }} />
          </div>
        )}

        {/* Objectives list */}
        {objLoading && total === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine />
            <SkeletonLine w="80%" />
            <SkeletonLine w="90%" />
          </div>
        ) : total === 0 ? (
          <p style={{ fontSize: '12px', color: '#333', margin: 0, textAlign: 'center', padding: '16px 0' }}>
            No objectives yet — add them in the Objectives tab
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {objectives.map(obj => (
              <div key={obj.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => void toggleObjective(obj.id)}
                  aria-label={obj.completed ? 'Mark incomplete' : 'Mark complete'}
                  style={{
                    flexShrink: 0, width: '17px', height: '17px', borderRadius: '4px',
                    border: `2px solid ${obj.completed ? accent : 'rgba(255,255,255,0.15)'}`,
                    background: obj.completed ? accent : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {obj.completed && <Check size={10} weight="bold" style={{ color: '#09090b' }} />}
                </button>
                <span style={{
                  fontSize: '13px', flex: 1,
                  color: obj.completed ? '#444' : '#ccc',
                  textDecoration: obj.completed ? 'line-through' : 'none',
                }}>
                  {obj.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Description ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        padding: '18px 20px',
        animation: 'fadeUp 0.35s ease both',
        animationDelay: '240ms',
      }}>
        <h3 style={{ ...SECTION_LABEL, margin: '0 0 10px' }}>Description</h3>
        {editingDesc ? (
          <textarea
            autoFocus
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${accent}44`, borderRadius: '8px',
              padding: '10px 12px', fontSize: '13px', color: '#ccc',
              outline: 'none', fontFamily: 'var(--font-sans)', resize: 'vertical',
              minHeight: '80px', boxSizing: 'border-box', lineHeight: 1.6,
            }}
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => { setEditingDesc(false); void handleSave({ description: description.trim() || null }) }}
            onKeyDown={e => { if (e.key === 'Escape') setEditingDesc(false) }}
          />
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            style={{
              fontSize: '13px', color: description ? '#888' : '#333',
              margin: 0, lineHeight: 1.6, cursor: 'text',
              minHeight: '40px',
              fontStyle: description ? 'normal' : 'italic',
            }}
          >
            {description || 'Click to add a description…'}
          </p>
        )}
      </div>

      {/* ── Sub-projects ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '20px', animation: 'fadeUp 0.35s ease both', animationDelay: '320ms' }}>
        <SubProjectsSection projectId={project.id} />
      </div>
    </div>
  )
}

// ── Objectives tab ────────────────────────────────────────────────────────────

function ObjectivesTab({ projectId }: { projectId: string }) {
  const { objectives, loading, loadObjectives, addObjective, toggleObjective, updateObjective, deleteObjective } = useObjectivesStore()
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  useEffect(() => { loadObjectives(projectId) }, [projectId, loadObjectives])

  const done = objectives.filter(o => o.completed).length
  const total = objectives.length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  const handleAdd = async () => {
    const t = newTitle.trim()
    if (!t) return
    setNewTitle('')
    await addObjective(projectId, t)
  }

  const startEdit = (o: Objective) => { setEditingId(o.id); setEditTitle(o.title) }
  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await updateObjective(editingId, editTitle.trim())
    }
    setEditingId(null)
  }

  return (
    <div style={{ maxWidth: '560px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Progress bar */}
      {total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{done} of {total} complete</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: pct === 100 ? 'var(--color-success)' : 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
          </div>
          <div style={{ height: '4px', backgroundColor: 'var(--color-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct === 100 ? 'var(--color-success)' : 'var(--color-accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Add row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Add an objective…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '7px 12px', fontSize: '12px', fontWeight: 600,
            color: '#09090b',
            backgroundColor: newTitle.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none', borderRadius: '0.375rem',
            cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <Plus size={12} weight="bold" /> Add
        </button>
      </div>

      {/* List */}
      {loading && total === 0 && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading…</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {objectives.map(obj => (
          <div
            key={obj.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 10px',
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '0.375rem',
            }}
          >
            <button
              type="button"
              onClick={() => toggleObjective(obj.id)}
              style={{
                flexShrink: 0, width: '18px', height: '18px',
                borderRadius: '0.25rem',
                border: `2px solid ${obj.completed ? 'var(--color-success)' : 'var(--color-border)'}`,
                backgroundColor: obj.completed ? 'var(--color-success)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={obj.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              {obj.completed && <Check size={11} weight="bold" style={{ color: '#09090b' }} />}
            </button>

            {editingId === obj.id ? (
              <input
                autoFocus
                style={{ ...inputStyle, flex: 1, padding: '3px 6px', fontSize: '12px' }}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                onBlur={saveEdit}
              />
            ) : (
              <span
                style={{
                  flex: 1, fontSize: '13px',
                  color: obj.completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                  textDecoration: obj.completed ? 'line-through' : 'none',
                }}
              >
                {obj.title}
              </span>
            )}

            <button
              type="button"
              onClick={() => startEdit(obj)}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px', opacity: 0.5 }}
              aria-label="Edit"
            >
              <PencilSimple size={12} />
            </button>
            <button
              type="button"
              onClick={() => deleteObjective(obj.id)}
              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px', opacity: 0.5 }}
              aria-label="Delete"
            >
              <Trash size={12} />
            </button>
          </div>
        ))}

        {!loading && total === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            <CheckSquare size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
            No objectives yet
          </div>
        )}
      </div>
    </div>
  )
}

// ── Issues tab ────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  low: '#4ade80',
  medium: '#fbbf24',
  high: '#fb923c',
  critical: '#f87171',
}

function IssuesTab({ projectId }: { projectId: string }) {
  const { issues, loading, loadIssues, addIssue, updateIssue, deleteIssue } = useIssuesStore()
  const [newTitle, setNewTitle] = useState('')
  const [newSeverity, setNewSeverity] = useState<IssueSeverity>('medium')
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open')

  useEffect(() => { loadIssues(projectId) }, [projectId, loadIssues])

  const handleAdd = async () => {
    const t = newTitle.trim()
    if (!t) return
    setNewTitle('')
    await addIssue(projectId, t, newSeverity)
  }

  const visible = issues.filter(i => filter === 'all' ? true : filter === 'open' ? i.status !== 'closed' : i.status === 'closed')
  const openCount = issues.filter(i => i.status !== 'closed').length

  return (
    <div style={{ maxWidth: '640px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Add form */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Describe the issue…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <select
          style={{ ...selectStyle, width: '100px', flexShrink: 0 }}
          value={newSeverity}
          onChange={e => setNewSeverity(e.target.value as IssueSeverity)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '7px 12px', fontSize: '12px', fontWeight: 600,
            color: '#09090b',
            backgroundColor: newTitle.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none', borderRadius: '0.375rem',
            cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          <Plus size={12} weight="bold" /> Add
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
        {(['open', 'closed', 'all'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 10px', fontSize: '11px', fontWeight: 600,
              border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
              backgroundColor: filter === f ? 'var(--color-surface-3)' : 'transparent',
              color: filter === f ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {f === 'open' ? `Open (${openCount})` : f === 'closed' ? `Closed (${issues.length - openCount})` : `All (${issues.length})`}
          </button>
        ))}
      </div>

      {loading && issues.length === 0 && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading…</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visible.map(issue => (
          <IssueRow key={issue.id} issue={issue} onUpdate={updateIssue} onDelete={deleteIssue} />
        ))}

        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            <Warning size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
            {filter === 'open' ? 'No open issues' : filter === 'closed' ? 'No closed issues' : 'No issues'}
          </div>
        )}
      </div>
    </div>
  )
}

function IssueRow({ issue, onUpdate, onDelete }: { issue: Issue; onUpdate: (id: string, u: Parameters<ReturnType<typeof useIssuesStore>['updateIssue']>[1]) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editDesc, setEditDesc] = useState(issue.description ?? '')
  const isClosed = issue.status === 'closed'

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: `1px solid ${isClosed ? 'var(--color-border-subtle)' : 'var(--color-border)'}`,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        opacity: isClosed ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
        {/* Severity dot */}
        <Circle size={9} weight="fill" style={{ color: SEVERITY_COLOR[issue.severity], flexShrink: 0 }} />

        {/* Title */}
        <span
          style={{
            flex: 1, fontSize: '13px',
            color: isClosed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            textDecoration: isClosed ? 'line-through' : 'none',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(e => !e)}
        >
          {issue.title}
        </span>

        {/* Severity selector */}
        <select
          style={{ ...selectStyle, width: '80px', padding: '2px 6px', fontSize: '10px' }}
          value={issue.severity}
          onChange={e => onUpdate(issue.id, { severity: e.target.value as IssueSeverity })}
          onClick={e => e.stopPropagation()}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        {/* Toggle closed */}
        <button
          type="button"
          title={isClosed ? 'Reopen' : 'Close'}
          onClick={() => onUpdate(issue.id, { status: isClosed ? 'open' : 'closed' })}
          style={{
            width: '22px', height: '22px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${isClosed ? 'var(--color-success)' : 'var(--color-border)'}`,
            borderRadius: '0.25rem',
            backgroundColor: isClosed ? 'rgba(74,222,128,0.1)' : 'transparent',
            cursor: 'pointer',
            color: isClosed ? 'var(--color-success)' : 'var(--color-text-muted)',
          }}
        >
          {isClosed ? <Check size={11} weight="bold" /> : <X size={11} />}
        </button>

        <button
          type="button"
          onClick={() => onDelete(issue.id)}
          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px', opacity: 0.5 }}
          aria-label="Delete issue"
        >
          <Trash size={12} />
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '10px 12px' }}>
          <textarea
            style={{ ...inputStyle, fontSize: '12px', minHeight: '60px', resize: 'vertical' }}
            placeholder="Add notes or details…"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            onBlur={() => onUpdate(issue.id, { description: editDesc.trim() || null })}
          />
        </div>
      )}
    </div>
  )
}

// ── Hardware tab ──────────────────────────────────────────────────────────────

const HW_PANELS: { key: HardwarePanel; label: string; icon: React.ReactNode }[] = [
  { key: 'serial', label: 'Serial Monitor', icon: <Terminal size={13} /> },
  { key: 'pinout', label: 'Pinout Mapper', icon: <Circuitry size={13} /> },
  { key: 'vault', label: 'File Vault', icon: <FolderOpen size={13} /> },
  { key: 'machines', label: 'Machines', icon: <Wrench size={13} /> },
  { key: 'timers', label: 'Timers', icon: <Timer size={13} /> },
]

function HardwareTab() {
  const { isPinoutOpen } = useUIStore()
  const [active, setActive] = useState<HardwarePanel>('serial')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '2px', padding: '8px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {HW_PANELS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setActive(p.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', fontSize: '11px', fontWeight: active === p.key ? 600 : 400,
              border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
              backgroundColor: active === p.key ? 'var(--color-surface-3)' : 'transparent',
              color: active === p.key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {active === 'serial' && <SerialMonitorPanel />}
        {active === 'pinout' && <PinoutPanel />}
        {active === 'vault' && <FileVaultPanel />}
        {active === 'machines' && <MachinesPanel />}
        {active === 'timers' && <TimerPanel />}
      </div>
      {isPinoutOpen && <PinoutOverlay />}
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <Cpu size={13} /> },
  { key: 'objectives', label: 'Objectives', icon: <CheckSquare size={13} /> },
  { key: 'bom', label: 'BOM', icon: <Package size={13} /> },
  { key: 'issues', label: 'Issues', icon: <Warning size={13} /> },
  { key: 'kanban', label: 'Kanban', icon: <Columns size={13} /> },
  { key: 'notes', label: 'Notes', icon: <Notepad size={13} /> },
  { key: 'hardware', label: 'Hardware', icon: <Wrench size={13} /> },
]

// ── Root ──────────────────────────────────────────────────────────────────────

interface ProjectDetailProps {
  project: Project
  onBack: () => void
  initialTab?: Tab
}

export function ProjectDetail({ project, onBack, initialTab = 'overview' }: ProjectDetailProps) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [hoveredTab, setHoveredTab] = useState<Tab | null>(null)
  const { activeProject } = useProjectStore()
  const current = activeProject?.id === project.id ? activeProject : project

  const accent = getClassAccent(current.classification)
  const isFullHeight = tab === 'kanban' || tab === 'notes' || tab === 'hardware'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-surface-0)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 16px', height: '40px', flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '12px',
            padding: '4px 6px', borderRadius: '0.25rem',
          }}
          className="hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-3)]"
        >
          <ArrowLeft size={13} />
          Projects
        </button>
        <span style={{ color: 'var(--color-border)', fontSize: '14px' }}>/</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current.name}
        </span>
        {current.classification && (
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '0.25rem', backgroundColor: `${accent}18`, color: accent }}>
            {current.classification}
          </span>
        )}
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '0.25rem', backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-secondary)' }}>
          {current.status ?? 'planning'}
        </span>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex', gap: '2px', padding: '0 16px',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
          flexShrink: 0, overflowX: 'auto',
        }}
      >
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            onMouseEnter={() => setHoveredTab(t.key)}
            onMouseLeave={() => setHoveredTab(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '8px 12px', fontSize: '12px', fontWeight: tab === t.key ? 600 : 400,
              border: 'none', borderBottom: tab === t.key ? `2px solid ${accent}` : '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              backgroundColor: tab === t.key ? 'transparent' : hoveredTab === t.key ? 'rgba(255,255,255,0.04)' : 'transparent',
              color: tab === t.key ? accent : 'var(--color-text-muted)',
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'border-color 0.2s ease, background-color 0.15s ease, color 0.15s ease',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        key={tab}
        style={{
          flex: 1, minHeight: 0,
          overflow: isFullHeight ? 'hidden' : 'auto',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeUp 0.25s ease both',
        }}
      >
        {tab === 'overview' && <OverviewTab project={current} />}
        {tab === 'objectives' && <ObjectivesTab projectId={current.id} />}
        {tab === 'bom' && <div style={{ padding: '0' }}><BomPanel /></div>}
        {tab === 'issues' && <IssuesTab projectId={current.id} />}
        {tab === 'kanban' && <Board projectId={current.id} />}
        {tab === 'notes' && (
          <Scratchpad
            projectId={current.id}
            initialContent={current.scratchpad_content ?? ''}
          />
        )}
        {tab === 'hardware' && <HardwareTab />}
      </div>
    </div>
  )
}
