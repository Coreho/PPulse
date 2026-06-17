import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Notepad,
  Cpu,
  Wrench,
  FolderOpen,
  Terminal,
  Circuitry,
  Circle,
  Timer,
} from '@phosphor-icons/react'
import { flushQueue } from '@/db/idb'
import { supabase } from '@/db/supabase'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { Scratchpad } from '@/scratchpad/Scratchpad'
import { Board } from '@/kanban/Board'
import { StatusBar } from '@/ui/StatusBar'
import { ToastProvider } from '@/ui/Toast'
import { BomPanel } from '@/bom/BomPanel'
import { MachinesPanel } from '@/machines/MachinesPanel'
import { PinoutPanel } from '@/pinout/PinoutPanel'
import { PinoutOverlay } from '@/pinout/PinoutOverlay'
import { SerialMonitorPanel } from '@/hardware/SerialMonitorPanel'
import { FileVaultPanel } from '@/hardware/FileVaultPanel'
import { TimerPanel } from '@/timers/TimerPanel'
import type { Database } from '@/db/types'

type ActivePanel = 'bom' | 'machines' | 'fileVault' | 'serial' | 'pinout' | 'timers' | null
type Project = Database['public']['Tables']['projects']['Row']

// ---- Panel stubs (placeholder content until Agent B builds them) ----

function PanelBOM() {
  return <BomPanel />
}

function PanelMachines() {
  return <MachinesPanel />
}

function PanelFileVault() {
  return <FileVaultPanel />
}

function PanelSerial() {
  return <SerialMonitorPanel />
}

function PanelPinout() {
  return <PinoutPanel />
}

function PanelTimers() {
  return <TimerPanel />
}

const PANEL_COMPONENTS: Record<NonNullable<ActivePanel>, React.ComponentType> = {
  bom: PanelBOM,
  machines: PanelMachines,
  fileVault: PanelFileVault,
  serial: PanelSerial,
  pinout: PanelPinout,
  timers: PanelTimers,
}

const PANEL_TITLES: Record<NonNullable<ActivePanel>, string> = {
  bom: 'Bill of Materials',
  machines: 'Machines',
  fileVault: 'File Vault',
  serial: 'Serial Monitor',
  pinout: 'Pinout Mapper',
  timers: 'Print Timers',
}

// ---- NavButton ----

interface NavButtonProps {
  icon: React.ReactNode
  label: string
  panel: ActivePanel
  active: boolean
  onClick: () => void
}

function NavButton({ icon, label, active, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '0.375rem',
        border: 'none',
        backgroundColor: active ? 'rgba(34,211,238,0.15)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'background-color 0.15s, color 0.15s',
      }}
      className="hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-3)]"
    >
      {icon}
    </button>
  )
}

// ---- Resizable split pane ----

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  initialLeftPercent?: number
}

function SplitPane({ left, right, initialLeftPercent = 40 }: SplitPaneProps) {
  const [leftPercent, setLeftPercent] = useState(initialLeftPercent)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPercent(Math.max(20, Math.min(75, newPercent)))
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Left pane */}
      <div
        style={{
          width: `${leftPercent}%`,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        {left}
      </div>

      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') setLeftPercent(p => Math.max(20, p - 2))
          if (e.key === 'ArrowRight') setLeftPercent(p => Math.min(75, p + 2))
        }}
        style={{
          width: '4px',
          flexShrink: 0,
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          transition: 'background-color 0.15s',
          zIndex: 10,
        }}
        className="hover:bg-[color:var(--color-accent)]"
      />

      {/* Right pane */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {right}
      </div>
    </div>
  )
}

// ---- Pane wrappers ----

function ScratchpadPane({ project }: { project: Project | null }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-surface-0)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <Notepad size={14} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Scratchpad
        </span>
      </div>
      <Scratchpad
        projectId={project?.id ?? ''}
        initialContent={project?.scratchpad_content ?? ''}
      />
    </div>
  )
}

