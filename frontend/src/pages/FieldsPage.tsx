import { useEffect, useState } from 'react'
import { Fields, type FieldDefinition, type FieldType } from '../lib/api'
import DataTable from '../components/DataTable'
import Modal, { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

const TYPE_LABEL: Record<FieldType, string> = {
  text: 'טקסט',
  number: 'מספר',
  date: 'תאריך',
  boolean: 'כן/לא',
  select: 'בחירה יחידה',
  multiselect: 'בחירה מרובה',
}
const CHOICE_TYPES: FieldType[] = ['select', 'multiselect']

type FormState = {
  key: string
  label: string
  field_type: FieldType
  optionsText: string
  is_required: boolean
  sort_order: number
}

const EMPTY: FormState = {
  key: '',
  label: '',
  field_type: 'text',
  optionsText: '',
  is_required: false,
  sort_order: 0,
}

export default function FieldsPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [rows, setRows] = useState<FieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FieldDefinition | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  function load() {
    if (needsCompany) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    Fields.list(cid)
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setSaveErr(null)
    setOpen(true)
  }
  function openEdit(f: FieldDefinition) {
    setEditing(f)
    setForm({
      key: f.key,
      label: f.label,
      field_type: f.field_type,
      optionsText: (f.options || []).join('\n'),
      is_required: f.is_required,
      sort_order: f.sort_order,
    })
    setSaveErr(null)
    setOpen(true)
  }

  async function save() {
    setSaveErr(null)
    const isChoice = CHOICE_TYPES.includes(form.field_type)
    const options = isChoice
      ? form.optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
      : null
    const body: Partial<FieldDefinition> = {
      key: form.key,
      label: form.label,
      field_type: form.field_type,
      options,
      is_required: form.is_required,
      sort_order: Number(form.sort_order) || 0,
      is_active: true,
    }
    try {
      if (editing) await Fields.update(editing.id, body, cid)
      else await Fields.create(body, cid)
      setOpen(false)
      load()
    } catch (e) {
      setSaveErr(String(e))
    }
  }

  async function remove(f: FieldDefinition) {
    if (!confirm(`להסיר את השדה "${f.label}"? ערכים קיימים יישמרו אך השדה יוסתר.`)) return
    await Fields.remove(f.id, cid)
    load()
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי להגדיר שדות סיווג</div>
      </div>
    )
  }

  const isChoice = CHOICE_TYPES.includes(form.field_type)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            שדות סיווג
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            השדות המותאמים-אישית שבעזרתם החברה מסווגת את הלקוחות שלה
          </div>
        </div>
        <button onClick={openCreate} className="tact-btn tact-btn-primary">
          + שדה חדש
        </button>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <DataTable
          compact
          rows={rows.filter((r) => r.is_active)}
          rowKey={(r) => r.id}
          columns={[
            { header: 'תווית', key: 'label' },
            { header: 'מפתח', key: 'key', render: (r) => <code style={{ fontFamily: 'var(--font-family-en)' }}>{r.key}</code> },
            { header: 'סוג', key: 'field_type', render: (r) => TYPE_LABEL[r.field_type] },
            {
              header: 'אפשרויות',
              key: 'options',
              render: (r) => (r.options && r.options.length ? r.options.join(', ') : '—'),
            },
            {
              header: 'חובה',
              key: 'is_required',
              render: (r) =>
                r.is_required ? <span className="tact-badge tact-badge-on">חובה</span> : '—',
            },
          ]}
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
          empty="עדיין לא הוגדרו שדות סיווג. לחץ '+ שדה חדש'."
        />
      )}

      <Modal
        open={open}
        title={editing ? 'עריכת שדה' : 'שדה סיווג חדש'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="tact-btn tact-btn-ghost" onClick={() => setOpen(false)}>ביטול</button>
            <button className="tact-btn tact-btn-primary" onClick={save}>שמור</button>
          </>
        }
      >
        <Field label="תווית (מה שמוצג למשתמש)">
          <input style={inputStyle} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <Field label="מפתח (אנגלית, ייחודי)" hint="ישמש ב-API. לדוגמה: status, rating">
          <input
            style={inputStyle}
            value={form.key}
            disabled={!!editing}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
          />
        </Field>
        <Field label="סוג השדה">
          <select
            style={inputStyle}
            value={form.field_type}
            onChange={(e) => setForm({ ...form, field_type: e.target.value as FieldType })}
          >
            {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        {isChoice && (
          <Field label="אפשרויות (שורה לכל ערך)">
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              value={form.optionsText}
              onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
            />
          </Field>
        )}
        <Field label="סדר תצוגה">
          <input
            type="number"
            style={inputStyle}
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
          />
        </Field>
        <Field label="חובה">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.is_required}
              onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
            />
            <span style={{ fontSize: '0.9rem' }}>שדה חובה</span>
          </label>
        </Field>
        {saveErr && <div style={{ color: 'var(--color-accent)' }}>{saveErr}</div>}
      </Modal>
    </div>
  )
}
