import { useRef, useState, useEffect, useCallback } from 'react'
import { Sparkle, ArrowUp, X } from '@phosphor-icons/react'
import { useProjectStore } from '@/store/projectStore'
import { useTodoStore } from '@/store/todoStore'
import { useCardStore } from '@/store/cardStore'
import { executeToolAction } from './toolExecutor'
import type { ChatMessage, ToolAction } from './types'

// ── Typing dots animation ─────────────────────────────────────────────────────

const TYPING_DOTS_STYLE = `
@keyframes chatDotPulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1);   }
}
`

function TypingDots() {
  return (
    <>
      <style>{TYPING_DOTS_STYLE}</style>
      <div style={{ display: 'flex', gap: 4, padding: '8px 4px' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#555',
              animation: 'chatDotPulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 4,
      }}
    >
      <div
        style={{
          maxWidth: '82%',
          padding: msg.loading ? '4px 12px' : '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
          background: isUser ? '#1a1a2e' : '#111',
          border: `1px solid ${isUser ? 'rgba(123,47,247,0.25)' : 'rgba(255,255,255,0.07)'}`,
          color: msg.error ? '#f87171' : '#e5e5e5',
          fontSize: 14,
          lineHeight: 1.55,
          fontFamily: 'var(--font-sans)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {msg.loading ? <TypingDots /> : msg.content}
      </div>

      {/* Action result pills */}
      {msg.actionResults && msg.actionResults.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: '82%' }}>
          {msg.actionResults.map((result, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                color: '#4ade80',
                background: 'rgba(74,222,128,0.1)',
                border: '1px solid rgba(74,222,128,0.25)',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              {'✓'} {result}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  onOpenProject?: (id: string) => void
  isMobile?: boolean
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export function ChatPanel({ onOpenProject, isMobile = false }: ChatPanelProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        "Hi! I'm Pulse, your AI assistant. I can manage your projects, todos, and Kanban cards. What would you like to do?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }
    const loadingId = Date.now().toString() + 'l'
    const loadingMsg: ChatMessage = {
      id: loadingId,
      role: 'assistant',
      content: '',
      loading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setLoading(true)

    try {
      // Build context from stores — use getState() to avoid stale closures
      const projectsRaw = useProjectStore.getState().projects
      const todosRaw = useTodoStore.getState().todos
      const cardsRaw = useCardStore.getState().cards
      const activeProject = useProjectStore.getState().activeProject

      const projects = projectsRaw.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        classification: p.classification,
      }))
      const todos = todosRaw.map(t => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
      }))
      const cards = cardsRaw.map(c => ({
        id: c.id,
        project_id: c.project_id,
        title: c.title,
        column: c.column,
      }))

      // Build history from current messages snapshot
      const history = messages
        .filter(m => !m.loading && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const baseUrl =
        import.meta.env.VITE_PUSH_RELAY_URL?.replace('/push', '') ?? 'http://localhost:8001'

      const res = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history,
          context: {
            projects,
            todos,
            cards,
            active_project_id: activeProject?.id ?? null,
          },
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)
      const data: { text: string; actions: ToolAction[] } = await res.json()

      // Execute frontend tool actions sequentially
      const actionResults: string[] = []
      for (const action of data.actions ?? []) {
        try {
          const result = await executeToolAction(action, { onOpenProject })
          actionResults.push(result)
        } catch {
          actionResults.push(`Failed: ${action.type}`)
        }
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? {
                ...m,
                content: data.text,
                loading: false,
                actions: data.actions,
                actionResults: actionResults.length > 0 ? actionResults : undefined,
              }
            : m
        )
      )
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? {
                ...m,
                content: 'Something went wrong. Please try again.',
                loading: false,
                error: true,
              }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, onOpenProject])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  // ── Panel positioning ───────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70dvh',
        zIndex: 400,
        background: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px 20px 0 0',
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
      }
    : {
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 380,
        zIndex: 400,
        background: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
      }

  const fabStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: 72,
        right: 76,
        zIndex: 150,
      }
    : {
        position: 'fixed',
        bottom: 96,
        right: 28,
        zIndex: 150,
      }

  return (
    <>
      {/* Floating bubble button */}
      <div style={fabStyle}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="AI Assistant"
          aria-label="Open AI assistant"
          aria-expanded={open}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7b2ff7, #ff0080)',
            boxShadow: open
              ? '0 0 0 3px rgba(123,47,247,0.3), 0 8px 32px rgba(123,47,247,0.5)'
              : '0 4px 20px rgba(123,47,247,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
            transition: 'box-shadow 0.2s, transform 0.2s',
            transform: open ? 'scale(0.92)' : 'scale(1)',
          }}
        >
          <Sparkle size={22} color="#fff" weight="fill" />
        </button>
      </div>

      {/* Backdrop (mobile only) */}
      {isMobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 399,
            background: 'rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease both',
          }}
        />
      )}

      {/* Panel */}
      <div style={panelStyle} role="dialog" aria-label="AI assistant chat" aria-modal="true">

        {/* Drag handle (mobile) */}
        {isMobile && (
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.15)',
              margin: '12px auto 0',
              flexShrink: 0,
            }}
          />
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: isMobile ? '12px 16px 12px' : '16px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: '#111',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7b2ff7, #ff0080)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkle size={16} color="#fff" weight="fill" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: '#fff',
                letterSpacing: 0.3,
              }}
            >
              Pulse AI
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#555',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Your project assistant
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close AI assistant"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: '#0a0a0a',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            paddingBottom: isMobile ? 'max(10px, env(safe-area-inset-bottom))' : '10px',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask Pulse anything..."
            rows={1}
            aria-label="Message input"
            style={{
              flex: 1,
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '9px 12px',
              color: '#e5e5e5',
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              overflowY: 'auto',
              maxHeight: 120,
              minHeight: 38,
              boxSizing: 'border-box',
              opacity: loading ? 0.6 : 1,
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(123,47,247,0.5)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background:
                loading || !input.trim()
                  ? 'rgba(255,255,255,0.07)'
                  : 'linear-gradient(135deg, #7b2ff7, #ff0080)',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.2s, opacity 0.2s',
              opacity: loading || !input.trim() ? 0.4 : 1,
            }}
          >
            <ArrowUp size={17} color="#fff" weight="bold" />
          </button>
        </div>
      </div>
    </>
  )
}
