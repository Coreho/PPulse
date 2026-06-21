import { useEffect, useState } from 'react'
import { Check, Trash, Plus } from '@phosphor-icons/react'
import { useObjectivesStore } from '@/store/objectivesStore'

export function MiniObjectives({ projectId, subProjectId }: { projectId: string; subProjectId: string }) {
  const { objectives, loadObjectives, addObjective, toggleObjective, deleteObjective } = useObjectivesStore()
  const [title, setTitle] = useState('')

  useEffect(() => {
    void loadObjectives(projectId, subProjectId)
  }, [projectId, subProjectId, loadObjectives])

  const scoped = objectives.filter(o => o.sub_project_id === subProjectId)
  const done = scoped.filter(o => o.completed).length
  const pct = scoped.length ? Math.round((done / scoped.length) * 100) : 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    void addObjective(projectId, t, subProjectId)
    setTitle('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          Objectives
        </span>
        <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--color-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct === 100 ? 'var(--color-success)' : 'var(--color-accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {done}/{scoped.length}
        </span>
      </div>

      {/* Objective list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {scoped.map(o => (
          <div
            key={o.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 8px',
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '0.375rem',
            }}
          >
            <button
              type="button"
              onClick={() => toggleObjective(o.id)}
              style={{
                flexShrink: 0, width: '16px', height: '16px',
                borderRadius: '0.25rem',
                border: `2px solid ${o.completed ? 'var(--color-success)' : 'var(--color-border)'}`,
                backgroundColor: o.completed ? 'var(--color-success)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={o.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              {o.completed && <Check size={10} weight="bold" style={{ color: '#09090b' }} />}
            </button>

            <span
              style={{
                flex: 1, fontSize: '12px',
                color: o.completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                textDecoration: o.completed ? 'line-through' : 'none',
              }}
            >
              {o.title}
            </span>

            <button
              type="button"
              onClick={() => deleteObjective(o.id)}
              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px', opacity: 0.5 }}
              aria-label="Delete objective"
            >
              <Trash size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={submit} style={{ display: 'flex', gap: '6px' }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Add objective…"
          style={{
            flex: 1,
            backgroundColor: 'var(--color-surface-0)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.375rem',
            padding: '5px 8px',
            fontSize: '12px',
            color: 'var(--color-text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <button
          type="submit"
          disabled={!title.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '5px 10px', fontSize: '11px', fontWeight: 600,
            color: '#09090b',
            backgroundColor: title.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
            border: 'none', borderRadius: '0.375rem',
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          <Plus size={11} weight="bold" /> Add
        </button>
      </form>
    </div>
  )
}
