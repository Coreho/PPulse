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

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ project }: { project: Project }) {
  const { updateProject } = useProjectStore()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [classification, setClassification] = useState<ProjectClassification | ''>(project.classification ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project.status ?? 'planning')
  const [estDate, setEstDate] = useState(project.estimated_completion_date ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setName(project.name)
    setDescription(project.description ?? '')
    setClassification(project.classification ?? '')
    setStatus(project.status ?? 'planning')
    setEstDate(project.estimated_completion_date ?? '')
  }, [project.id])

  const handleSave = async () => {
    await updateProject(project.id, {
      name: name.trim() || project.name,
      description: description.trim() || null,
      classification: classification || null,
      status,
      estimated_completion_date: estDate || null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div style={{ maxWidth: '560px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project Name</label>
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What is this project?"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Classification</label>
          <select style={selectStyle} value={classification} onChange={e => setClassification(e.target.value as ProjectClassification | '')}>
            <option value="">— None —</option>
            <option value="software">Software</option>
            <option value="hardware">Hardware</option>
            <option value="mixed">Mixed</option>
            <option value="research">Research</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</label>
          <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estimated Completion</label>
        <input type="date" style={inputStyle} value={estDate} onChange={e => setEstDate(e.target.value)} />
      </div>

      <button
        type="button"
        onClick={handleSave}
        style={{
          alignSelf: 'flex-start',
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 16px', fontSize: '12px', fontWeight: 600,
          color: '#09090b',
          backgroundColor: saved ? 'var(--color-success)' : 'var(--color-accent)',
          border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
      >
        {saved ? <><Check size={13} weight="bold" /> Saved</> : 'Save Changes'}
      </button>
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
}

export function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const { activeProject } = useProjectStore()
  const current = activeProject?.id === project.id ? activeProject : project

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
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '0.25rem', backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-secondary)' }}>
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
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '8px 12px', fontSize: '12px', fontWeight: tab === t.key ? 600 : 400,
              border: 'none', borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: isFullHeight ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
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
