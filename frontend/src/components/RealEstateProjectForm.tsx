import { type Dispatch, type SetStateAction } from 'react'
import { Field, inputStyle } from './Modal'
import type {
  RealEstateProject,
  RealEstateProjectInput,
  RealEstateProjectFieldLabel,
  RealEstateProjectFieldKind,
} from '../lib/api'

export const PARAM_COUNT = 15
export const NUM_COUNT = 15
export const FLAG_COUNT = 5
export const LIST_COUNT = 10

const DEFAULT_LABEL: Record<RealEstateProjectFieldKind, string> = {
  param: 'פרמטר',
  number: 'מספר',
  flag: 'דגל',
  list: 'רשימה',
}

export type RealEstateProjectForm = {
  project_number: string
  name: string
  description: string
  customer_membership_id: number | null
  notes: string
  creation_date: string
  params: string[]
  numbers: string[] // kept as strings for the inputs; coerced on submit
  flags: boolean[]
  lists: string[]
}

export const EMPTY_PROJECT: RealEstateProjectForm = {
  project_number: '',
  name: '',
  description: '',
  customer_membership_id: null,
  notes: '',
  creation_date: '',
  params: Array(PARAM_COUNT).fill(''),
  numbers: Array(NUM_COUNT).fill(''),
  flags: Array(FLAG_COUNT).fill(false),
  lists: Array(LIST_COUNT).fill(''),
}

export function formFromProject(p: RealEstateProject): RealEstateProjectForm {
  return {
    project_number: p.project_number || '',
    name: p.name,
    description: p.description || '',
    customer_membership_id: p.customer_membership_id,
    notes: p.notes || '',
    creation_date: p.creation_date || '',
    params: Array(PARAM_COUNT).fill('').map((_, i) => p.params?.[i] ?? ''),
    numbers: Array(NUM_COUNT).fill('').map((_, i) => (p.numbers?.[i] ?? '') === null ? '' : String(p.numbers?.[i] ?? '')),
    flags: Array(FLAG_COUNT).fill(false).map((_, i) => p.flags?.[i] ?? false),
    lists: Array(LIST_COUNT).fill('').map((_, i) => p.lists?.[i] ?? ''),
  }
}

export function toBody(f: RealEstateProjectForm): RealEstateProjectInput {
  return {
    project_number: f.project_number || null,
    name: f.name,
    description: f.description || null,
    customer_membership_id: f.customer_membership_id,
    notes: f.notes || null,
    creation_date: f.creation_date || null,
    params: f.params.map((p) => p || null),
    numbers: f.numbers.map((n) => (n.trim() === '' ? null : Number(n))),
    flags: f.flags,
    lists: f.lists.map((v) => v || null),
  }
}

type Props = {
  form: RealEstateProjectForm
  setForm: Dispatch<SetStateAction<RealEstateProjectForm>>
  fieldLabels: RealEstateProjectFieldLabel[]
  customerOptions: { membership_id: number; full_name: string }[]
}

const sectionStyle = { borderTop: '1px solid var(--color-border)', margin: '2px 0 8px', paddingTop: 8 }
const titleStyle = { fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }

export default function RealEstateProjectForm({ form, setForm, fieldLabels, customerOptions }: Props) {
  const set = (patch: Partial<RealEstateProjectForm>) => setForm((f) => ({ ...f, ...patch }))

  // Fields shown in the company's chosen display order; only "in use" ones render.
  const ordered = [...fieldLabels]
    .filter((l) => l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  // Render one field according to its kind; `i` is the 0-based array index.
  const renderField = (l: RealEstateProjectFieldLabel) => {
    const i = l.idx - 1
    const label = l.label || `${DEFAULT_LABEL[l.kind]} ${l.idx}`
    if (l.kind === 'param') {
      return (
        <Field key={`param-${i}`} label={label}>
          <input
            style={inputStyle}
            value={form.params[i] ?? ''}
            onChange={(e) => setForm((f) => {
              const params = [...f.params]; params[i] = e.target.value; return { ...f, params }
            })}
          />
        </Field>
      )
    }
    if (l.kind === 'number') {
      return (
        <Field key={`number-${i}`} label={label}>
          <input
            type="number"
            style={inputStyle}
            value={form.numbers[i] ?? ''}
            onChange={(e) => setForm((f) => {
              const numbers = [...f.numbers]; numbers[i] = e.target.value; return { ...f, numbers }
            })}
          />
        </Field>
      )
    }
    if (l.kind === 'flag') {
      return (
        <Field key={`flag-${i}`} label={label}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40 }}>
            <input
              type="checkbox"
              checked={form.flags[i] ?? false}
              onChange={(e) => setForm((f) => {
                const flags = [...f.flags]; flags[i] = e.target.checked; return { ...f, flags }
              })}
            />
            <span style={{ fontSize: '0.9rem' }}>{form.flags[i] ? 'כן' : 'לא'}</span>
          </label>
        </Field>
      )
    }
    // list
    const options = l.options ?? []
    const val = form.lists[i] ?? ''
    const extra = val && !options.includes(val) ? [val] : []
    return (
      <Field key={`list-${i}`} label={label}>
        <select
          style={inputStyle}
          value={val}
          onChange={(e) => setForm((f) => {
            const lists = [...f.lists]; lists[i] = e.target.value; return { ...f, lists }
          })}
        >
          <option value="">— בחר —</option>
          {[...options, ...extra].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>
    )
  }

  return (
    <>
      {/* Basic data */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="מספר פרויקט" hint="ריק → מספור אוטומטי (רץ פר-חברה)">
          <input style={inputStyle} value={form.project_number} onChange={(e) => set({ project_number: e.target.value })} />
        </Field>
        <Field label="שם הפרויקט">
          <input style={inputStyle} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="לקוח מקושר">
          <select
            style={inputStyle}
            value={form.customer_membership_id ?? ''}
            onChange={(e) => set({ customer_membership_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— ללא —</option>
            {customerOptions.map((o) => (
              <option key={o.membership_id} value={o.membership_id}>{o.full_name}</option>
            ))}
          </select>
        </Field>
        <Field label="תאריך יצירה" hint="ברירת מחדל: היום. ניתן לשנות.">
          <input type="date" style={inputStyle} value={form.creation_date} onChange={(e) => set({ creation_date: e.target.value })} />
        </Field>
      </div>
      <Field label="תיאור הפרויקט">
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      <Field label="הערות">
        <textarea
          style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>

      {/* Custom fields, rendered in the company's chosen display order. */}
      {ordered.length > 0 && (
        <div style={sectionStyle}>
          <div style={titleStyle}>שדות הפרויקט</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ordered.map(renderField)}
          </div>
        </div>
      )}
    </>
  )
}
