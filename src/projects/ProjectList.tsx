import { useState } from 'react'
import { Plus, FolderOpen, Trash, ArrowRight, Calendar, Tag } from '@phosphor-icons/react'
import { useProjectStore } from '@/store/projectStore'
import type { Database, ProjectClassification, ProjectStatus } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

const CLASS_COLORS: Record<ProjectClassification, string> = {
  software: 'rgba(139,92,246,0.15)',
  hardware: 'rgba(34,211,238,0.15)',
  mixed: 'rgba(251,191,36,0.15)',
  research: 'rgba(74,222,128,0.15)',
  other: 'rgba(161,161,170,0.15)',
}
const CLASS_TEXT: Record<ProjectClassification, string> = {
  software: '#a78bfa',
  hardware: '#22d3ee',
  mixed: '#fbbf24',
  research: '#4ade80',
  other: '#a1a1aa',
}
const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: '#a1a1aa',
  active: '#4ade80',
  paused: '#fbbf24',
  completed: '#22d3ee',
  cancelled: '#f87171',
}

function classLabel(c: ProjectClassification | null) {
  if (!c) return null
  return c.charAt(0).toUpperCase() + c.slice(1)
}

function statusLabel(s: ProjectStatus) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── New project form ─────────────────────────────────────────────────────────

interface NewProjectFormProps {
  onSave: (name: string) => void
  onCancel: () => void
}

function NewProjectForm({ onSave, onCancel }: NewProjectFormProps) {
  const [name, setName] = useState('')

  return (
    <div
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>New Project</span>
      <input
        autoFocus
        placeholder="Project name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }}
        style={{
          backgroundColor: 'var(--color-surface-0)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.375rem',
          padding: '8px 12px',
          fontSize: '13px',
          color: 'var(--color-text-primary)',
          outline: 'none',
          fontFamily: 'var(--font-sans)',
        }}
      />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 14px', fontSize: '12px',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: '0.375rem', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => name.trim() && onSave(name.trim())}
          style={{
            padding: '6px 14px', fontSize: '12px', fontWeight: 600,
            color: '#09090b',
            backgroundColor: name.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Create
        </button>
      </div>
    </div>
  )
}

// ── Project card ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project
  onOpen: () => void
  onDelete: () => void
}

function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onClick={onOpen}
      className="hover:border-[color:var(--color-accent)]"
    >
      {/* Top: name + delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3, flex: 1 }}>
          {project.name}
        </span>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onDelete()}
              style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: '0.25rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px', opacity: 0.5, flexShrink: 0 }}
            aria-label="Delete project"
          >
            <Trash size={13} />
          </button>
        )}
      </div>

      {/* Badges: classification + status */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {project.classification && (
          <span
            style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 7px',
              borderRadius: '0.25rem',
              backgroundColor: CLASS_COLORS[project.classification],
              color: CLASS_TEXT[project.classification],
            }}
          >
            <Tag size={9} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
            {classLabel(project.classification)}
          </span>
        )}
        <span
          style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '0.25rem',
            backgroundColor: 'rgba(0,0,0,0.2)',
            color: STATUS_COLORS[project.status ?? 'planning'],
          }}
        >
          {statusLabel(project.status ?? 'planning')}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {project.description}
        </p>
      )}

      {/* Est. completion date */}
      {project.estimated_completion_date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Calendar size={11} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Est. {formatDate(project.estimated_completion_date)}
          </span>
        </div>
      )}

      {/* Footer: date + open button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
          {formatDate(project.created_at)}
        </span>
        <button
          type="button"
          onClick={onOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', fontSize: '11px', fontWeight: 600,
            color: 'var(--color-accent)',
            backgroundColor: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.3)',
            borderRadius: '0.375rem', cursor: 'pointer',
          }}
        >
          Open
          <ArrowRight size={11} weight="bold" />
        </button>
      </div>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

interface ProjectListProps {
  onOpen: (project: Database['public']['Tables']['projects']['Row']) => void
}

export function ProjectList({ onOpen }: ProjectListProps) {
  const { projects, createProject, deleteProject, loading } = useProjectStore()
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleCreate = async (name: string) => {
    setCreating(true)
    try {
      const project = await createProject(name)
      setShowNew(false)
      onOpen(project)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-surface-0)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FolderOpen size={16} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Projects</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{projects.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          disabled={creating}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', fontSize: '12px', fontWeight: 600,
            color: '#09090b',
            backgroundColor: 'var(--color-accent)',
            border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
          }}
        >
          <Plus size={13} weight="bold" />
          New Project
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {showNew && (
          <div style={{ marginBottom: '16px' }}>
            <NewProjectForm onSave={handleCreate} onCancel={() => setShowNew(false)} />
          </div>
        )}

        {loading && projects.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '40px' }}>Loading…</p>
        )}

        {!loading && projects.length === 0 && !showNew && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
            <FolderOpen size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No projects yet</span>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              style={{
                padding: '7px 16px', fontSize: '12px', fontWeight: 600,
                color: '#09090b', backgroundColor: 'var(--color-accent)',
                border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
              }}
            >
              Create your first project
            </button>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '14px',
          }}
        >
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpen(p)}
              onDelete={() => deleteProject(p.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
