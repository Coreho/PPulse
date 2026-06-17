import { useEffect } from 'react'
import { Circle } from '@phosphor-icons/react'
import { flushQueue } from '@/db/idb'
import { supabase } from '@/db/supabase'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { StatusBar } from '@/ui/StatusBar'
import { ToastProvider } from '@/ui/Toast'
import { ProjectList } from '@/projects/ProjectList'
import { ProjectDetail } from '@/projects/ProjectDetail'
import type { Database } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

export default function App() {
  const { projects, activeProject, loadProjects, setActiveProject } = useProjectStore()
  const { isOnline, setOnline } = useUIStore()

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  useEffect(() => {
    const handleOnline = () => {
      flushQueue(async (table, op, payload) => {
        if (op === 'upsert') {
          await supabase.from(table as 'projects' | 'cards' | 'objectives' | 'issues').upsert(payload as never)
        } else {
          await supabase.from(table as 'projects' | 'cards' | 'objectives' | 'issues').delete().eq('id', (payload as { id: string }).id)
        }
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleOpen = (project: Project) => {
    setActiveProject(project)
  }

  const handleBack = () => {
    setActiveProject(null)
  }

  return (
    <ToastProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          backgroundColor: 'var(--color-surface-0)',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <header
          style={{
            height: '40px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-1)',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-accent)',
              letterSpacing: '-0.01em',
              fontFamily: 'var(--font-mono)',
              cursor: activeProject ? 'pointer' : 'default',
            }}
            onClick={activeProject ? handleBack : undefined}
          >
            PP
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Circle
              size={7}
              weight="fill"
              style={{ color: isOnline ? 'var(--color-success)' : 'var(--color-danger)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {isOnline ? 'online' : 'offline'}
            </span>
            {projects.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </header>

        {/* Main content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeProject ? (
            <ProjectDetail project={activeProject} onBack={handleBack} />
          ) : (
            <ProjectList onOpen={handleOpen} />
          )}
        </div>

        <StatusBar />
      </div>
    </ToastProvider>
  )
}
