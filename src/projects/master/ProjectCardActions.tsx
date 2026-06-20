import { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import type { Database } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

export function ProjectCardActions({ project }: { project: Project }) {
  const { togglePin, archiveProject, unarchiveProject, duplicateProject } = useProjectStore()
  const [open, setOpen] = useState(false)
  const archived = !!project.archived_at
  const pinned   = !!project.is_pinned

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.3)', padding: '2px 6px', fontSize: 16, lineHeight: 1,
          borderRadius: 4,
        }}
      >⋯</button>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: 0, zIndex: 10, marginTop: 4,
            width: 160, borderRadius: '0.75rem',
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#151515',
            padding: '4px 0',
            boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
          }}
        >
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => { void togglePin(project.id); setOpen(false) }}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => { void duplicateProject(project.id); setOpen(false) }}
          >
            Duplicate
          </button>
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => { void (archived ? unarchiveProject(project.id) : archiveProject(project.id)); setOpen(false) }}
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '7px 14px', fontSize: 12, fontWeight: 600,
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'rgba(255,255,255,0.75)',
  fontFamily: 'var(--font-sans)',
  transition: 'background 0.1s',
}
