import { useCardStore } from '@/store/cardStore'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'

export function StatusBar() {
  const { cards } = useCardStore()
  const { activeProject } = useProjectStore()
  const { isOnline } = useUIStore()

  const backlogCount = cards.filter(c => c.column === 'backlog').length
  const inProgressCount = cards.filter(c => c.column === 'in_progress').length
  const doneCount = cards.filter(c => c.column === 'done').length

  return (
    <div
      style={{
        height: '32px',
        borderTop: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
          {activeProject?.name ?? 'No Project'}
        </span>
        <span style={{ display: 'flex', gap: '10px' }}>
          <span>
            Backlog{' '}
            <span style={{ color: 'var(--color-text-muted)' }}>{backlogCount}</span>
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span>
            In Progress{' '}
            <span style={{ color: 'var(--color-accent)' }}>{inProgressCount}</span>
          </span>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span>
            Done{' '}
            <span style={{ color: 'var(--color-success)' }}>{doneCount}</span>
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-danger)',
            flexShrink: 0,
          }}
          title={isOnline ? 'Online' : 'Offline'}
        />
        <span>{isOnline ? 'Connected' : 'Offline'}</span>
        {isOnline && (
          <>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span>Supabase sync active</span>
          </>
        )}
      </div>
    </div>
  )
}
