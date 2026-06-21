import { useEffect, useState } from 'react'
import { useSubProjectStore } from '@/store/subProjectStore'
import { SubProjectCard } from './SubProjectCard'

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-0)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.375rem',
  padding: '7px 10px',
  fontSize: '13px',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  flex: 1,
}

export function SubProjectsSection({ projectId }: { projectId: string }) {
  const { subProjects, loadSubProjects, addSubProject } = useSubProjectStore()
  const [name, setName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    void loadSubProjects(projectId)
  }, [projectId, loadSubProjects])

  const scoped = subProjects.filter(sp => sp.project_id === projectId)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    void addSubProject(projectId, n)
    setName('')
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: 0,
        }}>
          Sub-Projects ({scoped.length})
        </h3>
      </div>

      {scoped.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {scoped.map(sp => (
            <SubProjectCard
              key={sp.id}
              projectId={projectId}
              subProject={sp}
              expanded={expandedId === sp.id}
              onToggleExpand={() => setExpandedId(cur => cur === sp.id ? null : sp.id)}
            />
          ))}
        </div>
      )}

      <form onSubmit={add} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New sub-project name…"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={!name.trim()}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#09090b',
            backgroundColor: name.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Add
        </button>
      </form>
    </section>
  )
}
