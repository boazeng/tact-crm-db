import { useEffect, useState } from 'react'
import {
  Projects,
  ProjectFieldLabels,
  Customers,
  type Project,
  type ProjectFieldLabel,
  type Customer,
} from '../lib/api'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import ProjectForm, {
  EMPTY_PROJECT,
  formFromProject,
  toBody,
  type ProjectForm as ProjectFormState,
} from '../components/ProjectForm'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

export default function ProjectsPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [rows, setRows] = useState<Project[]>([])
  const [fieldLabels, setFieldLabels] = useState<ProjectFieldLabel[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  function load() {
    if (needsCompany) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      Projects.list(cid, search || undefined),
      ProjectFieldLabels.list(cid),
      Customers.list(cid, undefined, { excludeStatus: 'lead' }),
    ])
      .then(([p, fl, c]) => {
        setRows(p)
        setFieldLabels(fl)
        setCustomers(c)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_PROJECT, creation_date: new Date().toISOString().slice(0, 10) })
    setSaveErr(null)
    setOpen(true)
  }
  function openEdit(p: Project) {
    setEditingId(p.id)
    setForm(formFromProject(p))
    setSaveErr(null)
    setOpen(true)
  }

  async function save() {
    setSaveErr(null)
    try {
      if (editingId) await Projects.update(editingId, toBody(form), cid)
      else await Projects.create(toBody(form), cid)
      setOpen(false)
      load()
    } catch (e) {
      setSaveErr(String(e))
    }
  }

  async function remove(p: Project) {
    if (!confirm(`למחוק את הפרויקט "${p.name}"?`)) return
    await Projects.remove(p.id, cid)
    load()
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לצפות בפרויקטים</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>פרויקטים</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            נתוני הפרויקט הבסיסיים + הפרמטרים המותאמים-אישית של החברה
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="חיפוש…"
            style={{ width: 200, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontFamily: 'inherit', fontSize: '0.92rem', color: 'var(--color-text)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button onClick={load} className="tact-btn tact-btn-ghost">חפש</button>
          <button onClick={openCreate} className="tact-btn tact-btn-primary">+ פרויקט חדש</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          pageSize={50}
          columns={[
            { header: "מס' פרויקט", key: 'project_number', render: (r: Project) => r.project_number || '—' },
            { header: 'שם', key: 'name' },
            { header: 'לקוח', key: 'customer_name', render: (r: Project) => r.customer_name || '—' },
            { header: 'תאריך יצירה', key: 'creation_date', render: (r: Project) => (r.creation_date ? r.creation_date.split('-').reverse().join('/') : '—') },
          ]}
          actions={(r) => (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => openEdit(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                ערוך
              </button>
              <button onClick={() => remove(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                מחק
              </button>
            </div>
          )}
          empty="עדיין אין פרויקטים. לחץ '+ פרויקט חדש'."
        />
      )}

      <Modal
        open={open}
        title={editingId ? 'עריכת פרויקט' : 'פרויקט חדש'}
        width={760}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="tact-btn tact-btn-ghost" onClick={() => setOpen(false)}>ביטול</button>
            <button className="tact-btn tact-btn-primary" onClick={save}>שמור</button>
          </>
        }
      >
        <ProjectForm
          form={form}
          setForm={setForm}
          fieldLabels={fieldLabels}
          customerOptions={customers}
        />
        {saveErr && <div style={{ color: 'var(--color-accent)' }}>{saveErr}</div>}
      </Modal>
    </div>
  )
}
