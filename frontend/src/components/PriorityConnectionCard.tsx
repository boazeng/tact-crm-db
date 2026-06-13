import { useEffect, useState } from 'react'
import { PrioritySync, type PriorityConnection, type PriorityConnectionInput } from '../lib/api'
import { Field, inputStyle } from './Modal'

type Props = {
  conn: PriorityConnection | null
  cid?: number
  onSaved: (c: PriorityConnection) => void
}

/** Connection settings for the Priority OData API — collapsible card at the top
 * of the sync screen. Saving never echoes the password back; an empty password
 * field keeps the stored secret. */
export default function PriorityConnectionCard({ conn, cid, onSaved }: Props) {
  const [open, setOpen] = useState(!conn?.base_url)
  const [form, setForm] = useState<PriorityConnectionInput>({
    base_url: conn?.base_url ?? '',
    username: conn?.username ?? '',
    password: '',
    entity_name: conn?.entity_name ?? 'CUSTOMERS',
    is_active: conn?.is_active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // The saved connection arrives asynchronously (and changes when the viewed
  // company changes). Re-seed the form so it reflects what's actually stored.
  useEffect(() => {
    setForm({
      base_url: conn?.base_url ?? '',
      username: conn?.username ?? '',
      password: '',
      entity_name: conn?.entity_name ?? 'CUSTOMERS',
      is_active: conn?.is_active ?? true,
    })
    setOpen(!conn?.base_url)
    setMsg(null)
  }, [conn?.base_url, conn?.username, conn?.entity_name, conn?.is_active])

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const saved = await PrioritySync.saveConnection(form, cid)
      onSaved(saved)
      setForm((f) => ({ ...f, password: '' }))
      setMsg({ ok: true, text: 'ההגדרות נשמרו' })
    } catch (e) {
      setMsg({ ok: false, text: String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMsg(null)
    try {
      await PrioritySync.saveConnection(form, cid) // persist before testing
      const r = await PrioritySync.testConnection(cid)
      setMsg({ ok: r.ok, text: r.message })
      if (r.ok) onSaved(await PrioritySync.getConnection(cid) as PriorityConnection)
    } catch (e) {
      setMsg({ ok: false, text: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const dot = conn?.last_test_ok
  return (
    <div className="tact-kpi" style={{ marginBottom: 22, padding: 18 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 9, height: 9, borderRadius: '50%',
              background: dot === true ? 'var(--color-success, #2e9e6b)' : dot === false ? 'var(--color-accent)' : 'var(--color-border)',
            }}
          />
          <strong style={{ color: 'var(--color-primary)' }}>חיבור לפריורטי</strong>
          {conn?.base_url && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontFamily: 'var(--font-family-en)' }}>
              {conn.base_url}
            </span>
          )}
        </div>
        <span style={{ color: 'var(--color-text-light)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <Field label="כתובת OData של פריורטי" hint="עד וכולל שם החברה, לדוגמה: https://server/odata/Priority/tabula.ini/demo/">
            <input
              style={{ ...inputStyle, fontFamily: 'var(--font-family-en)', direction: 'ltr' }}
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            />
          </Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="שם משתמש">
                <input
                  style={{ ...inputStyle, fontFamily: 'var(--font-family-en)', direction: 'ltr' }}
                  value={form.username ?? ''}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="סיסמה" hint={conn?.password_set ? 'סיסמה שמורה — השאר ריק כדי לא לשנות' : undefined}>
                <input
                  type="password"
                  style={{ ...inputStyle, fontFamily: 'var(--font-family-en)', direction: 'ltr' }}
                  value={form.password ?? ''}
                  placeholder={conn?.password_set ? '••••••••' : ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <Field label="שם הישות בפריורטי" hint="ברירת מחדל: CUSTOMERS">
            <input
              style={{ ...inputStyle, fontFamily: 'var(--font-family-en)', direction: 'ltr' }}
              value={form.entity_name}
              onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
            />
          </Field>

          {msg && (
            <div style={{ margin: '6px 0 12px', color: msg.ok ? 'var(--color-success, #2e9e6b)' : 'var(--color-accent)', fontSize: '0.85rem' }}>
              {msg.text}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tact-btn tact-btn-primary" onClick={save} disabled={busy}>
              שמירה
            </button>
            <button className="tact-btn tact-btn-ghost" onClick={test} disabled={busy || !form.base_url}>
              {busy ? 'בודק…' : 'בדיקת חיבור'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
