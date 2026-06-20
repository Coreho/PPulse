import { useState } from 'react'
import { useSubProjectStore } from '@/store/subProjectStore'
import { MiniBoard } from './MiniBoard'
import { MiniObjectives } from './MiniObjectives'
import type { Database } from '@/db/types'

type SubProject = Database['public']['Tables']['sub_projects']['Row']

interface SubProjectCardProps {
  projectId: string
  subProject: SubProject
  expanded: boolean
  onToggleExpand: () => void
}

export function SubProjectCard({ projectId, subProject, expanded, onToggleExpand }: SubProjectCardProps) {
  const { renameSubProject, deleteSubProject } = useSubProjectStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(subProject.name)

  const commitRename = () => {
    const n = name.trim()
    if (n && n !== subProject.name) void renameSubProject(subProject.id, n)
    setEditing(false)
  }

  return (
    <div style={{
      borderRadius: '0.5rem',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-surface-0)',
    }}>
      {/* Collapsed header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
      }}>
        {/* Expand chevron */}
        <button
          onClick={onToggleExpand}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: '14px',
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label={expanded ? 'Collapse sub-project' : 'Expand sub-project'}
        >
          {expanded ? '▾' : '▸'}
        </button>

        {/* Name / inline rename */}
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setName(subProject.name); setEditing(false) }
            }}
            style={{
              flex: 1,
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              padding: '4px 8px',
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'text',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              padding: 0,
              fontFamily: 'var(--font-sans)',
            }}
            title="Click to rename"
          >
            {subProject.name}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => void deleteSubProject(subProject.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            padding: '2px 4px',
            borderRadius: '4px',
            flexShrink: 0,
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger, #f87171)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)' }}
          aria-label="Delete sub-project"
        >
          Delete
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <MiniObjectives projectId={projectId} subProjectId={subProject.id} />
          <MiniBoard projectId={projectId} subProjectId={subProject.id} />
        </div>
      )}
    </div>
  )
}
