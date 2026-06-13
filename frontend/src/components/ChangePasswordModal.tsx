import { useState } from 'react'
import { Auth } from '../lib/api'
import { useToast } from '../lib/Toast'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  color: 'var(--color-text)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--color-text-light)',
  margin: '12px 0 5px',
}

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) {
      toast.error('הסיסמה החדשה חייבת להכיל לפחות 8 תווים')
      return
    }
    if (next !== confirm) {
      toast.error('הסיסמה החדשה ואימותה אינם תואמים')
      return
    }
    setSubmitting(true)
    try {
      await Auth.changePassword(current, next)
      toast.success('הסיסמה שונתה בהצלחה')
      onClose()
    } catch (err) {
      // ApiError carries the server's Hebrew detail (e.g. wrong current password)
      toast.error(err instanceof Error ? err.message : 'שגיאה בשינוי הסיסמה')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-white)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          padding: '24px 24px 22px',
          width: 'min(380px, 92vw)',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: 4 }}>
          שינוי סיסמה
        </h2>

        <form onSubmit={onSubmit}>
            <label style={labelStyle}>סיסמה נוכחית</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              style={inputStyle}
            />
            <label style={labelStyle}>סיסמה חדשה (8 תווים לפחות)</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
              style={inputStyle}
            />
            <label style={labelStyle}>אימות סיסמה חדשה</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="tact-btn tact-btn-ghost"
                style={{ flex: 1 }}
                onClick={onClose}
                disabled={submitting}
              >
                ביטול
              </button>
              <button
                type="submit"
                className="tact-btn tact-btn-primary"
                style={{ flex: 1 }}
                disabled={submitting || !current || !next || !confirm}
              >
                {submitting ? 'משנה…' : 'שנה סיסמה'}
              </button>
            </div>
          </form>
      </div>
    </div>
  )
}
