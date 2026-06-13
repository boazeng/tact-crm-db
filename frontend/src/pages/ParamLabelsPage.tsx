import { useEffect, useState } from 'react'
import { ParamLabels, NumberLabels, FlagLabels, ListFields } from '../lib/api'
import { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

const PARAM_COUNT = 15
const NUM_COUNT = 15
const FLAG_COUNT = 5
const LIST_COUNT = 10

type Item = { label: string; is_active: boolean }       // text/number/flag slot
type ListItem = Item & { optionsText: string }          // list slot also has options

const blank = (n: number): Item[] => Array.from({ length: n }, () => ({ label: '', is_active: true }))
const blankLists = (n: number): ListItem[] =>
  Array.from({ length: n }, () => ({ label: '', is_active: true, optionsText: '' }))

/** Manage the company's customer field names: 15 params, 15 numbers, 5 flags,
 * 10 lists — each with a "בשימוש" toggle (off → hidden in the customer card). */
export default function ParamLabelsPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [params, setParams] = useState<Item[]>(blank(PARAM_COUNT))
  const [numbers, setNumbers] = useState<Item[]>(blank(NUM_COUNT))
  const [flags, setFlags] = useState<Item[]>(blank(FLAG_COUNT))
  const [lists, setLists] = useState<ListItem[]>(blankLists(LIST_COUNT))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    if (needsCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([ParamLabels.list(cid), NumberLabels.list(cid), FlagLabels.list(cid), ListFields.list(cid)])
      .then(([prows, nrows, frows, lrows]) => {
        setParams(prows.map((r) => ({ label: r.label === `פרמטר ${r.param_index}` ? '' : r.label, is_active: r.is_active })))
        setNumbers(nrows.map((r) => ({ label: r.label === `מספר ${r.num_index}` ? '' : r.label, is_active: r.is_active })))
        setFlags(frows.map((r) => ({ label: r.label === `דגל ${r.flag_index}` ? '' : r.label, is_active: r.is_active })))
        setLists(lrows.map((r) => ({
          label: r.label === `רשימה ${r.list_index}` ? '' : r.label,
          is_active: r.is_active,
          optionsText: (r.options || []).join('\n'),
        })))
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  const patchItem = (
    setter: React.Dispatch<React.SetStateAction<Item[]>>, i: number, p: Partial<Item>,
  ) => { setSaved(false); setter((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...p } : x))) }
  const patchList = (i: number, p: Partial<ListItem>) => {
    setSaved(false); setLists((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...p } : x)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await Promise.all([
        ParamLabels.update(params.map((it, i) => ({ param_index: i + 1, label: it.label.trim(), is_active: it.is_active })), cid),
        NumberLabels.update(numbers.map((it, i) => ({ num_index: i + 1, label: it.label.trim(), is_active: it.is_active })), cid),
        FlagLabels.update(flags.map((it, i) => ({ flag_index: i + 1, label: it.label.trim(), is_active: it.is_active })), cid),
        ListFields.update(lists.map((it, i) => ({
          list_index: i + 1,
          label: it.label.trim(),
          is_active: it.is_active,
          options: it.optionsText.split('\n').map((s) => s.trim()).filter(Boolean),
        })), cid),
      ])
      setSaved(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לנהל שמות פרמטרים</div>
      </div>
    )
  }

  // Small "in use" checkbox next to each field.
  const useBox = (it: Item, onToggle: (v: boolean) => void) => (
    <label
      title="האם השדה בשימוש (יוצג בכרטיס הלקוח)"
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}
    >
      <input type="checkbox" checked={it.is_active} onChange={(e) => onToggle(e.target.checked)} />
      בשימוש
    </label>
  )

  const simpleSection = (
    title: string, items: Item[], setter: React.Dispatch<React.SetStateAction<Item[]>>, def: string,
  ) => (
    <div style={{ borderTop: '1px solid var(--color-border)', margin: '18px 0 12px', paddingTop: 14 }}>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {items.map((it, i) => (
          <Field key={i} label={`${def} ${i + 1}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={it.label}
                placeholder={`${def} ${i + 1}`}
                onChange={(e) => patchItem(setter, i, { label: e.target.value })}
              />
              {useBox(it, (v) => patchItem(setter, i, { is_active: v }))}
            </div>
          </Field>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>שמות פרמטרים</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            שמות השדות שיוצגו בכרטיס הלקוח. כבה "בשימוש" כדי להסתיר שדה. השאר שם ריק לברירת מחדל.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span className="tact-badge tact-badge-pos">נשמר ✓</span>}
          <button onClick={save} className="tact-btn tact-btn-primary" disabled={saving || loading}>
            {saving ? 'שומר…' : 'שמור'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <>
          {simpleSection('פרמטרים', params, setParams, 'פרמטר')}
          {simpleSection('מספרים', numbers, setNumbers, 'מספר')}
          {simpleSection('דגלים (כן/לא)', flags, setFlags, 'דגל')}

          <div style={{ borderTop: '1px solid var(--color-border)', margin: '18px 0 12px', paddingTop: 14 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>רשימות</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: 10 }}>
              לכל רשימה: שם, תיבת "בשימוש", ותחתיו האפשרויות — ערך אחד בכל שורה.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {lists.map((it, i) => (
                <div key={i}>
                  <Field label={`רשימה ${i + 1} — שם`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={it.label}
                        placeholder={`רשימה ${i + 1}`}
                        onChange={(e) => patchList(i, { label: e.target.value })}
                      />
                      {useBox(it, (v) => patchList(i, { is_active: v }))}
                    </div>
                  </Field>
                  <Field label="אפשרויות (שורה לכל ערך)">
                    <textarea
                      style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                      value={it.optionsText}
                      onChange={(e) => patchList(i, { optionsText: e.target.value })}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
