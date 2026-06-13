import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; type: ToastType }

type ToastApi = {
  show: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

const STYLES: Record<ToastType, { bar: string; icon: string }> = {
  success: { bar: 'var(--color-success, #2e9e6b)', icon: '✓' },
  error: { bar: 'var(--color-accent, #c4622d)', icon: '!' },
  info: { bar: 'var(--color-primary, #1f3a5f)', icon: 'i' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++seq.current
      setToasts((list) => [...list, { id, message, type }])
      // auto-dismiss; errors linger a little longer so they can be read
      window.setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000)
    },
    [dismiss],
  )

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  )
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      <style>{`@keyframes tactToastIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {toasts.map((t) => {
        const s = STYLES[t.type]
        return (
          <div
            key={t.id}
            onClick={() => onDismiss(t.id)}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              minWidth: 280,
              maxWidth: 'min(560px, 92vw)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--color-bg-white, #fff)',
              border: '1px solid var(--color-border, #e7e2d8)',
              borderInlineStart: `4px solid ${s.bar}`,
              borderRadius: 12,
              boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.16))',
              padding: '12px 18px',
              fontSize: '0.92rem',
              color: 'var(--color-text, #2b2b2b)',
              textAlign: 'center',
              animation: 'tactToastIn 0.22s ease',
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: s.bar,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {s.icon}
            </span>
            <span style={{ flex: 1, textAlign: 'center' }}>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
