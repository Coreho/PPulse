import { useState, useMemo, useEffect } from 'react'
import {
  House, Code, Cpu, Shuffle, Flask, DotsThree,
  Plus, Trash, MagnifyingGlass, CaretRight, X, ArrowRight,
} from '@phosphor-icons/react'
import { useProjectStore } from '@/store/projectStore'
import type { Database, ProjectClassification, ProjectStatus, NavFilter } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

// ─── Classification metadata ─────────────────────────────────────────────────

type ClassMeta = { label: string; accent: string; Icon: React.ElementType }

export const CLASS_META: Record<string, ClassMeta> = {
  home:     { label: 'Home',     accent: '#f97316', Icon: House },
  software: { label: 'Software', accent: '#8b5cf6', Icon: Code },
  hardware: { label: 'Hardware', accent: '#22d3ee', Icon: Cpu },
  mixed:    { label: 'Mixed',    accent: '#d4854a', Icon: Shuffle },
  research: { label: 'Research', accent: '#3d9e42', Icon: Flask },
  other:    { label: 'Other',    accent: '#888888', Icon: DotsThree },
}

export function getClassAccent(c: string | null): string {
  return c ? (CLASS_META[c]?.accent ?? '#6366f1') : '#6366f1'
}

function getClassIcon(c: string | null): React.ElementType {
  return c ? (CLASS_META[c]?.Icon ?? DotsThree) : DotsThree
}

// ─── Status filter helpers ────────────────────────────────────────────────────

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning', active: 'In Progress', paused: 'Paused',
  completed: 'Completed', cancelled: 'Cancelled',
}

const STATUS_PROGRESS: Record<ProjectStatus, number> = {
  planning: 5, active: 50, paused: 30, completed: 100, cancelled: 0,
}

function applyNavFilter(projects: Project[], nav: NavFilter): Project[] {
  if (nav === 'active')    return projects.filter(p => p.status === 'active' || p.status === 'planning')
  if (nav === 'completed') return projects.filter(p => p.status === 'completed')
  if (nav === 'notes')     return projects.filter(p => (p.scratchpad_content ?? '').trim().length > 0)
  return projects
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG   = '#111111'
const EDGE = '1px solid rgba(255,255,255,0.07)'

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const s = 6, r = (size - s) / 2, circ = 2 * Math.PI * r, dash = (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={s} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={s}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: 12, color,
      }}>{pct}%</div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, active, onClick }: {
  label: string; value: number; color: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, borderRadius: '1rem', padding: '14px 18px', textAlign: 'left',
        background: active ? `${color}18` : BG,
        border: active ? `1px solid ${color}55` : EDGE,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
    >
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: '#444', margin: 0, marginTop: 2 }}>{label}</p>
    </button>
  )
}

