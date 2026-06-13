import { useEffect, useMemo, useState } from 'react'
import { Users, type UserRole, type UserRow } from '../lib/api'
import DataTable from '../components/DataTable'
import Modal, { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'מנהל-על',
  company_admin: 'אדמין חברה',
  company_user: 'משתמש חברה',
}

type FormState = {
  full_name: string
  email: string
  phone: string
  role: UserRole
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  phone: '',
  role: 'company_user',
  is_active: true,
}

export default function UsersPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const needsCompany = user?.role === 'super_admin' && !companyId

  function load() {
    if (needsCompany) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    Users.list(user?.role === 'super_admin' ? companyId ?? undefined : undefined)
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [user?.role, companyId])

  const availableRoles: UserRole[] = useMemo(() => ['company_admin', 'company_user'], [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSaveErr(null)
    setOpen(true)
  }
  function openEdit(u: UserRow) {
    setEditing(u)
    setForm({
      full_name: u.full_name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      is_active: u.is_active,
    })
    setSaveErr(null)
    setOpen(true)
  }

  async function save() {
    setSaveErr(null)
    const payload = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      role: form.role,
      company_id: companyId ?? null,
      is_active: form.is_active,
    }
    try {
      if (editing) await Users.update(editing.id, payload as any)
      else await Users.create(payload as any)
      setOpen(false)
      load()
    } catch (e) {
      setSaveErr(String(e))
    }
  }

  async function remove(u: UserRow) {
    if (u.id === user?.id) {
      alert('לא ניתן להשבית את עצמך')
      return
    }
    if (!confirm(`להשבית את "${u.full_name}"?`)) return
    await Users.remove(u.id)
    load()
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לנהל משתמשים</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            ניהול משתמשים
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            מנהלי המערכת של החברה
          </div>
        </div>
        <button onClick={openCreate} className="tact-btn tact-btn-primary">
          + משתמש חדש
        </button>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { header: 'שם', key: 'full_name' },
            { header: 'אימייל', key: 'email' },
            { header: 'טלפון', key: 'phone' },
            { header: 'תפקיד', key: 'role', render: (r) => ROLE_LABEL[r.role] },
            {
              header: 'סטטוס',
              key: 'is_active',
              render: (r) => (
                <span className={`tact-badge ${r.is_active ? 'tact-badge-pos' : 'tact-badge-soon'}`}>
                  {r.is_active ? 'פעיל' : 'לא פעיל'}
                </span>
              ),
            },
          ]}
          actions={(r) => (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => openEdit(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                ערוך
              </button>
              <button onClick={() => remove(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                השבת
              </button>
            </div>
          )}
          empty="אין עדיין משתמשים בחברה זו."
        />
      )}

      <Modal
        open={open}
        title={editing ? 'עריכת משתמש' : 'משתמש חדש'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="tact-btn tact-btn-ghost" onClick={() => setOpen(false)}>
              ביטול
            </button>
            <button className="tact-btn tact-btn-primary" onClick={save}>
              שמור
            </button>
          </>
        }
      >
        <Field label="שם מלא">
          <input style={inputStyle} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="אימייל">
          <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="טלפון">
          <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="תפקיד">
          <select
            style={inputStyle}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="סטטוס">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span style={{ fontSize: '0.9rem' }}>פעיל</span>
          </label>
        </Field>
        {saveErr && <div style={{ color: 'var(--color-accent)' }}>{saveErr}</div>}
      </Modal>
    </div>
  )
}
