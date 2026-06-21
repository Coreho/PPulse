import { useEffect, useRef, useState } from 'react'
import {
  House, Lightning, CheckCircle, Lightbulb, Plus, ListChecks, X,
} from '@phosphor-icons/react'
import { flushQueue } from '@/db/idb'
import { supabase } from '@/db/supabase'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { useTodoStore } from '@/store/todoStore'
import { ToastProvider } from '@/ui/Toast'
import { ProjectList } from '@/projects/ProjectList'
import { ProjectDetail } from '@/projects/ProjectDetail'
import { TodoPanel } from '@/projects/TodoPanel'
import { ProjectWizard } from '@/projects/ProjectWizard'
import type { Database, NavFilter } from '@/db/types'

type Project = Database['public']['Tables']['projects']['Row']

const NAV_ITEMS: { id: NavFilter; icon: React.ElementType; label: string; glow: string }[] = [
  { id: 'all',       icon: House,        label: 'Home',      glow: '#facc15' },
  { id: 'active',    icon: Lightning,    label: 'Active',    glow: '#4ade80' },
  { id: 'completed', icon: CheckCircle,  label: 'Done',      glow: '#60a5fa' },
  { id: 'notes',     icon: Lightbulb,    label: 'Notes',     glow: '#f472b6' },
]

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

// ── Desktop sidebar nav icon ──────────────────────────────────────────────────

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

// ── Mobile bottom tab bar ─────────────────────────────────────────────────────

function BottomTabBar({
  navFilter, onNav, todoCount, onTodo, activePage,
}: {
  navFilter: NavFilter
  onNav: (f: NavFilter) => void
  todoCount: number
  onTodo: () => void
  activePage: 'projects' | 'todo'
}) {
  const tabs = [
    ...NAV_ITEMS.map(n => ({ id: n.id as string, icon: n.icon, label: n.label, glow: n.glow })),
    { id: 'todos', icon: ListChecks, label: 'To-Do', glow: '#f59e0b' },
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'rgba(10,10,10,0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === 'todos'
          ? activePage === 'todo'
          : navFilter === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => tab.id === 'todos' ? onTodo() : onNav(tab.id as NavFilter)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '10px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? tab.glow : '#3a3a3a',
              position: 'relative',
            }}
          >
            <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              {tab.label}
            </span>
            {tab.id === 'todos' && todoCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '50%',
                transform: 'translateX(10px)',
                fontSize: 9, fontWeight: 700,
                background: tab.glow, color: '#000',
                borderRadius: 999, padding: '1px 5px', lineHeight: 1.4,
              }}>
                {todoCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ── Todo bottom sheet (mobile) ────────────────────────────────────────────────

function TodoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 299,
            background: 'rgba(0,0,0,0.6)',
            animation: 'fadeIn 0.2s ease both',
          }}
        />
      )}
      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 300,
        background: '#0c0c0c',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px 20px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        maxHeight: '85dvh',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '12px auto 0', flexShrink: 0,
        }} />
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 16,
            background: 'rgba(255,255,255,0.07)',
            border: 'none', borderRadius: '50%',
            width: 28, height: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#888',
          }}
        >
          <X size={14} />
        </button>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TodoPanel />
        </div>
      </div>
    </>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [navFilter, setNavFilter] = useState<NavFilter>('all')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [todoSheetOpen, setTodoSheetOpen] = useState(false)
  const { activeProject, loadProjects, setActiveProject } = useProjectStore()
  const { isOnline, setOnline } = useUIStore()
  const todos = useTodoStore(s => s.todos)
  const prevProjectRef = useRef<boolean>(false)
  const isMobile = useIsMobile()

  const openTodoCount = todos.filter(t => !t.completed).length

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

  const handleOpen = (project: Project) => {
    prevProjectRef.current = false
    setActiveProject(project)
  }
  const handleBack = () => {
    prevProjectRef.current = true
    setActiveProject(null)
  }

  const contentAnim: React.CSSProperties = prevProjectRef.current
    ? { animation: 'slideInLeft 0.3s ease both' }
    : { animation: 'slideInRight 0.3s ease both' }

  // ── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <ToastProvider>
        <div style={{
          display: 'flex', flexDirection: 'column',
          height: '100dvh', width: '100vw',
          overflow: 'hidden', background: '#000',
          animation: 'fadeIn 0.4s ease both',
        }}>
          {/* Main content — full width, padded bottom for tab bar */}
          <div
            key={activeProject?.id ?? 'list'}
            style={{
              flex: 1, minHeight: 0, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              paddingBottom: 60, // space for bottom tab bar
              ...contentAnim,
            }}
          >
            {activeProject ? (
              <ProjectDetail project={activeProject} onBack={handleBack} />
            ) : (
              <ProjectList onOpen={handleOpen} filter={navFilter} />
            )}
          </div>

          {/* Bottom tab bar — hidden inside project detail */}
          {!activeProject && (
            <BottomTabBar
              navFilter={navFilter}
              onNav={f => { setNavFilter(f); setTodoSheetOpen(false) }}
              todoCount={openTodoCount}
              onTodo={() => setTodoSheetOpen(o => !o)}
              activePage={todoSheetOpen ? 'todo' : 'projects'}
            />
          )}

          {/* Todo slide-up sheet */}
          <TodoSheet open={todoSheetOpen} onClose={() => setTodoSheetOpen(false)} />

          {/* FAB — above tab bar on mobile */}
          {!activeProject && (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              title="New Project"
              style={{
                position: 'fixed', bottom: 72, right: 20,
                width: 50, height: 50, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                boxShadow: '0 4px 20px rgba(59,130,246,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: 'none', zIndex: 100,
              }}
            >
              <Plus size={22} color="#fff" weight="bold" />
            </button>
          )}
        </div>

        <ProjectWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
      </ToastProvider>
    )
  }

  // ── Desktop layout ──────────────────────────────────────────────────────────
  return (
    <ToastProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#000', animation: 'fadeIn 0.4s ease both' }}>

        {/* Side Nav (hidden in project detail) */}
        {!activeProject && (
          <nav style={{
            width: 72, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '24px 0', gap: '10px',
            background: 'rgba(255,255,255,0.025)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}>
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

        {/* Main Content */}
        <div
          key={activeProject?.id ?? 'list'}
          style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...contentAnim }}
        >
          {activeProject ? (
            <ProjectDetail project={activeProject} onBack={handleBack} />
          ) : (
            <ProjectList onOpen={handleOpen} filter={navFilter} />
          )}
        </div>

        {/* TodoPanel (desktop only, hidden in project detail) */}
        {!activeProject && <TodoPanel />}

      </div>

      {/* FAB (desktop) */}
      {!activeProject && (
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          title="New Project"
          style={{
            position: 'fixed', bottom: 28, right: 28,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            boxShadow: '0 4px 24px rgba(59,130,246,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none', zIndex: 100,
          }}
        >
          <Plus size={24} color="#fff" weight="bold" />
        </button>
      )}

      <ProjectWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </ToastProvider>
  )
}