// ─── Recent activity dashboard ─────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RecentActivityCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false)
  const ac = getClassAccent(project.classification)
  const Icon = getClassIcon(project.classification)
  const status = (project.status ?? 'planning') as ProjectStatus

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, minWidth: 0, position: 'relative',
        borderRadius: '1.25rem', padding: '16px 18px 44px',
        background: BG, border: `1px solid ${ac}33`, cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 16px 40px rgba(0,0,0,0.6), 0 0 22px ${ac}22` : 'none',
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 132,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
          fontSize: 11, fontWeight: 600, background: `${ac}18`, color: ac,
        }}>
          <Icon size={11} weight="fill" />
          {project.classification ? (CLASS_META[project.classification]?.label ?? project.classification) : 'Project'}
        </span>
        <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>{relativeTime(project.updated_at)}</span>
      </div>

      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 17, color: '#fff', margin: 0, lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{project.name}</h3>

      <p style={{
        fontSize: 12, color: '#666', margin: 0, lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {project.description?.trim() || `${STATUS_LABEL[status]} · no description yet`}
      </p>

      {/* Show more — bottom right */}
      <span style={{
        position: 'absolute', bottom: 12, right: 14,
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
        color: hovered ? ac : '#555', transition: 'color 0.2s',
      }}>
        Show more <ArrowRight size={12} weight="bold" />
      </span>
    </div>
  )
}

function RecentActivity({ projects, onOpen }: { projects: Project[]; onOpen: (p: Project) => void }) {
  // projects arrive sorted by updated_at desc from the store
  const recent = projects.slice(0, 3)
  if (recent.length === 0) return null

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#fff', margin: '0 0 12px' }}>
        Recent Activity
      </h2>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {recent.map(p => (
          <RecentActivityCard key={p.id} project={p} onOpen={() => onOpen(p)} />
        ))}
      </div>
    </div>
  )
}

// ─── Classification tabs ──────────────────────────────────────────────────────

function ClassificationTabs({ counts, active, onSelect }: {
  counts: Record<string, number>; active: string; onSelect: (k: string) => void
}) {
  const tabs = [
    { key: 'all', label: 'All', accent: '#fff', Icon: null, count: Object.values(counts).reduce((a, b) => a + b, 0) },
    ...Object.entries(CLASS_META)
      .filter(([k]) => (counts[k] ?? 0) > 0)
      .map(([k, m]) => ({ key: k, label: m.label, accent: m.accent, Icon: m.Icon, count: counts[k] })),
  ]

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
            background: active === t.key ? `${t.accent}18` : 'rgba(255,255,255,0.04)',
            border: active === t.key ? `1px solid ${t.accent}55` : '1px solid rgba(255,255,255,0.07)',
            color: active === t.key ? t.accent : '#444',
            boxShadow: active === t.key ? `0 0 12px ${t.accent}22` : 'none',
          }}
        >
          {t.Icon && <t.Icon size={13} weight={active === t.key ? 'fill' : 'regular'} />}
          {t.label}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
            background: active === t.key ? `${t.accent}25` : 'rgba(255,255,255,0.07)',
            color: active === t.key ? t.accent : '#555',
          }}>{t.count}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Project tile ─────────────────────────────────────────────────────────────

function ProjectTile({ project, onOpen, onDelete }: {
  project: Project; onOpen: () => void; onDelete: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ac = getClassAccent(project.classification)
  const Icon = getClassIcon(project.classification)
  const status = (project.status ?? 'planning') as ProjectStatus
  const pct = STATUS_PROGRESS[status]

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '2rem', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: BG, border: EDGE, cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 20px 48px rgba(0,0,0,0.7), 0 0 24px ${ac}22` : 'none',
        minHeight: 200,
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${ac}, ${ac}55)`, borderRadius: '2rem 2rem 0 0' }} />

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Classification + status badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {project.classification && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: `${ac}18`, color: ac,
                }}>
                  <Icon size={11} weight="fill" />
                  {CLASS_META[project.classification]?.label ?? project.classification}
                </span>
              )}
              <span style={{
                padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,0.05)', color: '#666',
              }}>
                {STATUS_LABEL[status]}
              </span>
            </div>
            {/* Name */}
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 19, color: '#fff',
              margin: 0, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.name}
            </h2>
            {project.description && (
              <p style={{
                fontSize: 12, color: '#555', margin: '6px 0 0', lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {project.description}
              </p>
            )}
          </div>
          <ProgressRing pct={pct} color={ac} size={60} />
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: ac, borderRadius: 999, transition: 'width 0.4s' }} />
          </div>
          {project.estimated_completion_date && (
            <span style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>
              Due {new Date(project.estimated_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {confirm ? (
            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => onDelete()} style={{ fontSize: 10, padding: '2px 8px', background: '#f87171', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>Del</button>
              <button type="button" onClick={() => setConfirm(false)} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(255,255,255,0.07)', color: '#666', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button type="button" onClick={e => { e.stopPropagation(); setConfirm(true) }}
              style={{ background: 'none', border: 'none', color: '#2a2a2a', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 1 }}>
              <Trash size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── New project modal ────────────────────────────────────────────────────────

function NewProjectModal({ onSave, onCancel }: {
  onSave: (name: string, classification: ProjectClassification | null, status: ProjectStatus) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [classification, setClassification] = useState<string>('')
  const [status, setStatus] = useState<ProjectStatus>('planning')

  const classOptions = Object.entries(CLASS_META) as [string, ClassMeta][]
  const ac = classification ? getClassAccent(classification) : '#7b2ff7'
  const canCreate = name.trim().length > 0

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.75rem',
          padding: '28px', width: 420, display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: `0 40px 80px rgba(0,0,0,0.8), 0 0 40px ${ac}22`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#fff', margin: 0 }}>New Project</h2>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Name</label>
          <input
            autoFocus
            placeholder="What are you building?"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canCreate) onSave(name.trim(), (classification as ProjectClassification) || null, status) }}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.875rem', padding: '11px 14px', fontSize: 15,
              color: '#fff', outline: 'none', fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Classification grid */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Type <span style={{ color: '#333', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {classOptions.map(([key, meta]) => {
              const sel = classification === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setClassification(sel ? '' : key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 8px', borderRadius: '1rem', cursor: 'pointer',
                    background: sel ? `${meta.accent}18` : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${sel ? meta.accent + '66' : 'rgba(255,255,255,0.07)'}`,
                    color: sel ? meta.accent : '#444',
                    transition: 'all 0.15s',
                    boxShadow: sel ? `0 0 14px ${meta.accent}22` : 'none',
                  }}
                >
                  <meta.Icon size={18} weight={sel ? 'fill' : 'regular'} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Status */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Starting Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['planning', 'active'] as ProjectStatus[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                style={{
                  padding: '7px 18px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: status === s ? (s === 'active' ? '#4ade8018' : 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${status === s ? (s === 'active' ? '#4ade8055' : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.07)'}`,
                  color: status === s ? (s === 'active' ? '#4ade80' : '#fff') : '#444',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'planning' ? 'Planning' : 'Active'}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button type="button" onClick={onCancel} style={{
            padding: '9px 20px', fontSize: 13, borderRadius: '0.875rem', cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', color: '#666',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>Cancel</button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => canCreate && onSave(name.trim(), (classification as ProjectClassification) || null, status)}
            style={{
              padding: '9px 22px', fontSize: 13, fontWeight: 700, borderRadius: '0.875rem', cursor: canCreate ? 'pointer' : 'not-allowed',
              background: canCreate ? 'linear-gradient(135deg, #7b2ff7, #ff0080)' : 'rgba(255,255,255,0.05)',
              color: canCreate ? '#fff' : '#333', border: 'none', transition: 'opacity 0.15s',
              boxShadow: canCreate ? '0 4px 20px rgba(123,47,247,0.4)' : 'none',
            }}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

function FAB({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position: 'fixed', bottom: 32, right: 32, width: 60, height: 60, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer', zIndex: 50,
        background: 'linear-gradient(135deg, #ff0080, #ff8c00, #40e0d0, #7b2ff7, #ff0080)',
        backgroundSize: '300% 300%', animation: 'gradientSpin 4s linear infinite',
        transform: hov ? 'scale(1.12)' : 'scale(1)',
        boxShadow: hov ? '0 0 40px rgba(123,47,247,0.55), 0 0 20px rgba(255,0,128,0.35)' : '0 8px 32px rgba(0,0,0,0.5)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
    >
      <Plus size={26} color="#fff" weight="bold" />
    </button>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface ProjectListProps {
  onOpen: (project: Project) => void
  filter: NavFilter
}

export function ProjectList({ onOpen, filter: navFilter }: ProjectListProps) {
  const { projects, createProject, deleteProject, loading } = useProjectStore()
  const [classTab, setClassTab] = useState('all')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeStatFilter, setActiveStatFilter] = useState<ProjectStatus | null>(null)

  // Reset class tab and stat filter when nav changes
  useEffect(() => { setClassTab('all'); setSearch(''); setActiveStatFilter(null) }, [navFilter])

  // Keyboard shortcut: N = new project
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey &&
          !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setShowNew(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Filter pipeline
  const byNav = useMemo(() => applyNavFilter(projects, navFilter), [projects, navFilter])

  const byStat = useMemo(() =>
    activeStatFilter ? byNav.filter(p => p.status === activeStatFilter) : byNav,
    [byNav, activeStatFilter])

  const classCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of byStat) { const k = p.classification ?? 'other'; c[k] = (c[k] ?? 0) + 1 }
    return c
  }, [byStat])

  const byClass = useMemo(() =>
    classTab === 'all' ? byStat : byStat.filter(p => (p.classification ?? 'other') === classTab),
    [byStat, classTab])

  const displayed = useMemo(() =>
    search.trim() ? byClass.filter(p => p.name.toLowerCase().includes(search.toLowerCase().trim())) : byClass,
    [byClass, search])

  // Global stats (always full picture for dashboard feel)
  const stats = useMemo(() => ({
    total:     projects.length,
    active:    projects.filter(p => p.status === 'active').length,
    planning:  projects.filter(p => p.status === 'planning').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }), [projects])

  const handleCreate = async (name: string, classification: ProjectClassification | null, status: ProjectStatus) => {
    setCreating(true)
    try {
      const project = await createProject(name, classification, status)
      setShowNew(false)
      onOpen(project)
    } finally {
      setCreating(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const sectionLabel =
    navFilter === 'active'    ? 'Active Work' :
    navFilter === 'completed' ? 'Completed'   :
    navFilter === 'notes'     ? 'With Notes'  : 'All Projects'

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#000' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 8px' }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 12, color: '#333', margin: '0 0 4px', fontFamily: 'var(--font-sans)' }}>{dateStr}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: '#fff', margin: 0, lineHeight: 1.1 }}>
              {greeting}, Corey
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 999,
              background: searchOpen ? '#181818' : BG,
              border: searchOpen ? '1px solid rgba(255,255,255,0.15)' : EDGE,
              transition: 'all 0.2s', minWidth: searchOpen ? 220 : 'auto',
            }}
              onClick={() => !searchOpen && setSearchOpen(true)}
            >
              <MagnifyingGlass size={14} color={searchOpen ? '#888' : '#333'} style={{ flexShrink: 0 }} />
              {searchOpen ? (
                <input
                  autoFocus
                  placeholder="Search projects…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false) } }}
                  onBlur={() => { if (!search) setSearchOpen(false) }}
                  style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#fff', flex: 1, fontFamily: 'var(--font-sans)', width: '100%' }}
                />
              ) : (
                <span style={{ fontSize: 13, color: '#2a2a2a' }}>Search…</span>
              )}
              {search && <X size={13} color="#555" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={e => { e.stopPropagation(); setSearch('') }} />}
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          <StatCard label="Total"     value={stats.total}     color="#8b5cf6" active={activeStatFilter === null}    onClick={() => setActiveStatFilter(null)} />
          <StatCard label="Active"    value={stats.active}    color="#4ade80" active={activeStatFilter === 'active'}    onClick={() => setActiveStatFilter(f => f === 'active' ? null : 'active')} />
          <StatCard label="Planning"  value={stats.planning}  color="#f59e0b" active={activeStatFilter === 'planning'}  onClick={() => setActiveStatFilter(f => f === 'planning' ? null : 'planning')} />
          <StatCard label="Completed" value={stats.completed} color="#22d3ee" active={activeStatFilter === 'completed'} onClick={() => setActiveStatFilter(f => f === 'completed' ? null : 'completed')} />
        </div>

        {/* ── Recent activity (dashboard, default view only) ── */}
        {navFilter === 'all' && !search && !activeStatFilter && (
          <RecentActivity projects={projects} onOpen={onOpen} />
        )}

        {/* ── Section header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#fff', margin: 0 }}>
            {search ? `Search: "${search}"` : sectionLabel}
          </h2>
          {displayed.length > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              padding: '5px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.04)', color: '#444',
              border: EDGE,
            }}>
              {displayed.length} project{displayed.length !== 1 ? 's' : ''} <CaretRight size={11} />
            </span>
          )}
        </div>

        {/* ── Classification sub-tabs ── */}
        {byStat.length > 0 && (
          <ClassificationTabs counts={classCounts} active={classTab} onSelect={setClassTab} />
        )}

        {/* ── Grid ── */}
        {loading && displayed.length === 0 ? (
          <p style={{ color: '#2a2a2a', fontSize: 13, textAlign: 'center', marginTop: 60 }}>Loading…</p>
        ) : displayed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '35vh', gap: 14 }}>
            {search ? (
              <>
                <p style={{ color: '#333', fontSize: 14, margin: 0 }}>No projects match "{search}"</p>
                <button type="button" onClick={() => setSearch('')} style={{ fontSize: 12, color: '#555', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '6px 16px', cursor: 'pointer' }}>
                  Clear search
                </button>
              </>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '1.25rem', background: 'rgba(255,255,255,0.03)', border: EDGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={24} color="#2a2a2a" />
                </div>
                <p style={{ color: '#333', fontSize: 14, margin: 0 }}>
                  {classTab !== 'all' ? `No ${CLASS_META[classTab]?.label ?? classTab} projects yet` : 'No projects yet'}
                </p>
                <button type="button" onClick={() => setShowNew(true)} style={{
                  padding: '9px 22px', fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7b2ff7, #ff0080)', color: '#fff', border: 'none',
                }}>
                  Create one <span style={{ opacity: 0.6 }}>N</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 14, alignItems: 'start',
          }}>
            {displayed.map(p => (
              <ProjectTile key={p.id} project={p} onOpen={() => onOpen(p)} onDelete={() => deleteProject(p.id)} />
            ))}
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      {showNew && <NewProjectModal onSave={handleCreate} onCancel={() => setShowNew(false)} />}
      <FAB onClick={() => !creating && setShowNew(true)} />
    </div>
  )
}
