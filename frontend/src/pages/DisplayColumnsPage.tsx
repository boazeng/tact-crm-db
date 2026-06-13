import { useEffect, useState } from 'react'
import {
  DisplayColumns,
  ParamLabels,
  FlagLabels,
  ListFields,
  type ColumnKind,
} from '../lib/api'
import { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

const SLOTS = 3
type Option = { value: string; label: string; group: string }

/** Choose up to 3 customer fields (param / flag / list) to show as columns in
 * the main customers table. */
export default function DisplayColumnsPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [options, setOptions] = useState<Option[]>([])
  // Each slot holds an encoded "kind:index" value, or '' for none.
  const [picked, setPicked] = useState<string[]>(Array(SLOTS).fill(''))
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
    Promise.all([
      DisplayColumns.list(cid),
      ParamLabels.list(cid),
      FlagLabels.list(cid),
      ListFields.list(cid),
    ])
      .then(([cols, params, flags, lists]) => {
        const opts: Option[] = [
          ...params.map((p) => ({ value: `param:${p.param_index}`, label: p.label, group: 'פרמטרים' })),
          ...flags.map((f) => ({ value: `flag:${f.flag_index}`, label: f.label, group: 'דגלים' })),
          ...lists.map((l) => ({ value: `list:${l.list_index}`, label: l.label, group: 'רשימות' })),
        ]
        setOptions(opts)
        const next = Array(SLOTS).fill('')
        cols.slice(0, SLOTS).forEach((c, i) => {
          next[i] = `${c.kind}:${c.ref_index}`
        })
        setPicked(next)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  function setAt(i: number, v: string) {
    setSaved(false)
    setPicked((prev) => prev.map((x, idx) => (idx === i ? v : x)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const columns = picked
        .filter(Boolean)
        .map((v) => {
          const [kind, idx] = v.split(':')
          return { kind: kind as ColumnKind, ref_index: Number(idx) }
        })
      await DisplayColumns.update(columns, cid)
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
        <div className="tact-kpi-label">בחר חברה כדי להגדיר עמודות</div>
      </div>
    )
  }

  // Group options for the <optgroup>s.
  const groups = ['פרמטרים', 'דגלים', 'רשימות']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            עמודות בטבלת הלקוחות
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            בחר עד 3 שדות (פרמטר, דגל או רשימה) שיוצגו כעמודות בעמוד הראשי של הלקוחות.
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, maxWidth: 460 }}>
          {picked.map((val, i) => (
            <Field key={i} label={`עמודה ${i + 1}`}>
              <select style={inputStyle} value={val} onChange={(e) => setAt(i, e.target.value)}>
                <option value="">— ללא —</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {options
                      .filter((o) => o.group === g)
                      .map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          ))}
        </div>
      )}
    </div>
  )
}
