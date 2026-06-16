import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle, Info, Warning, XCircle, X } from '@phosphor-icons/react'

export type ToastVariant = 'info' | 'success' | 'warn' | 'error'

interface Toast {
  id: string
  variant: ToastVariant
  message: string
  persistent: boolean
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
  info: {
    border: 'border-[#60a5fa]',
    icon: <Info size={16} weight="fill" style={{ color: '#60a5fa', flexShrink: 0 }} />,
  },
  success: {
    border: 'border-[#4ade80]',
    icon: <CheckCircle size={16} weight="fill" style={{ color: '#4ade80', flexShrink: 0 }} />,
  },
  warn: {
    border: 'border-[#fb923c]',
    icon: <Warning size={16} weight="fill" style={{ color: '#fb923c', flexShrink: 0 }} />,
  },
  error: {
    border: 'border-[#f87171]',
    icon: <XCircle size={16} weight="fill" style={{ color: '#f87171', flexShrink: 0 }} />,
  },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { border, icon } = VARIANT_STYLES[toast.variant]

  useEffect(() => {
    if (!toast.persistent) {
      timerRef.current = setTimeout(() => onRemove(toast.id), 4000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.persistent, onRemove])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-2 px-3 py-2.5 rounded border ${border} max-w-xs`}
      style={{
        backgroundColor: 'var(--color-surface-2)',
        color: 'var(--color-text-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        fontSize: '13px',
        lineHeight: '1.4',
      }}
    >
      <span className="mt-px">{icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="mt-px opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <X size={13} style={{ color: 'var(--color-text-secondary)' }} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID()
    const persistent = variant === 'warn' || variant === 'error'
    setToasts(prev => {
      const next = [...prev, { id, variant, message, persistent }]
      return next.slice(-3)
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: '48px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'flex-end',
        }}
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): (message: string, variant?: ToastVariant) => void {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.addToast
}

export function Toaster() {
  return null
}
