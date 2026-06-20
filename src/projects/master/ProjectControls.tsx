export type ViewMode = 'grid' | 'list' | 'board'
export type SortKey = 'due' | 'progress' | 'activity' | 'status' | 'name'

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'grid', label: 'Grid' },
  { key: 'list', label: 'List' },
  { key: 'board', label: 'Board' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'due', label: 'Due date' },
  { key: 'progress', label: 'Progress' },
  { key: 'activity', label: 'Last activity' },
  { key: 'status', label: 'Status' },
  { key: 'name', label: 'Name' },
]

const EDGE = '1px solid rgba(255,255,255,0.07)'

export function ProjectControls({
  view,
  onView,
  sort,
  onSort,
  showArchived,
  onToggleArchived,
}: {
  view: ViewMode
  onView: (v: ViewMode) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  showArchived: boolean
  onToggleArchived: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      {/* View mode toggle */}
      <div style={{
        display: 'flex', borderRadius: '0.75rem', overflow: 'hidden',
        border: EDGE,
      }}>
        {VIEWS.map(v => (
          <button
            key={v.key}
            type="button"
            onClick={() => onView(v.key)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: 'pointer', border: 'none',
              background: view === v.key ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: view === v.key ? '#fff' : 'rgba(255,255,255,0.3)',
              transition: 'background 0.15s, color 0.15s',
              borderRight: EDGE,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Sort selector */}
      <select
        value={sort}
        onChange={e => onSort(e.target.value as SortKey)}
        style={{
          background: '#111', border: EDGE, borderRadius: '0.75rem',
          padding: '6px 12px', fontSize: 12, fontWeight: 600,
          fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', outline: 'none', appearance: 'none',
          WebkitAppearance: 'none',
        }}
      >
        {SORTS.map(s => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>

      {/* Show archived toggle */}
      <label style={{
        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
        color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
        userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={e => onToggleArchived(e.target.checked)}
          style={{ accentColor: '#7b2ff7', cursor: 'pointer' }}
        />
        Show archived
      </label>
    </div>
  )
}
