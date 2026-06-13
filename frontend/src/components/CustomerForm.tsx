import { useState, type Dispatch, type SetStateAction } from 'react'
import { Field, inputStyle } from './Modal'
import type { Customer, CustomerInput, FieldDefinition } from '../lib/api'

export const PARAM_COUNT = 15
export const NUM_COUNT = 15
export const FLAG_COUNT = 5
export const LIST_COUNT = 10

export const STATUS_OPTIONS = [
  { v: 'lead', l: 'ליד' },
  { v: 'active', l: 'פעיל' },
  { v: 'inactive', l: 'לא פעיל' },
]
export const STATUS_LABEL: Record<string, string> = {
  lead: 'ליד',
  active: 'פעיל',
  inactive: 'לא פעיל',
}

// Suggested roles (תפקיד). The picker is a real <select>; "אחר" reveals a free-text field.
export const ROLE_OPTIONS = ['דייר', 'ועד בית', 'בעלים']
const ROLE_OTHER = '__other__'

export type LinkForm = { linked_membership_id: number; role: string }

export type CoreForm = {
  customer_number: string
  full_name: string
  customer_type: string
  company_name: string
  national_id: string
  nickname: string
  role: string
  street1: string
  city1: string
  street2: string
  city2: string
  phone: string
  email: string
  allow_mailing: boolean
  notes: string
  status: string
  params: string[]
  numbers: string[]
  flags: boolean[]
  lists: string[]
  is_paying: boolean
  paid_by_membership_id: number | null
  links: LinkForm[]
}

export const EMPTY_CORE: CoreForm = {
  customer_number: '',
  full_name: '',
  customer_type: 'person',
  company_name: '',
  national_id: '',
  nickname: '',
  role: '',
  street1: '',
  city1: '',
  street2: '',
  city2: '',
  phone: '',
  email: '',
  allow_mailing: true,
  notes: '',
  status: 'active',
  params: Array(PARAM_COUNT).fill(''),
  numbers: Array(NUM_COUNT).fill(''),
  flags: Array(FLAG_COUNT).fill(false),
  lists: Array(LIST_COUNT).fill(''),
  is_paying: true,
  paid_by_membership_id: null,
  links: [],
}

export function coreFromCustomer(c: Customer): CoreForm {
  return {
    customer_number: c.customer_number || '',
    full_name: c.full_name,
    customer_type: c.customer_type,
    company_name: c.company_name || '',
    national_id: c.national_id || '',
    nickname: c.nickname || '',
    role: c.role || '',
    street1: c.street1 || '',
    city1: c.city1 || '',
    street2: c.street2 || '',
    city2: c.city2 || '',
    phone: c.phone || '',
    email: c.email || '',
    allow_mailing: c.allow_mailing,
    notes: c.notes || '',
    status: c.status,
    params: Array(PARAM_COUNT)
      .fill('')
      .map((_, i) => c.params[i] ?? ''),
    numbers: Array(NUM_COUNT)
      .fill('')
      .map((_, i) => (c.numbers?.[i] ?? null) === null ? '' : String(c.numbers?.[i])),
    flags: Array(FLAG_COUNT)
      .fill(false)
      .map((_, i) => c.flags?.[i] ?? false),
    lists: Array(LIST_COUNT)
      .fill('')
      .map((_, i) => c.lists?.[i] ?? ''),
    is_paying: c.is_paying,
    paid_by_membership_id: c.paid_by_membership_id,
    links: (c.links || []).map((l) => ({
      linked_membership_id: l.linked_membership_id,
      role: l.role || '',
    })),
  }
}

export function toBody(core: CoreForm, fieldVals: Record<string, unknown>): CustomerInput {
  return {
    customer_number: core.customer_number || null,
    full_name: core.full_name,
    customer_type: core.customer_type,
    company_name: core.customer_type === 'organization' ? core.company_name || null : null,
    national_id: core.national_id || null,
    nickname: core.nickname || null,
    role: core.role || null,
    street1: core.street1 || null,
    city1: core.city1 || null,
    street2: core.street2 || null,
    city2: core.city2 || null,
    phone: core.phone || null,
    email: core.email || null,
    allow_mailing: core.allow_mailing,
    notes: core.notes || null,
    params: core.params.map((p) => p || null),
    numbers: core.numbers.map((n) => (n.trim() === '' ? null : Number(n))),
    flags: core.flags,
    lists: core.lists.map((v) => v || null),
    status: core.status,
    is_paying: core.is_paying,
    paid_by_membership_id: core.is_paying ? null : core.paid_by_membership_id,
    links: core.links
      .filter((l) => l.linked_membership_id)
      .map((l) => ({ linked_membership_id: l.linked_membership_id, role: l.role || null })),
    fields: fieldVals,
  }
}