function KanbanPane({ project }: { project: Project | null }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-surface-0)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <Cpu size={14} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Board
        </span>
      </div>
      {project ? (
        <Board projectId={project.id} />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          No project selected
        </div>
      )}
    </div>
  )
}

// ---- Side drawer ----

interface SideDrawerProps {
  panel: NonNullable<ActivePanel>
  onClose: () => void
}

function SideDrawer({ panel, onClose }: SideDrawerProps) {
  const PanelContent = PANEL_COMPONENTS[panel]

  return (
    <div
      style={{
        width: '280px',
        flexShrink: 0,
        borderLeft: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface-1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {PANEL_TITLES[panel]}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: '0.25rem',
          }}
          aria-label={`Close ${PANEL_TITLES[panel]} panel`}
        >
          x
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <PanelContent />
      </div>
    </div>
  )
}

// ---- Root App ----

export default function App() {
  const { projects, activeProject, loadProjects, createProject, setActiveProject } = useProjectStore()
  const { activePanel, setActivePanel, isOnline, setOnline, isPinoutOpen } = useUIStore()

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
          await supabase.from(table as 'projects' | 'cards').upsert(payload as never)
        } else {
          await supabase.from(table as 'projects' | 'cards').delete().eq('id', (payload as { id: string }).id)
        }
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  useEffect(() => {
    loadProjects().then(async () => {
      const state = useProjectStore.getState()
      if (state.projects.length === 0) {
        await createProject('My Project')
      }
    })
  }, [loadProjects, createProject])

  const togglePanel = useCallback(
    (panel: ActivePanel) => setActivePanel(panel),
    [setActivePanel],
  )

  const NAV_ITEMS: { icon: React.ReactNode; label: string; panel: ActivePanel }[] = [
    { icon: <Wrench size={16} />, label: 'Bill of Materials', panel: 'bom' },
    { icon: <Cpu size={16} />, label: 'Machines', panel: 'machines' },
    { icon: <FolderOpen size={16} />, label: 'File Vault', panel: 'fileVault' },
    { icon: <Terminal size={16} />, label: 'Serial Monitor', panel: 'serial' },
    { icon: <Circuitry size={16} />, label: 'Pinout Mapper', panel: 'pinout' },
    { icon: <Timer size={16} />, label: 'Timers', panel: 'timers' },
  ]

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
            padding: '0 12px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-1)',
          }}
        >
          {/* Left: project selector + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--color-accent)',
                letterSpacing: '-0.01em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              PP
            </span>
            <span style={{ color: 'var(--color-border)', fontSize: '14px' }}>/</span>
            {projects.length > 1 ? (
              <select
                value={activeProject?.id ?? ''}
                onChange={e => {
                  const p = projects.find(pr => pr.id === e.target.value)
                  if (p) setActiveProject(p)
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                }}
                aria-label="Active project"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id} style={{ backgroundColor: '#18181b' }}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {activeProject?.name ?? 'Loading...'}
              </span>
            )}
          </div>

          {/* Center: online indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Circle
              size={7}
              weight="fill"
              style={{ color: isOnline ? 'var(--color-success)' : 'var(--color-danger)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {isOnline ? 'online' : 'offline'}
            </span>
          </div>

          {/* Right: nav icon buttons */}
          <nav
            style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
            aria-label="Panel navigation"
          >
            {NAV_ITEMS.map(item => (
              <NavButton
                key={item.panel}
                icon={item.icon}
                label={item.label}
                panel={item.panel}
                active={activePanel === item.panel}
                onClick={() => togglePanel(item.panel)}
              />
            ))}
          </nav>
        </header>

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <SplitPane
            left={<ScratchpadPane project={activeProject} />}
            right={<KanbanPane project={activeProject} />}
          />

          {/* Side drawer */}
          {activePanel && (
            <SideDrawer panel={activePanel} onClose={() => setActivePanel(null)} />
          )}
        </div>

        {/* Bottom status bar */}
        <StatusBar />
      </div>

      {isPinoutOpen && <PinoutOverlay />}
    </ToastProvider>
  )
}
