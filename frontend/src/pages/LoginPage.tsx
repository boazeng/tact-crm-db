import { useEffect, useState } from 'react'
import { Auth, type DevUserOption } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/Toast'
import TactLogo from '../components/TactLogo'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'מנהל-על',
  company_admin: 'אדמין חברה',
  company_user: 'משתמש חברה',
  end_customer: 'דייר',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  color: 'var(--color-text)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-text-light)',
  marginBottom: 6,
}

export default function LoginPage() {
  const { login, loginAs } = useAuth()
  const toast = useToast()

  // --- Production email + password ---
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // --- Dev quick-login (only rendered when /dev-users is reachable) ---
  const [devUsers, setDevUsers] = useState<DevUserOption[]>([])
  const [devSelected, setDevSelected] = useState('')
  const [devSubmitting, setDevSubmitting] = useState(false)

  useEffect(() => {
    // 404 in production (dev-login disabled) → dropdown simply never shows.
    Auth.devUsers()
      .then((list) => {
        setDevUsers(list)
        if (list.length > 0) setDevSelected(list[0].email)
      })
      .catch(() => setDevUsers([]))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      toast.error('אימייל או סיסמה שגויים')
    } finally {
      setSubmitting(false)
    }
  }

  async function onDevSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!devSelected) return
    setDevSubmitting(true)
    try {
      await loginAs(devSelected)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setDevSubmitting(false)
    }
  }

  return (
    <div
      className="tact-aurora"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-white)',
          border: '1px solid var(--color-border)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          padding: '36px 32px 30px',
          width: 'min(420px, 92vw)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <TactLogo word="crm" size={1.2} />
          <div style={{ color: 'var(--color-text-light)', fontSize: '0.92rem' }}>
            מערכת ניהול לקוחות
          </div>
        </div>

        <h1 style={{ fontSize: '1.3rem', color: 'var(--color-primary)', marginBottom: 6 }}>
          התחברות
        </h1>
        <p style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', marginBottom: 18 }}>
          הזינו אימייל וסיסמה
        </p>

        <form onSubmit={onSubmit}>
          <label style={labelStyle}>אימייל</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            dir="ltr"
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          <label style={labelStyle}>סיסמה</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            dir="ltr"
            style={inputStyle}
          />

          <button
            type="submit"
            className="tact-btn tact-btn-primary"
            disabled={!email || !password || submitting}
            style={{ width: '100%', marginTop: 22 }}
          >
            {submitting ? 'מתחבר…' : 'התחבר'}
          </button>
        </form>

        {devUsers.length > 0 && (
          <details style={{ marginTop: 24 }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--color-text-light)',
              }}
            >
              כניסה מהירה (פיתוח)
            </summary>
            <form onSubmit={onDevSubmit} style={{ marginTop: 12 }}>
              <select
                value={devSelected}
                onChange={(e) => setDevSelected(e.target.value)}
                style={inputStyle}
              >
                {devUsers.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.full_name} · {ROLE_LABEL[u.role] || u.role}
                    {u.company_name ? ` · ${u.company_name}` : ''} · {u.email}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="tact-btn"
                disabled={!devSelected || devSubmitting}
                style={{ width: '100%', marginTop: 12 }}
              >
                {devSubmitting ? 'מתחבר…' : 'כניסת פיתוח'}
              </button>
            </form>
          </details>
        )}
      </div>
    </div>
  )
}
