import { useEffect, useMemo, useState } from 'react'
import { Users, Companies, type Company, type UserRole, type UserRow } from '../lib/api'
import DataTable from '../components/DataTable'
import Modal, { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'מנהל מערכת',
  company_admin: 'אדמין חברה',
  company_user: 'משתמש חברה',
}

type FormState = {
  full_name: string
  email: string
  phone: string
  role: UserRole
  // For super_admin (system user) this stays null; otherwise it's the user's company.
  company_id: number | null
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  phone: '',
  role: 'company_user',
  company_id: null,
  is_active: true,
}

export default function UsersPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const isSuper = user?.role === 'super_admin'
  const [rows, setRows] = useState<UserRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  function load() {
    setLoading(true)
    // super_admin with no company selected → lists ALL users (incl. system users).
    Users.list(isSuper ? companyId ?? undefined : undefined)
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [user?.role, companyId])

  // Companies feed the per-user company picker (super_admin only).
  useEffect(() => {
    if (isSuper) Companies.list().then(setCompanies).catch(() => {})
  }, [isSuper])

  // A super_admin can also create system users (no company); others cannot.
  const availableRoles: UserRole[] = useMemo(
    () => (isSuper ? ['super_admin', 'company_admin', 'company_user'] : ['company_admin', 'company_user']),
    [isSuper],
  )

  const companyName = (id: number | null) =>
    id == null ? '— מערכת —' : companies.find((c) => c.id === id)?.name || `#${id}`

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, company_id: companyId ?? null })
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
      company_id: u.company_id,
      is_active: u.is_active,
    })
    setSaveErr(null)
    setOpen(true)
  }

  async function save() {
    setSaveErr(null)
    // System users (super_admin) carry no company. For other roles a company is
    // required: super_admin picks it; a company_admin always uses their own.
    const resolvedCompany =
      form.role === 'super_admin' ? null : isSuper ? form.company_id : companyId ?? null
    if (form.role !== 'super_admin' && resolvedCompany == null) {
      setSaveErr('יש לבחור חברה עבור משתמש שאינו מנהל מערכת')
      return
    }
    const payload = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      role: form.role,
      company_id: resolvedCompany,
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            ניהול משתמשים
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            {isSuper
              ? (companyId ? 'משתמשי החברה הנבחרת' : 'כל המשתמשים — כולל מנהלי מערכת (ללא חברה)')
              : 'מנהלי המערכת של החברה'}
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
            ...(isSuper
              ? [{ header: 'חברה', key: 'company_id', render: (r: UserRow) => companyName(r.company_id) }]
              : []),
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
        {/* System users (super_admin) have no company; everyone else needs one. */}
        {isSuper && form.role !== 'super_admin' && (
          <Field label="חברה">
            <select
              style={inputStyle}
              value={form.company_id ?? ''}
              onChange={(e) => setForm({ ...form, company_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">— בחר חברה —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        {isSuper && form.role === 'super_admin' && (
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: 10 }}>
            מנהל מערכת אינו משויך לחברה — מנהל את המערכת כולה.
          </div>
        )}
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