export function DynamicField({
  def,
  value,
  onChange,
}: {
  def: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (def.field_type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span style={{ fontSize: '0.9rem' }}>כן</span>
      </label>
    )
  }
  if (def.field_type === 'select') {
    return (
      <select style={inputStyle} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">— בחר —</option>
        {(def.options || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    )
  }
  if (def.field_type === 'multiselect') {
    const arr = Array.isArray(value) ? (value as string[]) : []
    const toggle = (o: string) =>
      onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {(def.options || []).map((o) => (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
            <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} />
            {o}
          </label>
        ))}
      </div>
    )
  }
  const type = def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text'
  return (
    <input
      type={type}
      style={inputStyle}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(def.field_type === 'number' ? Number(e.target.value) : e.target.value)}
    />
  )
}

type Props = {
  core: CoreForm
  setCore: Dispatch<SetStateAction<CoreForm>>
  defs: FieldDefinition[]
  fieldVals: Record<string, unknown>
  setFieldVals: Dispatch<SetStateAction<Record<string, unknown>>>
  /** Other customers of this company, for the paid-by / linked-customers pickers. */
  linkOptions: { membership_id: number; full_name: string }[]
  /** Role (תפקיד) suggestions for the company; falls back to the built-in defaults. */
  roleOptions?: string[]
  /** Per-company config for the fixed params/numbers/flags/lists. Each carries a
   * label and is_active; inactive fields are hidden. */
  paramLabels?: { label: string; is_active: boolean }[]
  numberLabels?: { label: string; is_active: boolean }[]
  flagLabels?: { label: string; is_active: boolean }[]
  listFields?: { label: string; options: string[]; is_active: boolean }[]
}

const disabledStyle = { ...inputStyle, background: '#EFEDE7', color: '#9A9286', cursor: 'not-allowed' }

