import { useProjectStore } from '@/store/projectStore'
import { useRollupStore } from '@/store/rollupStore'

// ─── Constants ──────────────────────────────────────────────────────────────

const BG   = '#111111'
const EDGE = '1px solid rgba(255,255,255,0.07)'

// ─── Helpers ────────────────────────────────────────────────────────────────

function dueWithinDays(date: string | null, days: number): boolean {
  if (!date) return false
  const diff = new Date(date).getTime() - Date.now()
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

function isOverdue(date: string | null): boolean {
  if (!date) return false
  return new Date(date).getTime() < Date.now()
}

// ─── Stat subcomponent ───────────────────────────────────────────────────────

function Stat({ label, value, color = 'rgba(255,255,255,0.85)' }: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
        {label}
      </span>
    </div>
  )
}

// ─── StatsHeader ─────────────────────────────────────────────────────────────

export function StatsHeader() {
  const projects = useProjectStore(s => s.projects).filter(p => !p.archived_at)
  const rollups  = useRollupStore(s => s.rollups)

  const total       = projects.length
  const completions = projects.map(p => rollups[p.id]?.completion ?? 0)
  const overall     = total
    ? Math.round((completions.reduce((a, b) => a + b, 0) / total) * 100)
    : 0
  const overdue     = projects.filter(p => isOverdue(p.estimated_completion_date)).length
  const openIssues  = projects.reduce((acc, p) => acc + (rollups[p.id]?.openIssues ?? 0), 0)
  const dueThisWeek = projects.filter(p => dueWithinDays(p.estimated_completion_date, 7)).length

  return (
    <div style={{
      display: 'flex',
      gap: 32,
      borderRadius: '1rem',
      padding: '14px 24px',
      background: BG,
      border: EDGE,
      marginBottom: 24,
      flexWrap: 'wrap',
    }}>
      <Stat label="Projects"        value={total} />
      <Stat label="Overall complete" value={`${overall}%`} />
      <Stat label="Overdue"         value={overdue}     color={overdue     > 0 ? '#f87171' : 'rgba(255,255,255,0.85)'} />
      <Stat label="Open issues"     value={openIssues}  color={openIssues  > 0 ? '#fb923c' : 'rgba(255,255,255,0.85)'} />
      <Stat label="Due this week"   value={dueThisWeek} color={dueThisWeek > 0 ? '#facc15' : 'rgba(255,255,255,0.85)'} />
    </div>
  )
}
