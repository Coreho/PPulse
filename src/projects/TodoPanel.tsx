import { useState, useEffect } from 'react'
import { Plus, Check, Trash, PencilSimple, ListChecks } from '@phosphor-icons/react'
import { useTodoStore, MAX_TODO_DETAILS } from '@/store/todoStore'
import type { Database } from '@/db/types'

type Todo = Database['public']['Tables']['todos']['Row']

const PANEL_BG = '#0c0c0c'
const CARD_BG = '#161616'
const EDGE = '1px solid rgba(255,255,255,0.07)'
const ACCENT = '#f59e0b' // warm amber — matches the rough draft's header band

// ─── Detail line inputs (shared by composer + editor) ──────────────────────────

function DetailInputs({ details, onChange }: { details: string[]; onChange: (d: string[]) => void }) {
  const set = (i: number, v: string) => onChange(details.map((d, idx) => idx === i ? v : d))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: MAX_TODO_DETAILS }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#555', flexShrink: 0 }} />
          <input
            placeholder={`Detail ${i + 1}${i === 0 ? '' : ' (optional)'}`}
            value={details[i] ?? ''}
            onChange={e => set(i, e.target.value)}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.04)', border: EDGE,
              borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#ddd',
              outline: 'none', fontFamily: 'var(--font-sans)', minWidth: 0,
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Composer ───────────────────────────────────────────────────────────────

