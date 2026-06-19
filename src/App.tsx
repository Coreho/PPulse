import { useEffect, useState } from 'react'
import {
  House, Lightning, CheckCircle, Lightbulb,
} from '@phosphor-icons/react'
import { flushQueue } from '@/db/idb'
import { supabase } from '@/db/supabase'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { ToastProvider } from '@/ui/Toast'
import { ProjectList } from '@/projects/ProjectList'
import { ProjectDetail } from '@/projects/ProjectDetail'
import { TodoPanel } from '@/projects/TodoPanel'
import type { Database, NavFilter } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

const NAV_ITEMS: { id: NavFilter; icon: React.ElementType; label: string; glow: string }[] = [
  { id: 'all',       icon: House,        label: 'All Projects', glow: '#facc15' },
  { id: 'active',    icon: Lightning,    label: 'Active',       glow: '#4ade80' },
  { id: 'completed', icon: CheckCircle,  label: 'Completed',    glow: '#60a5fa' },
  { id: 'notes',     icon: Lightbulb,    label: 'Notes',        glow: '#f472b6' },
]

function NavIcon({
  icon: Icon, label, active, glowColor, onClick,
}: {
  icon: React.ElementType; label: string; active: boolean; glowColor: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 48, height: 48, borderRadius: '1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? `${glowColor}1a` : 'transparent',
        boxShadow: active ? `0 0 16px ${glowColor}55` : 'none',
        color: active ? glowColor : '#444',
        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      <Icon size={21} weight={active ? 'fill' : 'regular'} />
    </button>
  )
}

export default function App() {
  const [navFilter, setNavFilter] = useState<NavFilter>('all')
  const { activeProject, loadProjects, setActiveProject } = useProjectStore()
  const { isOnline, setOnline } = useUIStore()

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [setOnline])

  useEffect(() => {
    const handleOnline = () => {
      flushQueue(async (table, op, payload) => {
        if (op === 'upsert') {
          await supabase.from(table as 'projects' | 'cards' | 'objectives' | 'issues' | 'todos').upsert(payload as never)
        } else {
          await supabase.from(table as 'projects' | 'cards' | 'objectives' | 'issues' | 'todos').delete().eq('id', (payload as { id: string }).id)
        }
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleOpen = (project: Project) => setActiveProject(project)
  const handleBack = () => setActiveProject(null)

  return (
    <ToastProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#000' }}>

        {/* ── Side Nav (hidden in project detail) ── */}
        {!activeProject && (
          <nav style={{
            width: 72, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '24px 0', gap: '10px',
            background: 'rgba(255,255,255,0.025)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}>
            {/* Logo mark */}
            <div style={{
              width: 40, height: 40, borderRadius: '0.875rem', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #7b2ff7, #ff0080)',
              boxShadow: '0 0 18px rgba(123,47,247,0.45)',
              marginBottom: 8,
            }}>
              <Lightning size={18} color="#fff" weight="fill" />
            </div>

            {NAV_ITEMS.map(item => (
              <NavIcon
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={navFilter === item.id}
                glowColor={item.glow}
                onClick={() => setNavFilter(item.id)}
              />
            ))}

            {/* Online dot */}
            <div style={{ marginTop: 'auto' }}>
              <div
                title={isOnline ? 'Online' : 'Offline'}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isOnline ? '#4ade80' : '#f87171',
                  boxShadow: isOnline ? '0 0 6px #4ade80' : '0 0 6px #f87171',
                }}
              />
            </div>
          </nav>
        )}

        {/* ── Main Content ── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeProject ? (
            <ProjectDetail project={activeProject} onBack={handleBack} />
          ) : (
            <ProjectList onOpen={handleOpen} filter={navFilter} />
          )}
        </div>

        {/* ── To-Do List (hidden in project detail) ── */}
        {!activeProject && <TodoPanel />}

      </div>
    </ToastProvider>
  )
}