export default function CustomerForm({
  core,
  setCore,
  defs,
  fieldVals,
  setFieldVals,
  linkOptions,
  roleOptions = ROLE_OPTIONS,
  paramLabels,
  numberLabels,
  flagLabels,
  listFields,
}: Props) {
  const set = (patch: Partial<CoreForm>) => setCore((c) => ({ ...c, ...patch }))
  const isOrg = core.customer_type === 'organization'
  const nameOf = (id: number) => linkOptions.find((o) => o.membership_id === id)?.full_name || ''
  // A configurable field is shown only when it's "in use" (default active).
  const active = (cfg: { is_active: boolean } | undefined) => cfg?.is_active ?? true

  // Role picker: a real <select>; a custom value (or choosing "אחר") shows a text input.
  const [roleOther, setRoleOther] = useState(false)
  const showRoleText = roleOther || (!!core.role && !roleOptions.includes(core.role))

  // "האם מקושר" — derived flag: is this customer linked to any other?
  const isLinked = core.links.some((l) => l.linked_membership_id)

  function addLink() {
    setCore((c) => ({ ...c, links: [...c.links, { linked_membership_id: 0, role: '' }] }))
  }
  function setLink(i: number, patch: Partial<LinkForm>) {
    setCore((c) => {
      const links = c.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
      return { ...c, links }
    })
  }
  function removeLink(i: number) {
    setCore((c) => ({ ...c, links: c.links.filter((_, idx) => idx !== i) }))
  }

  return (
    <>
      {/* Status + mailing — label and answer on the same line. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-light)' }}>פעיל</span>
          <input
            type="checkbox"
            disabled={core.status === 'lead'}
            checked={core.status === 'active'}
            onChange={(e) => set({ status: e.target.checked ? 'active' : 'inactive' })}
          />
          <span style={{ fontSize: '0.9rem' }}>{core.status === 'active' ? 'כן' : 'לא'}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-light)' }}>ליד</span>
          <input
            type="checkbox"
            checked={core.status === 'lead'}
            onChange={(e) => set({ status: e.target.checked ? 'lead' : 'active' })}
          />
          <span style={{ fontSize: '0.9rem' }}>{core.status === 'lead' ? 'כן' : 'לא'}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-light)' }}>דיוור</span>
          <input
            type="checkbox"
            checked={core.allow_mailing}
            onChange={(e) => set({ allow_mailing: e.target.checked })}
          />
          <span style={{ fontSize: '0.9rem' }}>{core.allow_mailing ? 'כן' : 'לא'}</span>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Field label="מספר לקוח" hint="ייחודי בכל המערכת">
          <input style={inputStyle} value={core.customer_number} onChange={(e) => set({ customer_number: e.target.value })} />
        </Field>
        <Field label="שם לקוח">
          <input style={inputStyle} value={core.full_name} onChange={(e) => set({ full_name: e.target.value })} />
        </Field>
        <Field label="סוג לקוח">
          <select style={inputStyle} value={core.customer_type} onChange={(e) => set({ customer_type: e.target.value })}>
            <option value="person">פרטי</option>
            <option value="organization">חברה</option>
            <option value="authorized_dealer">עוסק מורשה</option>
          </select>
        </Field>
        <Field label="כינוי">
          <input style={inputStyle} value={core.nickname} onChange={(e) => set({ nickname: e.target.value })} />
        </Field>
        <Field label="שם החברה" hint={isOrg ? undefined : 'רק עבור חברה'}>
          <input
            style={isOrg ? inputStyle : disabledStyle}
            value={isOrg ? core.company_name : ''}
            disabled={!isOrg}
            placeholder={isOrg ? '' : '—'}
            onChange={(e) => set({ company_name: e.target.value })}
          />
        </Field>
        <Field label="ת.ז/ח.פ./עוסק מורשה">
          <input style={inputStyle} value={core.national_id} onChange={(e) => set({ national_id: e.target.value })} />
        </Field>
        <Field label="תפקיד" hint="בחר מהרשימה או 'אחר' להקלדה חופשית">
          <select
            style={inputStyle}
            value={showRoleText ? ROLE_OTHER : core.role}
            onChange={(e) => {
              if (e.target.value === ROLE_OTHER) {
                setRoleOther(true)
                if (roleOptions.includes(core.role)) set({ role: '' })
              } else {
                setRoleOther(false)
                set({ role: e.target.value })
              }
            }}
          >
            <option value="">— בחר תפקיד —</option>
            {roleOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
            <option value={ROLE_OTHER}>אחר…</option>
          </select>
          {showRoleText && (
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="הקלד תפקיד"
              value={core.role}
              onChange={(e) => set({ role: e.target.value })}
            />
          )}
        </Field>
        <Field label="טלפון">
          <input style={inputStyle} value={core.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="אימייל">
          <input style={inputStyle} value={core.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </div>

      {/* Addresses — each רחוב/עיר pair on its own line. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="רחוב 1">
          <input style={inputStyle} value={core.street1} onChange={(e) => set({ street1: e.target.value })} />
        </Field>
        <Field label="עיר 1">
          <input style={inputStyle} value={core.city1} onChange={(e) => set({ city1: e.target.value })} />
        </Field>
        <Field label="רחוב 2">
          <input style={inputStyle} value={core.street2} onChange={(e) => set({ street2: e.target.value })} />
        </Field>
        <Field label="עיר 2">
          <input style={inputStyle} value={core.city2} onChange={(e) => set({ city2: e.target.value })} />
        </Field>
      </div>

      <Field label="משלם">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
          <input type="checkbox" checked={core.is_paying} onChange={(e) => set({ is_paying: e.target.checked })} />
          <span style={{ fontSize: '0.9rem' }}>{core.is_paying ? 'כן' : 'לא'}</span>
        </label>
      </Field>

      <Field label="הערות">
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={core.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>

      {/* Text params — only fields "in use" are shown. */}
      {core.params.some((_, i) => active(paramLabels?.[i])) && (
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0 8px', paddingTop: 8 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>פרמטרים</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {core.params.map((val, i) =>
              !active(paramLabels?.[i]) ? null : (
                <Field key={i} label={paramLabels?.[i]?.label || `פרמטר ${i + 1}`}>
                  <input
                    style={inputStyle}
                    value={val}
                    onChange={(e) => setCore((c) => {
                      const params = [...c.params]; params[i] = e.target.value; return { ...c, params }
                    })}
                  />
                </Field>
              ),
            )}
          </div>
        </div>
      )}

      {/* Numeric params */}
      {core.numbers.some((_, i) => active(numberLabels?.[i])) && (
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0 8px', paddingTop: 8 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>מספרים</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {core.numbers.map((val, i) =>
              !active(numberLabels?.[i]) ? null : (
                <Field key={i} label={numberLabels?.[i]?.label || `מספר ${i + 1}`}>
                  <input
                    type="number"
                    style={inputStyle}
                    value={val}
                    onChange={(e) => setCore((c) => {
                      const numbers = [...c.numbers]; numbers[i] = e.target.value; return { ...c, numbers }
                    })}
                  />
                </Field>
              ),
            )}
          </div>
        </div>
      )}

      {/* Yes/no flags (דגלים) */}
      {core.flags.some((_, i) => active(flagLabels?.[i])) && (
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0 8px', paddingTop: 8 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>דגלים</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center' }}>
            {core.flags.map((val, i) =>
              !active(flagLabels?.[i]) ? null : (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-light)' }}>
                    {flagLabels?.[i]?.label || `דגל ${i + 1}`}
                  </span>
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => setCore((c) => {
                      const flags = [...c.flags]; flags[i] = e.target.checked; return { ...c, flags }
                    })}
                  />
                  <span style={{ fontSize: '0.9rem' }}>{val ? 'כן' : 'לא'}</span>
                </label>
              ),
            )}
          </div>
        </div>
      )}

      {/* Single-choice list fields (רשימות) */}
      {core.lists.some((_, i) => active(listFields?.[i])) && (
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0 8px', paddingTop: 8 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>רשימות</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {core.lists.map((val, i) => {
              if (!active(listFields?.[i])) return null
              const cfg = listFields?.[i]
              const options = cfg?.options ?? []
              const extra = val && !options.includes(val) ? [val] : []
              return (
                <Field key={i} label={cfg?.label || `רשימה ${i + 1}`}>
                  <select
                    style={inputStyle}
                    value={val}
                    onChange={(e) => setCore((c) => {
                      const lists = [...c.lists]; lists[i] = e.target.value; return { ...c, lists }
                    })}
                  >
                    <option value="">— בחר —</option>
                    {[...options, ...extra].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              )
            })}
          </div>
        </div>
      )}

      {defs.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0 8px', paddingTop: 8 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 6 }}>
            סיווגים מותאמים-אישית
          </div>
          {defs.map((d) => (
            <Field key={d.id} label={d.label + (d.is_required ? ' *' : '')}>
              <DynamicField
                def={d}
                value={fieldVals[d.key]}
                onChange={(v) => setFieldVals((p) => ({ ...p, [d.key]: v }))}
              />
            </Field>
          ))}
        </div>
      )}

      {/* Linked customers — at the very bottom. */}
      <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0 4px', paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            לקוחות מקושרים
          </div>
          <button type="button" className="tact-btn tact-btn-ghost" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={addLink}>
            + הוסף קישור
          </button>
        </div>
        {/* "האם מקושר" — derived yes/no flag, reflects whether any link exists. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-light)' }}>האם מקושר</span>
          <span className={`tact-badge ${isLinked ? 'tact-badge-pos' : 'tact-badge-soon'}`}>
            {isLinked ? 'כן' : 'לא'}
          </span>
        </div>
        {core.links.length === 0 && (
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>אין לקוחות מקושרים.</div>
        )}
        {core.links.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select
              style={inputStyle}
              value={l.linked_membership_id || ''}
              onChange={(e) => setLink(i, { linked_membership_id: e.target.value ? Number(e.target.value) : 0 })}
            >
              <option value="">— בחר לקוח —</option>
              {linkOptions.map((o) => (
                <option key={o.membership_id} value={o.membership_id}>{o.full_name}</option>
              ))}
            </select>
            <input
              style={inputStyle}
              placeholder="תפקיד (למשל: ועד בית)"
              value={l.role}
              onChange={(e) => setLink(i, { role: e.target.value })}
            />
            <button type="button" className="tact-btn tact-btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-accent)' }} onClick={() => removeLink(i)}>
              הסר
            </button>
          </div>
        ))}
        {core.links.some((l) => l.linked_membership_id) && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 6 }}>
            מקושרים: {core.links.filter((l) => l.linked_membership_id).map((l) => `${nameOf(l.linked_membership_id)}${l.role ? ` (${l.role})` : ''}`).join(' · ')}
          </div>
        )}
      </div>
    </>
  )
}
