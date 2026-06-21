import { useState, useMemo, useEffect, useRef } from 'react'
import {
  House, Code, Cpu, Shuffle, Flask, DotsThree,
  Plus, Trash, MagnifyingGlass, CaretRight, X, ArrowRight,
} from '@phosphor-icons/react'
import { useProjectStore } from '@/store/projectStore'
import { useRollupStore } from '@/store/rollupStore'
import { supabase } from '@/db/supabase'
import { ProjectControls, type ViewMode, type SortKey } from './master/ProjectControls'
import { ProjectCardActions } from './master/ProjectCardActions'
import type { Database, ProjectClassification, ProjectStatus, NavFilter } from '@/db/types'
import type { ProjectRollup } from '@/store/rollups'

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

// ─── useCountUp hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start: number | undefined
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 18, padding: 20, height: 260,
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
      backgroundSize: '800px 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}

// ─── SparklineChart SVG ───────────────────────────────────────────────────────

function SparklineChart({ pct, accent }: { pct: number; accent: string }) {
  const bars = Array.from({ length: 8 }, (_, i) => {
    const base = (i / 7) * pct
    const jitter = Math.sin(i * 2.3) * 8
    return Math.max(4, Math.min(100, base + jitter))
  })
  return (
    <svg width={80} height={40} style={{ display: 'block' }}>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 11}
          y={40 - (h / 100) * 38}
          width={7}
          height={(h / 100) * 38}
          rx={2}
          fill={i === 7 ? accent : `${accent}55`}
          style={{ transition: 'height 0.4s ease' }}
        />
      ))}
    </svg>
  )
}

// ─── MiniRing SVG ─────────────────────────────────────────────────────────────

function MiniRing({ pct, accent }: { pct: number; accent: string }) {
  const r = 20, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const mounted = useRef(false)
  const [animDash, setAnimDash] = useState(0)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      // Trigger animation after mount
      const id = requestAnimationFrame(() => setAnimDash(dash))
      return () => cancelAnimationFrame(id)
    } else {
      setAnimDash(dash)
    }
  }, [dash])

  return (
    <svg width={52} height={52} viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <circle
        cx={26} cy={26} r={r} fill="none" stroke={accent} strokeWidth={5}
        strokeDasharray={`${animDash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 4px ${accent}88)` }}
      />
      <text x={26} y={30} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="bold"
        fontFamily="Archivo Black, sans-serif">{Math.round(pct)}%</text>
    </svg>
  )
}

// ─── Progress ring (kept for board/other use) ─────────────────────────────────

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


// ─── Recent activity dashboard ─────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RecentActivity({ projects, onOpen }: { projects: Project[]; onOpen: (p: Project) => void }) {
  const recent = [...projects]
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .slice(0, 5)
  if (recent.length === 0) return null

  return (
    <section style={{ margin: '0 0 24px' }}>
      <h2 style={{
        fontSize: 13, color: '#666', textTransform: 'uppercase',
        letterSpacing: '0.08em', margin: '0 0 12px',
        fontFamily: 'var(--font-sans)', fontWeight: 600,
      }}>
        Recent Activity
      </h2>
      {recent.map(p => {
        const ac = getClassAccent(p.classification)
        const Icon = getClassIcon(p.classification)
        const status = (p.status ?? 'planning') as ProjectStatus
        return (
          <ActivityRow
            key={p.id}
            project={p}
            ac={ac}
            Icon={Icon}
            status={status}
            onOpen={() => onOpen(p)}
          />
        )
      })}
    </section>
  )
}

function ActivityRow({ project, ac, Icon, status, onOpen }: {
  project: Project
  ac: string
  Icon: React.ElementType
  status: ProjectStatus
  onOpen: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', borderRadius: 12,
        background: hovered ? 'rgba(255,255,255,0.04)' : '#111',
        marginBottom: 8, cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.05)',
        transition: 'background 0.15s',
      }}
    >
      <Icon size={16} weight="fill" color={ac} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#ddd', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.name}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
        background: 'rgba(255,255,255,0.05)', color: '#555', flexShrink: 0,
      }}>
        {STATUS_LABEL[status]}
      </span>
      <span style={{ fontSize: 11, color: '#444', flexShrink: 0 }}>
        {relativeTime(project.updated_at)}
      </span>
      <CaretRight size={14} color="#444" style={{ flexShrink: 0 }} />
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

interface TileObjective { id: string; title: string; completed: boolean }

