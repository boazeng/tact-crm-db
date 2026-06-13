import { useEffect, useState } from 'react'
import { RoleOptions, type RoleOption } from '../lib/api'
import DataTable from '../components/DataTable'
import Modal, { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

export default function RolesPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [rows, setRows] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RoleOption | null>(null)
  const [label, setLabel] = useState('')
  const [saveErr, setSaveErr] = useState<string | null>(null)

  function load() {
    if (needsCompany) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    RoleOptions.list(cid)
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  function openCreate() {
    setEditing(null)
    setLabel('')
    setSaveErr(null)
    setOpen(true)
  }
  function openEdit(r: RoleOption) {
    setEditing(r)
    setLabel(r.label)
    setSaveErr(null)
    setOpen(true)
  }

  async function save() {
    setSaveErr(null)
    try {
      if (editing) await RoleOptions.update(editing.id, { label, sort_order: editing.sort_order }, cid)
      else await RoleOptions.create({ label, sort_order: rows.length }, cid)
      setOpen(false)
      load()
    } catch (e) {
      setSaveErr(String(e))
    }
  }

  async function remove(r: RoleOption) {
    if (!confirm(`להסיר את התפקיד "${r.label}"?`)) return
    await RoleOptions.remove(r.id, cid)
    load()
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לנהל תפקידים</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            תפקידים
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            רשימת התפקידים שמוצעת בכרטיס הלקוח (אפשר עדיין להקליד תפקיד חופשי)
          </div>
        </div>
        <button onClick={openCreate} className="tact-btn tact-btn-primary">+ תפקיד חדש</button>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <DataTable
          compact
          rows={rows}
          rowKey={(r) => r.id}
          columns={[{ header: 'תפקיד', key: 'label' }]}
          actions={(r) => (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => openEdit(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                ערוך
              </button>
              <button onClick={() => remove(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                הסר
              </button>
            </div>
          )}
          empty="אין תפקידים. לחץ '+ תפקיד חדש'."
        />
      )}

      <Modal
        open={open}
        title={editing ? 'עריכת תפקיד' : 'תפקיד חדש'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="tact-btn tact-btn-ghost" onClick={() => setOpen(false)}>ביטול</button>
            <button className="tact-btn tact-btn-primary" onClick={save}>שמור</button>
          </>
        }
      >
        <Field label="תפקיד">
          <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        {saveErr && <div style={{ color: 'var(--color-accent)' }}>{saveErr}</div>}
      </Modal>
    </div>
  )
}
