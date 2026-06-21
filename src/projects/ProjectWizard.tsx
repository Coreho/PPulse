/**
 * ProjectWizard — 8-step project creation modal.
 * Steps: 1 (reset) → 2 (identity) → 3 (hierarchy) → 4 (status)
 *      → 5 (objectives) → 6 (metadata) → 7 (review) → 8 (creating)
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash,
  CaretDown,
  CaretUp,
  Check,
  SpinnerGap,
} from '@phosphor-icons/react'
import { useProjectStore } from '@/store/projectStore'
import { useObjectivesStore } from '@/store/objectivesStore'
import { useCardStore } from '@/store/cardStore'
import { CLASS_META, getClassAccent } from '@/projects/ProjectList'
import type { ProjectClassification, ProjectStatus } from '@/db/types'

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------
const STATUS_META: Record<
  Exclude<ProjectStatus, 'cancelled'>,
  { label: string; color: string }
> = {
  planning:  { label: 'Planning',  color: '#3b82f6' },
  active:    { label: 'Active',    color: '#4ade80' },
  paused:    { label: 'Paused',    color: '#f97316' },
  completed: { label: 'Completed', color: '#a855f7' },
}

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------
type Priority = 'low' | 'medium' | 'high'

interface TaskRow {
  id: string
  title: string
  dueDate: string
  priority: Priority
}

interface ObjectiveRow {
  id: string
  title: string
  tasks: TaskRow[]
  tasksOpen: boolean
}

interface WizardState {
  // Step 2
  classification: ProjectClassification | null
  name: string
  nameTouched: boolean
  // Step 3
  hierarchy: 'new' | 'sub'
  parentProjectId: string | null
  parentSearch: string
  // Step 4
  status: ProjectStatus
  // Step 5
  objectives: ObjectiveRow[]
  // Step 6
  startDate: string
  endDate: string
  isPublic: boolean
  // Step 8
  submitting: boolean
  submitError: string | null
}

const DEFAULT_STATE: WizardState = {
  classification: null,
  name: '',
  nameTouched: false,
  hierarchy: 'new',
  parentProjectId: null,
  parentSearch: '',
  status: 'planning',
  objectives: [],
  startDate: '',
  endDate: '',
  isPublic: false,
  submitting: false,
  submitError: null,
}

function makeObjective(): ObjectiveRow {
  return { id: crypto.randomUUID(), title: '', tasks: [], tasksOpen: false }
}

function makeTask(): TaskRow {
  return { id: crypto.randomUUID(), title: '', dueDate: '', priority: 'medium' }
}

// ---------------------------------------------------------------------------
// Shared input style
// ---------------------------------------------------------------------------
const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#fff',
  width: '100%',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-sans)',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProjectWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { projects, createProject, setActiveProject } = useProjectStore()
  const { addObjective } = useObjectivesStore()

  const [step, setStep] = useState(2)
  const [state, setState] = useState<WizardState>(DEFAULT_STATE)
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [nameTaken, setNameTaken] = useState(false)

  // Reset every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(2)
      setState(DEFAULT_STATE)
      setNameTaken(false)
    }
  }, [isOpen])

  // Debounced name uniqueness check
  useEffect(() => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
    nameDebounceRef.current = setTimeout(() => {
      const trimmed = state.name.trim().toLowerCase()
      const taken =
        trimmed !== '' &&
        projects.some(p => p.name.trim().toLowerCase() === trimmed)
      setNameTaken(taken)
    }, 300)
    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
    }
  }, [state.name, projects])

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  if (!isOpen) return null

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  const canContinue = (): boolean => {
    switch (step) {
      case 2:
        return state.classification !== null && state.name.trim().length > 0 && !nameTaken
      case 3:
        return state.hierarchy === 'new' || state.parentProjectId !== null
      case 4:
      case 5:
      case 6:
        return true
      case 7:
        return reviewError() === null
      default:
        return true
    }
  }

  const reviewError = (): string | null => {
    if (!state.name.trim()) return 'Project name is required.'
    if (state.startDate && state.endDate && state.startDate > state.endDate)
      return 'Start date must be on or before end date.'
    return null
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    if (reviewError()) return
    setStep(8)
    setState(prev => ({ ...prev, submitting: true, submitError: null }))
    try {
      const newProject = await createProject(
        state.name.trim(),
        state.classification,
        state.status,
      )
      for (const obj of state.objectives) {
        if (obj.title.trim()) {
          await addObjective(newProject.id, obj.title.trim())
        }
      }
      const { addCard } = useCardStore.getState()
      for (let i = 0; i < state.objectives.length; i++) {
        const obj = state.objectives[i]
        if (!obj.title.trim()) continue
        await addCard({
          project_id: newProject.id,
          sub_project_id: null,
          type: 'software',
          title: obj.title.trim(),
          description: null,
          column: 'backlog',
          position: i,
          scratchpad_tag: null,
          meta: null,
          blocked_by: [],
          bom_item_id: null,
          machine_id: null,
          target_timestamp: null,
          status_flags: [],
          machine_session_start: null,
        })
      }
      setActiveProject(newProject)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'An unexpected error occurred.'
      setState(prev => ({ ...prev, submitting: false, submitError: msg }))
      setStep(7)
    }
  }

  // ---------------------------------------------------------------------------
  // Progress bar — steps 2–7 map to positions 1–6
  // ---------------------------------------------------------------------------
  const TOTAL_VISIBLE = 6
  const visiblePos = Math.min(Math.max(step - 1, 1), TOTAL_VISIBLE)

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  const renderStep2 = () => {
    const classKeys = Object.keys(CLASS_META) as ProjectClassification[]
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontFamily: 'var(--font-display)', color: '#fff' }}>
          Project Identity
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: '#888' }}>
          Choose a classification and give your project a name.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          {classKeys.map(key => {
            const meta = CLASS_META[key]
            const Icon = meta.Icon
            const selected = state.classification === key
            return (
              <button
                key={key}
                onClick={() => update('classification', key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 10px',
                  borderRadius: 12,
                  border: selected
                    ? `2px solid ${meta.accent}`
                    : '2px solid rgba(255,255,255,0.08)',
                  background: selected ? `${meta.accent}18` : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  color: selected ? meta.accent : '#888',
                  boxShadow: selected ? `0 0 14px ${meta.accent}55` : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Icon size={22} weight={selected ? 'fill' : 'regular'} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>{meta.label}</span>
              </button>
            )
          })}
        </div>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#888' }}>
          Project Name
        </label>
        <input
          type="text"
          placeholder="e.g. Home Lab Dashboard"
          value={state.name}
          autoFocus
          onChange={e => {
            update('name', e.target.value)
            update('nameTouched', true)
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          onBlur={e => {
            e.currentTarget.style.borderColor =
              state.nameTouched && nameTaken ? '#f87171' : 'rgba(255,255,255,0.1)'
          }}
          style={{
            ...INPUT_STYLE,
            borderColor: state.nameTouched && nameTaken ? '#f87171' : 'rgba(255,255,255,0.1)',
          }}
        />
        {state.nameTouched && nameTaken && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>
            A project with this name already exists.
          </p>
        )}
      </div>
    )
  }

  const renderStep3 = () => {
    const nonArchived = projects.filter(p => !p.archived_at)
    const filtered = nonArchived.filter(p =>
      p.name.toLowerCase().includes(state.parentSearch.toLowerCase()),
    )
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontFamily: 'var(--font-display)', color: '#fff' }}>
          Project Hierarchy
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: '#888' }}>
          Is this standalone or nested under an existing project?
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
          {(['new', 'sub'] as const).map(h => (
            <button
              key={h}
              onClick={() => {
                update('hierarchy', h)
                if (h === 'new') {
                  update('parentProjectId', null)
                  update('status', 'planning')
                }
              }}
              style={{
                flex: 1,
                padding: '20px 16px',
                borderRadius: 14,
                border: state.hierarchy === h
                  ? '2px solid #a855f7'
                  : '2px solid rgba(255,255,255,0.08)',
                background: state.hierarchy === h ? '#a855f718' : 'rgba(255,255,255,0.03)',
                color: state.hierarchy === h ? '#a855f7' : '#888',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                boxShadow: state.hierarchy === h ? '0 0 14px #a855f755' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {h === 'new' ? 'New Project' : 'Sub-project'}
            </button>
          ))}
        </div>

        {state.hierarchy === 'sub' && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#888' }}>
              Parent Project
            </label>
            <input
              type="text"
              placeholder="Search projects…"
              value={state.parentSearch}
              onChange={e => update('parentSearch', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              style={{ ...INPUT_STYLE, marginBottom: 8 }}
            />
            <div
              style={{
                maxHeight: 180,
                overflowY: 'auto',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                background: '#0a0a0a',
              }}
            >
              {filtered.length === 0 ? (
                <p style={{ margin: 0, padding: '12px 14px', fontSize: 13, color: '#444' }}>
                  No projects found.
                </p>
              ) : (
                filtered.map(p => {
                  const selected = state.parentProjectId === p.id
                  const accent = getClassAccent(p.classification)
                  return (
                    <button
                      key={p.id}
                      onClick={() => update('parentProjectId', p.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '10px 14px',
                        background: selected ? 'rgba(168,85,247,0.12)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        color: selected ? '#fff' : '#aaa',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 13,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: accent,
                          flexShrink: 0,
                        }}
                      />
                      {p.name}
                      {selected && (
                        <Check size={14} style={{ marginLeft: 'auto', color: '#a855f7' }} />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderStep4 = () => {
    const isSub = state.hierarchy === 'sub'
    const statusKeys = Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontFamily: 'var(--font-display)', color: '#fff' }}>
          Initial Status
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: '#888' }}>
          {isSub
            ? 'Sub-projects always start in Planning.'
            : 'Where is this project starting out?'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {statusKeys.map(s => {
            const meta = STATUS_META[s]
            const selected = state.status === s
            const disabled = isSub && s !== 'planning'
            return (
              <button
                key={s}
                disabled={disabled}
                onClick={() => { if (!disabled) update('status', s as ProjectStatus) }}
                style={{
                  padding: '16px 14px',
                  borderRadius: 12,
                  border: selected
                    ? `2px solid ${meta.color}`
                    : '2px solid rgba(255,255,255,0.08)',
                  background: selected ? meta.color : 'rgba(255,255,255,0.03)',
                  color: selected ? '#000' : disabled ? '#333' : '#888',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s ease',
                  opacity: disabled ? 0.35 : 1,
                }}
              >
                {meta.label}
              </button>
            )
          })}
        </div>

        {isSub && (
          <p style={{ marginTop: 16, fontSize: 12, color: '#555', textAlign: 'center' }}>
            (inherited from parent — can be changed later)
          </p>
        )}
      </div>
    )
  }

  const renderStep5 = () => {
    const addObj = () =>
      setState(prev => ({ ...prev, objectives: [...prev.objectives, makeObjective()] }))

    const removeObj = (id: string) =>
      setState(prev => ({
        ...prev,
        objectives: prev.objectives.filter(o => o.id !== id),
      }))

    const updateObjTitle = (id: string, title: string) =>
      setState(prev => ({
        ...prev,
        objectives: prev.objectives.map(o => (o.id === id ? { ...o, title } : o)),
      }))

    const toggleTasks = (id: string) =>
      setState(prev => ({
        ...prev,
        objectives: prev.objectives.map(o =>
          o.id === id ? { ...o, tasksOpen: !o.tasksOpen } : o,
        ),
      }))

    const addTask = (objId: string) =>
      setState(prev => ({
        ...prev,
        objectives: prev.objectives.map(o =>
          o.id === objId ? { ...o, tasks: [...o.tasks, makeTask()] } : o,
        ),
      }))

    const removeTask = (objId: string, taskId: string) =>
      setState(prev => ({
        ...prev,
        objectives: prev.objectives.map(o =>
          o.id === objId
            ? { ...o, tasks: o.tasks.filter(t => t.id !== taskId) }
            : o,
        ),
      }))

    const updateTask = (
      objId: string,
      taskId: string,
      field: keyof Omit<TaskRow, 'id'>,
      value: string,
    ) =>
      setState(prev => ({
        ...prev,
        objectives: prev.objectives.map(o =>
          o.id === objId
            ? { ...o, tasks: o.tasks.map(t => (t.id === taskId ? { ...t, [field]: value } : t)) }
            : o,
        ),
      }))

    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontFamily: 'var(--font-display)', color: '#fff' }}>
          Objectives & Tasks
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>
          Add high-level objectives. Expand each one to add sub-tasks below it.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 300,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {state.objectives.map((obj, idx) => (
            <div
              key={obj.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {/* Objective header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: '#555',
                    width: 18,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <input
                  type="text"
                  placeholder={`Objective ${idx + 1}`}
                  value={obj.title}
                  onChange={e => updateObjTitle(obj.id, e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  style={{ ...INPUT_STYLE, flex: 1, padding: '8px 10px' }}
                />
                <button
                  onClick={() => toggleTasks(obj.id)}
                  title={obj.tasksOpen ? 'Collapse tasks' : 'Expand tasks'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {obj.tasksOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
                </button>
                <button
                  onClick={() => removeObj(obj.id)}
                  title="Remove objective"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash size={14} />
                </button>
              </div>

              {/* Collapsible tasks section */}
              {obj.tasksOpen && (
                <div
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  {obj.tasks.map(task => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginBottom: 6,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Task title"
                        value={task.title}
                        onChange={e => updateTask(obj.id, task.id, 'title', e.target.value)}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                        style={{ ...INPUT_STYLE, flex: 1, padding: '7px 10px', fontSize: 13 }}
                      />
                      <input
                        type="date"
                        value={task.dueDate}
                        onChange={e => updateTask(obj.id, task.id, 'dueDate', e.target.value)}
                        style={{
                          ...INPUT_STYLE,
                          width: 130,
                          flexShrink: 0,
                          padding: '7px 10px',
                          fontSize: 12,
                        }}
                      />
                      <select
                        value={task.priority}
                        onChange={e => updateTask(obj.id, task.id, 'priority', e.target.value)}
                        style={{
                          ...INPUT_STYLE,
                          width: 90,
                          flexShrink: 0,
                          padding: '7px 8px',
                          fontSize: 12,
                        }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <button
                        onClick={() => removeTask(obj.id, task.id)}
                        title="Remove task"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#555',
                          cursor: 'pointer',
                          padding: 4,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addTask(obj.id)}
                    style={{
                      background: 'none',
                      border: '1px dashed rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      color: '#555',
                      cursor: 'pointer',
                      padding: '5px 10px',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <Plus size={11} /> Add task
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addObj}
          style={{
            marginTop: 12,
            width: '100%',
            padding: 11,
            background: 'none',
            border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: 10,
            color: '#666',
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} /> Add Objective
        </button>

        {state.objectives.length === 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#444', textAlign: 'center' }}>
            You can skip this and add objectives later.
          </p>
        )}
      </div>
    )
  }

  const renderStep6 = () => (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 20, fontFamily: 'var(--font-display)', color: '#fff' }}>
        Metadata
      </h2>
      <p style={{ margin: '0 0 22px', fontSize: 13, color: '#888' }}>
        Optional dates and visibility settings.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#888' }}>
            Start Date
          </label>
          <input
            type="date"
            value={state.startDate}
            onChange={e => update('startDate', e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#888' }}>
            End Date
          </label>
          <input
            type="date"
            value={state.endDate}
            onChange={e => update('endDate', e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            style={INPUT_STYLE}
          />
        </div>
      </div>

      <label style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#888' }}>
        Visibility
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        {([false, true] as const).map(pub => (
          <button
            key={String(pub)}
            onClick={() => update('isPublic', pub)}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 12,
              border: state.isPublic === pub
                ? '2px solid #3b82f6'
                : '2px solid rgba(255,255,255,0.08)',
              background: state.isPublic === pub ? '#3b82f618' : 'rgba(255,255,255,0.03)',
              color: state.isPublic === pub ? '#3b82f6' : '#888',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.15s ease',
            }}
          >
            {pub ? 'Public' : 'Private'}
          </button>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: '#444' }}>
        Visibility is stored locally and not synced to the database.
      </p>
    </div>
  )

  const renderStep7 = () => {
    const err = reviewError()
    const classMeta = state.classification ? CLASS_META[state.classification] : null
    const statusMeta =
      state.status in STATUS_META
        ? STATUS_META[state.status as keyof typeof STATUS_META]
        : null
    const nonEmptyObjs = state.objectives.filter(o => o.title.trim())
    const parentProject = state.parentProjectId
      ? projects.find(p => p.id === state.parentProjectId)
      : null

    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontFamily: 'var(--font-display)', color: '#fff' }}>
          Review
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>
          Confirm everything looks right before creating.
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Classification + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {classMeta && (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: `${classMeta.accent}22`,
                  color: classMeta.accent,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {classMeta.label}
              </span>
            )}
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#fff',
                fontFamily: 'var(--font-display)',
              }}
            >
              {state.name || <span style={{ color: '#444' }}>Untitled</span>}
            </span>
          </div>

          {/* Hierarchy */}
          <div style={{ fontSize: 13, color: '#888' }}>
            <span style={{ color: '#555', marginRight: 6 }}>Hierarchy:</span>
            {state.hierarchy === 'sub' && parentProject ? (
              <span style={{ color: '#aaa' }}>
                Sub-project of{' '}
                <strong style={{ color: '#fff' }}>{parentProject.name}</strong>
              </span>
            ) : (
              <span style={{ color: '#aaa' }}>Standalone project</span>
            )}
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#555' }}>Status:</span>
            <span
              style={{
                padding: '2px 10px',
                borderRadius: 20,
                background: statusMeta ? `${statusMeta.color}22` : 'rgba(255,255,255,0.08)',
                color: statusMeta ? statusMeta.color : '#888',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {statusMeta ? statusMeta.label : state.status}
            </span>
          </div>

          {/* Dates */}
          {(state.startDate || state.endDate) && (
            <div style={{ fontSize: 13, color: '#888' }}>
              <span style={{ color: '#555', marginRight: 6 }}>Dates:</span>
              {state.startDate && (
                <span style={{ color: '#aaa' }}>{state.startDate}</span>
              )}
              {state.startDate && state.endDate && (
                <span style={{ color: '#444' }}> → </span>
              )}
              {state.endDate && (
                <span style={{ color: '#aaa' }}>{state.endDate}</span>
              )}
            </div>
          )}

          {/* Objectives */}
          {nonEmptyObjs.length > 0 && (
            <div>
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: 11,
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Objectives ({nonEmptyObjs.length})
              </p>
              {nonEmptyObjs.map((obj, i) => {
                const taskCount = obj.tasks.filter(t => t.title.trim()).length
                return (
                  <div
                    key={obj.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 4,
                      fontSize: 13,
                      color: '#aaa',
                    }}
                  >
                    <span style={{ color: '#444' }}>{i + 1}.</span>
                    {obj.title}
                    {taskCount > 0 && (
                      <span style={{ color: '#555', fontSize: 11 }}>
                        ({taskCount} task{taskCount !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {(err || state.submitError) && (
          <p
            style={{
              margin: '14px 0 0',
              padding: '10px 14px',
              background: '#f871711a',
              border: '1px solid #f87171',
              borderRadius: 10,
              fontSize: 13,
              color: '#f87171',
            }}
          >
            {err ?? state.submitError}
          </p>
        )}
      </div>
    )
  }

  const renderStep8 = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 220,
        gap: 16,
      }}
    >
      <style>{`@keyframes ppwiz-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <SpinnerGap
        size={40}
        style={{ color: '#3b82f6', animation: 'ppwiz-spin 0.8s linear infinite' }}
      />
      <p style={{ margin: 0, fontSize: 15, color: '#888' }}>Creating project…</p>
    </div>
  )

  const renderCurrentStep = () => {
    switch (step) {
      case 2: return renderStep2()
      case 3: return renderStep3()
      case 4: return renderStep4()
      case 5: return renderStep5()
      case 6: return renderStep6()
      case 7: return renderStep7()
      case 8: return renderStep8()
      default: return null
    }
  }

  const isCreating = step === 8
  const isLastContent = step === 7

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !isCreating) onClose()
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          background: '#111',
          borderRadius: 20,
          padding: '28px 32px 32px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
      >
        {/* Close button */}
        {!isCreating && (
          <button
            onClick={onClose}
            aria-label="Close wizard"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 8,
              color: '#888',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Progress bar (steps 2–7 → positions 1–6) */}
        {!isCreating && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
            {Array.from({ length: TOTAL_VISIBLE }, (_, i) => {
              const pos = i + 1
              const done = pos < visiblePos
              const active = pos === visiblePos
              return (
                <div
                  key={i}
                  style={{
                    height: 4,
                    flex: 1,
                    borderRadius: 2,
                    background: done
                      ? '#a855f7'
                      : active
                        ? '#a855f7aa'
                        : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s ease',
                  }}
                />
              )
            })}
          </div>
        )}

        {/* Step content */}
        <div style={{ minHeight: 260 }}>{renderCurrentStep()}</div>

        {/* Footer nav */}
        {!isCreating && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 28,
            }}
          >
            <button
              onClick={() => setStep(s => Math.max(s - 1, 2))}
              disabled={step === 2}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: step === 2 ? '#333' : '#888',
                cursor: step === 2 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            {isLastContent ? (
              <button
                onClick={() => void handleSubmit()}
                disabled={!canContinue()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  background: canContinue()
                    ? 'linear-gradient(135deg, #3b82f6, #06b6d4)'
                    : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: 10,
                  color: canContinue() ? '#fff' : '#333',
                  cursor: canContinue() ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  boxShadow: canContinue()
                    ? '0 4px 20px rgba(59,130,246,0.35)'
                    : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Create Project
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canContinue()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  background: canContinue()
                    ? 'rgba(168,85,247,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: canContinue()
                    ? '1px solid rgba(168,85,247,0.4)'
                    : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  color: canContinue() ? '#a855f7' : '#333',
                  cursor: canContinue() ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s ease',
                }}
              >
                Continue <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