function ProjectTile({ project, onOpen, onDelete, rollup, objectives, index = 0 }: {
  project: Project
  onOpen: () => void
  onDelete: () => void
  rollup?: ProjectRollup
  objectives?: TileObjective[]
  index?: number
}) {
  const [confirm, setConfirm] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ac = getClassAccent(project.classification)
  const Icon = getClassIcon(project.classification)
  const status = (project.status ?? 'planning') as ProjectStatus

  // Use rollup completion (0–1) if available, fall back to STATUS_PROGRESS
  const pct = rollup
    ? Math.round(rollup.completion * 100)
    : STATUS_PROGRESS[status]

  const topObjs = (objectives ?? []).slice(0, 3)
  const nextIncomplete = (objectives ?? []).find(o => !o.completed)

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 18,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#111',
        border: hovered ? `1px solid ${ac}30` : '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 12px 40px ${ac}25, 0 0 0 1px ${ac}30`
          : 'none',
        animation: 'fadeUp 0.35s ease both',
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Thin accent top bar */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, ${ac}, ${ac}44)`,
        flexShrink: 0,
      }} />

      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>

        {/* ── Header: icon + name + pin badge ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
          <Icon size={16} weight="fill" color={ac} style={{ flexShrink: 0, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              color: '#fff',
              margin: 0,
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {project.is_pinned && (
                <span style={{ fontSize: 10, marginRight: 5, color: '#f59e0b' }}>📌</span>
              )}
              {project.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {project.classification && (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: ac,
                  padding: '1px 7px', borderRadius: 999,
                  background: `${ac}18`,
                }}>
                  {CLASS_META[project.classification]?.label ?? project.classification}
                </span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#555',
                padding: '1px 7px', borderRadius: 999,
                background: 'rgba(255,255,255,0.05)',
              }}>
                {STATUS_LABEL[status]}
              </span>
              {rollup && rollup.subProjectCount > 0 && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                  {rollup.subProjectCount} sub
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Sparkline + big pct metric + MiniRing ── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* ROI label */}
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {rollup && rollup.openIssues > 0
                ? `${rollup.openIssues} open issue${rollup.openIssues > 1 ? 's' : ''}`
                : 'Progress'}
            </span>
            <SparklineChart pct={pct} accent={ac} />
            {/* Big % metric */}
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              color: ac,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              {pct}%
            </span>
          </div>
          <MiniRing pct={pct} accent={ac} />
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />

        {/* ── Milestones / Objectives ── */}
        {topObjs.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              display: 'block',
              marginBottom: 5,
            }}>
              Milestones
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {topObjs.map(obj => (
                <div key={obj.id} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 10, color: obj.completed ? '#333' : '#555', flexShrink: 0 }}>•</span>
                  <span style={{
                    fontSize: 11,
                    color: obj.completed ? '#333' : '#666',
                    textDecoration: obj.completed ? 'line-through' : 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {obj.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Next action ── */}
        <div style={{ marginTop: 'auto' }}>
          {nextIncomplete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <ArrowRight size={11} color={ac} style={{ flexShrink: 0, opacity: 0.7 }} />
              <span style={{
                fontSize: 11,
                color: '#555',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {nextIncomplete.title}
              </span>
            </div>
          ) : (
            project.estimated_completion_date && (
              <span style={{ fontSize: 10, color: '#444' }}>
                Due {new Date(project.estimated_completion_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )
          )}

          {/* Delete confirm inline */}
          {confirm && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }} onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => onDelete()} style={{ fontSize: 10, padding: '2px 8px', background: '#f87171', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>Del</button>
              <button type="button" onClick={() => setConfirm(false)} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(255,255,255,0.07)', color: '#666', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer' }}>✕</button>
            </div>
          )}
          {!confirm && (
            <button type="button" onClick={e => { e.stopPropagation(); setConfirm(true) }}
              style={{ background: 'none', border: 'none', color: '#222', cursor: 'pointer', padding: '2px 0 0', lineHeight: 1, display: 'block', marginTop: 6 }}>
              <Trash size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Animated stat cards grid ─────────────────────────────────────────────────

function StatCardsGrid({ stats, activeStatFilter, onFilterChange }: {
  stats: { total: number; active: number; planning: number; completed: number }
  activeStatFilter: ProjectStatus | null
  onFilterChange: (fn: (f: ProjectStatus | null) => ProjectStatus | null) => void
}) {
  const totalVal     = useCountUp(stats.total)
  const activeVal    = useCountUp(stats.active)
  const planningVal  = useCountUp(stats.planning)
  const completedVal = useCountUp(stats.completed)

  const cards = [
    { label: 'Total',     value: totalVal,     accent: '#a855f7', status: null        as ProjectStatus | null },
    { label: 'Active',    value: activeVal,    accent: '#4ade80', status: 'active'    as ProjectStatus | null },
    { label: 'Planning',  value: planningVal,  accent: '#f97316', status: 'planning'  as ProjectStatus | null },
    { label: 'Completed', value: completedVal, accent: '#3b82f6', status: 'completed' as ProjectStatus | null },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 28 }}>
      {cards.map(card => {
        const isActive = activeStatFilter === card.status
        return (
          <button
            key={card.label}
            type="button"
            onClick={() => onFilterChange(f => f === card.status ? null : card.status)}
            style={{
              background: isActive ? `${card.accent}14` : '#111',
              borderRadius: 16, padding: '20px 24px',
              border: isActive ? `1px solid ${card.accent}55` : '1px solid rgba(255,255,255,0.07)',
              borderLeft: `3px solid ${card.accent}`,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: card.accent, lineHeight: 1 }}>
              {card.value}
            </span>
            <span style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {card.label}
            </span>
          </button>
        )
      })}
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

// ─── Rollup badge ─────────────────────────────────────────────────────────────

function RollupBadge({ rollup, padding = '0 20px 12px', marginTop = -8 }: {
  rollup: ProjectRollup | undefined
  padding?: string
  marginTop?: number
}) {
  if (!rollup) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding, marginTop }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: rollup.health === 'red' ? '#f87171' : rollup.health === 'amber' ? '#fb923c' : '#4ade80' }} />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{Math.round(rollup.completion * 100)}%</span>
      {rollup.openIssues > 0 && <span style={{ fontSize: 11, color: '#fb923c' }}>{rollup.openIssues} open</span>}
      {rollup.subProjectCount > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{rollup.subProjectCount} sub</span>}
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

  // View/sort/archive controls
  const [view, setView] = useState<ViewMode>('grid')
  const [sort, setSort] = useState<SortKey>('activity')
  const [showArchived, setShowArchived] = useState(false)

  // Batch objectives for card snippets — keyed by project_id
  const [cardObjectives, setCardObjectives] = useState<Record<string, TileObjective[]>>({})

  // Rollups
  const loadRollups = useRollupStore(s => s.loadRollups)
  const rollups = useRollupStore(s => s.rollups)
  useEffect(() => {
    if (projects.length) void loadRollups(projects.map(p => ({ id: p.id, estimated_completion_date: p.estimated_completion_date })))
  }, [projects, loadRollups])

  // Load objective snippets for all projects in a single query
  useEffect(() => {
    if (!projects.length) return
    const ids = projects.map(p => p.id)
    void supabase
      .from('objectives')
      .select('id, project_id, title, completed, position')
      .in('project_id', ids)
      .is('sub_project_id', null)
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const grouped: Record<string, TileObjective[]> = {}
        for (const row of data) {
          if (!grouped[row.project_id]) grouped[row.project_id] = []
          if (grouped[row.project_id].length < 3) {
            grouped[row.project_id].push({ id: row.id, title: row.title, completed: row.completed })
          }
        }
        setCardObjectives(grouped)
      })
  }, [projects])

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

  // Pin-first + archive filter + sort on top of the existing filter pipeline
  const visible = useMemo(() =>
    displayed
      .filter(p => showArchived ? true : !p.archived_at)
      .sort((a, b) => {
        if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1
        switch (sort) {
          case 'name':     return a.name.localeCompare(b.name)
          case 'due':      return (a.estimated_completion_date ?? '9999').localeCompare(b.estimated_completion_date ?? '9999')
          case 'progress': return (rollups[b.id]?.completion ?? 0) - (rollups[a.id]?.completion ?? 0)
          case 'status':   return (a.status ?? '').localeCompare(b.status ?? '')
          case 'activity':
          default:         return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
        }
      }),
    [displayed, showArchived, sort, rollups])

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 12, color: '#555', margin: '0 0 4px', fontFamily: 'var(--font-sans)' }}>{dateStr}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#fff', margin: '4px 0 0', lineHeight: 1.1 }}>
              {greeting}, Corey
            </h1>
          </div>
          {/* Search pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 999, width: 220,
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
          }}
            onClick={() => !searchOpen && setSearchOpen(true)}
          >
            <MagnifyingGlass size={14} color={searchOpen ? '#888' : '#555'} style={{ flexShrink: 0 }} />
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
              <span style={{ fontSize: 13, color: '#444' }}>Search…</span>
            )}
            {search && <X size={13} color="#555" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={e => { e.stopPropagation(); setSearch('') }} />}
          </div>
        </div>

        {/* ── Elevated stat cards grid ── */}
        <StatCardsGrid stats={stats} activeStatFilter={activeStatFilter} onFilterChange={setActiveStatFilter} />

        {/* ── Recent activity (dashboard, default view only) ── */}
        {navFilter === 'all' && !search && !activeStatFilter && (
          <RecentActivity projects={projects} onOpen={onOpen} />
        )}

        {/* ── Section header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#fff', margin: 0 }}>
            {search ? `Search: "${search}"` : sectionLabel}
          </h2>
          {visible.length > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              padding: '5px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.04)', color: '#444',
              border: EDGE,
            }}>
              {visible.length} project{visible.length !== 1 ? 's' : ''} <CaretRight size={11} />
            </span>
          )}
        </div>

        {/* ── Classification sub-tabs ── */}
        {byStat.length > 0 && (
          <ClassificationTabs counts={classCounts} active={classTab} onSelect={setClassTab} />
        )}

        {/* ── View / sort / archive controls ── */}
        <ProjectControls
          view={view} onView={setView}
          sort={sort} onSort={setSort}
          showArchived={showArchived} onToggleArchived={setShowArchived}
        />

        {/* ── Project list ── */}
        {loading && visible.length === 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 14, alignItems: 'start',
          }}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '35vh', gap: 14 }}>
            {search ? (
              <>
                <p style={{ color: '#333', fontSize: 14, margin: 0 }}>No projects match "{search}"</p>
                <button type="button" onClick={() => setSearch('')} style={{ fontSize: 12, color: '#555', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '6px 16px', cursor: 'pointer' }}>
                  Clear search
                </button>
              </>
            ) : displayed.length > 0 && !showArchived ? (
              <>
                <p style={{ color: '#333', fontSize: 14, margin: 0 }}>All matching projects are archived.</p>
                <button type="button" onClick={() => setShowArchived(true)} style={{ fontSize: 12, color: '#555', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '6px 16px', cursor: 'pointer' }}>
                  Show archived
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
        ) : view === 'list' ? (
          /* ── List view: dense single column ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visible.map(p => {
              const ac = getClassAccent(p.classification)
              const rollup = rollups[p.id]
              return (
                <div
                  key={p.id}
                  onClick={() => onOpen(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 16px', borderRadius: '0.875rem',
                    background: BG, border: EDGE, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ width: 3, height: 32, borderRadius: 999, background: ac, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {p.is_pinned && <span style={{ fontSize: 10, color: '#f59e0b' }}>📌</span>}
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {rollup && (
                        <>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: rollup.health === 'red' ? '#f87171' : rollup.health === 'amber' ? '#fb923c' : '#4ade80', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{Math.round(rollup.completion * 100)}%</span>
                          {rollup.openIssues > 0 && <span style={{ fontSize: 11, color: '#fb923c', flexShrink: 0 }}>{rollup.openIssues} open</span>}
                          {rollup.subProjectCount > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{rollup.subProjectCount} sub</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: '#333', flexShrink: 0 }}>{STATUS_LABEL[(p.status ?? 'planning') as ProjectStatus]}</span>
                  <div onClick={e => e.stopPropagation()}>
                    <ProjectCardActions project={p} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : view === 'board' ? (
          /* ── Board view: columns grouped by status ── */
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
            {(['planning', 'active', 'paused', 'completed', 'cancelled'] as ProjectStatus[])
              .map(status => {
                const col = visible.filter(p => (p.status ?? 'planning') === status)
                if (col.length === 0) return null
                return (
                  <div key={status} style={{ minWidth: 260, flex: '0 0 260px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                      {STATUS_LABEL[status]} <span style={{ color: '#333' }}>{col.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {col.map(p => {
                        const rollup = rollups[p.id]
                        return (
                          <div key={p.id} style={{ position: 'relative' }}>
                            <ProjectTile project={p} onOpen={() => onOpen(p)} onDelete={() => deleteProject(p.id)} rollup={rollup} objectives={cardObjectives[p.id]} />
                            <RollupBadge rollup={rollup} padding="0 20px 10px" marginTop={-6} />
                            <div style={{ position: 'absolute', top: 10, right: 10 }} onClick={e => e.stopPropagation()}>
                              <ProjectCardActions project={p} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          /* ── Grid view (default) ── */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 14, alignItems: 'start',
          }}>
            {visible.map((p, idx) => {
              const rollup = rollups[p.id]
              return (
                <div key={p.id} style={{ position: 'relative' }}>
                  <ProjectTile project={p} onOpen={() => onOpen(p)} onDelete={() => deleteProject(p.id)} rollup={rollup} objectives={cardObjectives[p.id]} index={idx} />
                  <div style={{ position: 'absolute', top: 12, right: 12 }} onClick={e => e.stopPropagation()}>
                    <ProjectCardActions project={p} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      {showNew && <NewProjectModal onSave={handleCreate} onCancel={() => setShowNew(false)} />}
      <FAB onClick={() => !creating && setShowNew(true)} />
    </div>
  )
}