function TodoComposer({ onSave, onCancel }: {
  onSave: (title: string, details: string[]) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState<string[]>(['', '', ''])
  const canSave = title.trim().length > 0

  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${ACCENT}44`, borderRadius: 14,
      padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: `0 0 18px ${ACCENT}18`,
    }}>
      <input
        autoFocus
        placeholder="Task title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && canSave) onSave(title.trim(), details) }}
        style={{
          background: 'rgba(255,255,255,0.05)', border: EDGE, borderRadius: 8,
          padding: '8px 10px', fontSize: 13, fontWeight: 600, color: '#fff',
          outline: 'none', fontFamily: 'var(--font-sans)',
        }}
      />
      <DetailInputs details={details} onChange={setDetails} />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{
          padding: '5px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', color: '#888', border: EDGE,
        }}>Cancel</button>
        <button type="button" disabled={!canSave} onClick={() => canSave && onSave(title.trim(), details)} style={{
          padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8,
          cursor: canSave ? 'pointer' : 'not-allowed',
          background: canSave ? ACCENT : 'rgba(255,255,255,0.05)',
          color: canSave ? '#000' : '#444', border: 'none',
        }}>Add</button>
      </div>
    </div>
  )
}

// ─── Todo card ────────────────────────────────────────────────────────────────

function TodoCard({ todo, onToggle, onDelete, onUpdate }: {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
  onUpdate: (title: string, details: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [details, setDetails] = useState<string[]>([
    todo.details[0] ?? '', todo.details[1] ?? '', todo.details[2] ?? '',
  ])
  const [hovered, setHovered] = useState(false)

  if (editing) {
    const canSave = title.trim().length > 0
    return (
      <div style={{
        background: CARD_BG, border: `1px solid ${ACCENT}44`, borderRadius: 14,
        padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <input
          autoFocus value={title} onChange={e => setTitle(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: EDGE, borderRadius: 8,
            padding: '8px 10px', fontSize: 13, fontWeight: 600, color: '#fff',
            outline: 'none', fontFamily: 'var(--font-sans)',
          }}
        />
        <DetailInputs details={details} onChange={setDetails} />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { setEditing(false); setTitle(todo.title); setDetails([todo.details[0] ?? '', todo.details[1] ?? '', todo.details[2] ?? '']) }}
            style={{ padding: '5px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#888', border: EDGE }}>Cancel</button>
          <button type="button" disabled={!canSave} onClick={() => { if (canSave) { onUpdate(title.trim(), details); setEditing(false) } }}
            style={{ padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: canSave ? 'pointer' : 'not-allowed', background: canSave ? ACCENT : 'rgba(255,255,255,0.05)', color: canSave ? '#000' : '#444', border: 'none' }}>Save</button>
        </div>
      </div>
    )
  }

  const shownDetails = todo.details.filter(d => d.trim().length > 0).slice(0, MAX_TODO_DETAILS)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: CARD_BG, border: EDGE, borderRadius: 14, overflow: 'hidden',
        opacity: todo.completed ? 0.5 : 1, transition: 'opacity 0.2s',
      }}
    >
      {/* Title header band */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
        background: todo.completed ? 'rgba(255,255,255,0.04)' : `${ACCENT}1c`,
        borderBottom: shownDetails.length ? EDGE : 'none',
      }}>
        <button type="button" onClick={onToggle} title={todo.completed ? 'Mark incomplete' : 'Mark done'}
          style={{
            width: 18, height: 18, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: todo.completed ? ACCENT : 'transparent',
            border: todo.completed ? 'none' : `1.5px solid ${ACCENT}88`,
          }}>
          {todo.completed && <Check size={12} weight="bold" color="#000" />}
        </button>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 700, color: todo.completed ? '#777' : '#fff',
          textDecoration: todo.completed ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{todo.title}</span>
        {hovered && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button type="button" onClick={() => setEditing(true)} title="Edit"
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 2, lineHeight: 1 }}>
              <PencilSimple size={13} />
            </button>
            <button type="button" onClick={onDelete} title="Delete"
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2, lineHeight: 1 }}>
              <Trash size={13} />
            </button>
          </div>
        )}
      </div>
      {/* Detail lines */}
      {shownDetails.length > 0 && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {shownDetails.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT, flexShrink: 0, marginTop: 6 }} />
              <span style={{ fontSize: 12, color: '#aaa', lineHeight: 1.4 }}>{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function TodoPanel() {
  const { todos, loadTodos, addTodo, updateTodo, toggleTodo, deleteTodo } = useTodoStore()
  const [composing, setComposing] = useState(false)

  useEffect(() => { loadTodos() }, [loadTodos])

  const open = todos.filter(t => !t.completed).length

  return (
    <aside style={{
      width: 320, flexShrink: 0, height: '100%', boxSizing: 'border-box',
      background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 18px 14px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <ListChecks size={20} color={ACCENT} weight="fill" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#fff', margin: 0 }}>To-Do List</h2>
          {open > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999,
              background: `${ACCENT}22`, color: ACCENT,
            }}>{open}</span>
          )}
        </div>
        <button type="button" onClick={() => setComposing(true)} title="Add task"
          style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${ACCENT}1c`, border: `1px solid ${ACCENT}44`, color: ACCENT,
          }}>
          <Plus size={16} weight="bold" />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {composing && (
          <TodoComposer
            onSave={(title, details) => { addTodo(title, details); setComposing(false) }}
            onCancel={() => setComposing(false)}
          />
        )}

        {todos.length === 0 && !composing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 48, textAlign: 'center' }}>
            <ListChecks size={34} color="#2a2a2a" />
            <p style={{ fontSize: 13, color: '#444', margin: 0, lineHeight: 1.5 }}>
              No tasks yet.<br />Track the small day-to-day stuff here.
            </p>
            <button type="button" onClick={() => setComposing(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600,
              borderRadius: 999, cursor: 'pointer', background: `${ACCENT}1c`, border: `1px solid ${ACCENT}44`, color: ACCENT,
            }}>
              <Plus size={13} weight="bold" /> Add a task
            </button>
          </div>
        ) : (
          todos.map(t => (
            <TodoCard
              key={t.id}
              todo={t}
              onToggle={() => toggleTodo(t.id)}
              onDelete={() => deleteTodo(t.id)}
              onUpdate={(title, details) => updateTodo(t.id, { title, details })}
            />
          ))
        )}
      </div>
    </aside>
  )
}
