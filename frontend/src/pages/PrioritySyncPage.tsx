import { useEffect, useMemo, useState } from 'react'
import {
  PrioritySync,
  type PriorityConnection,
  type PriorityField,
  type SystemField,
} from '../lib/api'
import PriorityConnectionCard from '../components/PriorityConnectionCard'
import { inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'
import { useToast } from '../lib/Toast'

// Per-row mapping state, keyed by the Priority field name.
type MapEntry = {
  target_field: string | null
  is_imported: boolean
  label: string | null
  type: string | null
  in_priority: boolean   // false → saved mapping for a field not (re)fetched
}

export default function PrioritySyncPage() {
  const { user } = useAuth()
  const toast = useToast()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [conn, setConn] = useState<PriorityConnection | null>(null)
  const [sysFields, setSysFields] = useState<SystemField[]>([])
  const [fields, setFields] = useState<PriorityField[]>([])
  const [map, setMap] = useState<Record<string, MapEntry>>({})
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [filter, setFilter] = useState('')
  const [onlyMapped, setOnlyMapped] = useState(false)

  function load() {
    if (needsCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      PrioritySync.getConnection(cid),
      PrioritySync.systemFields(cid),
      PrioritySync.mappings(cid),
    ])
      .then(([c, sf, maps]) => {
        setConn(c)
        setSysFields(sf)
        const m: Record<string, MapEntry> = {}
        const f: PriorityField[] = []
        for (const row of maps) {
          m[row.priority_field] = {
            target_field: row.target_field,
            is_imported: row.is_imported,
            label: row.priority_label,
            type: row.priority_type,
            in_priority: false,
          }
          f.push({ name: row.priority_field, type: row.priority_type ?? '', label: row.priority_label ?? row.priority_field })
        }
        setMap(m)
        setFields(f)
      })
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [companyId, user?.role])

  // Pull the live field list from Priority and merge with current mappings.
  async function loadPriorityFields() {
    setFetching(true)
    try {
      const live = await PrioritySync.priorityFields(cid)
      setMap((prev) => {
        const next: Record<string, MapEntry> = {}
        // Carry over saved fields not present in the fresh pull.
        for (const [k, v] of Object.entries(prev)) next[k] = { ...v, in_priority: false }
        for (const pf of live) {
          const existing = prev[pf.name]
          next[pf.name] = {
            target_field: existing?.target_field ?? null,
            is_imported: existing?.is_imported ?? true,
            label: pf.label || pf.name,
            type: pf.type,
            in_priority: true,
          }
        }
        return next
      })
      setFields((prev) => {
        const byName = new Map(prev.map((p) => [p.name, p]))
        for (const pf of live) byName.set(pf.name, pf)
        return Array.from(byName.values())
      })
      toast.success(`נטענו ${live.length} שדות מפריורטי`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setFetching(false)
    }
  }

  function setEntry(name: string, patch: Partial<MapEntry>) {
    setMap((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const rows = fields.map((f, i) => {
        const e = map[f.name]
        return {
          priority_field: f.name,
          priority_label: e?.label ?? f.label,
          priority_type: e?.type ?? f.type,
          target_field: e?.is_imported ? e?.target_field ?? null : null,
          is_imported: e?.is_imported ?? true,
          sort_order: i,
        }
      })
      const saved = await PrioritySync.saveMappings(rows, cid)
      toast.success(`המיפוי נשמר (${saved.length} שדות)`)
      setDirty(false)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  // key → Hebrew label, for rendering the recommended-target hint.
  const sysLabelByKey = useMemo(() => {
    const m: Record<string, string> = {}
    for (const f of sysFields) m[f.key] = f.label
    return m
  }, [sysFields])

  // Apply the curated recommendation as a clean baseline: map the recommended
  // core fields and switch everything else to "do not import".
  function applyRecommended() {
    if (!confirm('להחיל מיפוי מומלץ? פעולה זו תמפה את שדות הליבה המומלצים ותכבה ("לא לקלוט") את שאר השדות. ניתן לשנות ידנית אחר-כך ולשמור.')) return
    setMap((prev) => {
      const next = { ...prev }
      for (const f of fields) {
        const base = prev[f.name] ?? { target_field: null, is_imported: true, label: f.label, type: f.type, in_priority: true }
        const s = f.suggested ?? ''
        next[f.name] = s && s !== '-'
          ? { ...base, target_field: s, is_imported: true }
          : { ...base, target_field: null, is_imported: false }
      }
      return next
    })
    setDirty(true)
    toast.info('הוחל מיפוי מומלץ — עבור על השדות ולחץ "שמירת מיפוי"')
  }

  // Mark every field that has no target as "do not import".
  function skipUnmapped() {
    setMap((prev) => {
      const next = { ...prev }
      for (const f of fields) {
        const e = prev[f.name]
        if (!e?.target_field) {
          next[f.name] = {
            ...(e ?? { target_field: null, is_imported: true, label: f.label, type: f.type, in_priority: true }),
            is_imported: false,
            target_field: null,
          }
        }
      }
      return next
    })
    setDirty(true)
    toast.info('כל השדות הלא-ממופים סומנו כ"לא לקלוט"')
  }

  // Count of fields that are still "to import" but have no target yet.
  const unmappedImportedCount = useMemo(
    () => fields.filter((f) => { const e = map[f.name]; return (e?.is_imported ?? true) && !e?.target_field }).length,
    [fields, map],
  )

  // Apply a single field's recommendation (clicking its hint).
  function applyOne(f: PriorityField) {
    const s = f.suggested ?? ''
    setEntry(f.name, s && s !== '-'
      ? { target_field: s, is_imported: true }
      : { target_field: null, is_imported: false })
  }

  const hasSuggestions = useMemo(() => fields.some((f) => f.suggested), [fields])

  // System fields grouped for the <optgroup> dropdowns.
  const groups = useMemo(() => {
    const g: Record<string, SystemField[]> = {}
    for (const f of sysFields) (g[f.group] ||= []).push(f)
    return g
  }, [sysFields])

  // Filtered view of the (potentially 100+) Priority fields.
  const visibleFields = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return fields.filter((f) => {
      const e = map[f.name]
      if (onlyMapped && !(e?.is_imported && e?.target_field)) return false
      if (!q) return true
      return (
        f.name.toLowerCase().includes(q) ||
        (f.sample ?? '').toLowerCase().includes(q) ||
        (e?.label ?? '').toLowerCase().includes(q)
      )
    })
  }, [fields, map, filter, onlyMapped])

  // Targets already used elsewhere → flag duplicates to the user.
  const usedTargets = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of Object.values(map)) {
      if (e.is_imported && e.target_field) c[e.target_field] = (c[e.target_field] || 0) + 1
    }
    return c
  }, [map])

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי להגדיר סנכרון עם פריורטי</div>
      </div>
    )
  }
  if (loading) return <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>

  const importedCount = Object.values(map).filter((e) => e.is_imported).length

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
          סנכרון עם פריורטי
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
          מיפוי שדות פריורטי לשדות הלקוח במערכת. ניתן לבחור אילו שדות לא לקלוט.
        </div>
      </div>

      <PriorityConnectionCard conn={conn} cid={cid} onSaved={setConn} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <button className="tact-btn tact-btn-ghost" onClick={loadPriorityFields} disabled={fetching || !conn?.base_url}>
            {fetching ? 'טוען שדות…' : '↻ טען שדות מפריורטי'}
          </button>
          {hasSuggestions && (
            <button className="tact-btn tact-btn-ghost" onClick={applyRecommended} title="ממפה את שדות הליבה המומלצים ומכבה את השאר">
              ✨ החל מיפוי מומלץ
            </button>
          )}
          {fields.length > 0 && (
            <button
              className="tact-btn tact-btn-ghost"
              onClick={skipUnmapped}
              disabled={unmappedImportedCount === 0}
              title="מכבה (לא לקלוט) את כל השדות שאין להם שדה יעד"
            >
              ⊘ סמן לא-ממופים כלא לקלוט{unmappedImportedCount ? ` (${unmappedImportedCount})` : ''}
            </button>
          )}
          {fields.length > 0 && (
            <>
              <input
                placeholder="חיפוש שדה / ערך…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ ...inputStyle, maxWidth: 240, padding: '7px 12px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={onlyMapped} onChange={(e) => setOnlyMapped(e.target.checked)} />
                ממופים בלבד
              </label>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>
            {fields.length} שדות · {importedCount} נקלטים
          </span>
          <button className="tact-btn tact-btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'שומר…' : 'שמירת מיפוי'}
          </button>
        </div>
      </div>


      {fields.length === 0 ? (
        <div className="tact-kpi" style={{ textAlign: 'center', padding: 28 }}>
          <div className="tact-kpi-label">
            {conn?.base_url ? "לחץ '↻ טען שדות מפריורטי' כדי לשלוף את רשימת השדות" : 'הגדר חיבור לפריורטי כדי להתחיל'}
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={rowStyle(true)}>
            <div style={{ ...cellPriority, fontWeight: 700 }}>שדה בפריורטי</div>
            <div style={{ width: 30, textAlign: 'center' }}>→</div>
            <div style={{ flex: 1, fontWeight: 700 }}>שדה במערכת שלי</div>
            <div style={{ width: 90, textAlign: 'center', fontWeight: 700 }}>לקלוט?</div>
          </div>
          {visibleFields.length === 0 && (
            <div style={{ padding: 18, textAlign: 'center', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
              אין שדות התואמים לסינון
            </div>
          )}
          {visibleFields.map((f) => {
            const e = map[f.name]
            const imported = e?.is_imported ?? true
            const dup = imported && e?.target_field && usedTargets[e.target_field] > 1
            return (
              <div key={f.name} style={{ ...rowStyle(false), opacity: imported ? 1 : 0.5 }}>
                <div style={cellPriority}>
                  <div style={{ fontFamily: 'var(--font-family-en)', direction: 'ltr', textAlign: 'right', fontWeight: 600 }}>
                    {f.name}
                  </div>
                  {f.description && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text)' }}>{f.description}</div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                    {shortType(f.type)}
                    {f.sample ? <> · דוגמה: {f.sample}</> : ''}
                    {e && !e.in_priority && <span style={{ color: 'var(--color-accent)' }}> · לא נמצא בפריורטי</span>}
                  </div>
                  {renderHint(f, e, sysLabelByKey, () => applyOne(f))}
                </div>
                <div style={{ width: 30, textAlign: 'center', color: 'var(--color-text-light)' }}>→</div>
                <div style={{ flex: 1 }}>
                  <select
                    style={{ ...inputStyle, padding: '7px 10px' }}
                    disabled={!imported}
                    value={e?.target_field ?? ''}
                    onChange={(ev) => setEntry(f.name, { target_field: ev.target.value || null })}
                  >
                    <option value="">— לא ממופה —</option>
                    {Object.entries(groups).map(([g, items]) => (
                      <optgroup key={g} label={g}>
                        {items.map((sf) => (
                          <option key={sf.key} value={sf.key}>{sf.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {dup && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-accent)', marginTop: 2 }}>
                      שדה היעד ממופה גם לשדה אחר
                    </div>
                  )}
                </div>
                <div style={{ width: 90, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={imported}
                    onChange={(ev) => setEntry(f.name, { is_imported: ev.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// A small, clickable "recommended →" hint shown when the current mapping
// differs from the curated recommendation.
function renderHint(
  f: PriorityField,
  e: MapEntry | undefined,
  sysLabelByKey: Record<string, string>,
  onApply: () => void,
) {
  const s = f.suggested ?? ''
  if (!s) return null
  if (s === '-') {
    if (e && e.is_imported === false) return null
    return (
      <button onClick={onApply} style={hintStyle}>
        מומלץ: לא לקלוט
      </button>
    )
  }
  if (e?.is_imported && e?.target_field === s) return null // already as recommended
  return (
    <button onClick={onApply} style={hintStyle}>
      מומלץ → {sysLabelByKey[s] ?? s}
    </button>
  )
}

const hintStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  marginTop: 2,
  font: 'inherit',
  fontSize: '0.72rem',
  color: 'var(--color-primary)',
  cursor: 'pointer',
  textAlign: 'right',
}

const cellPriority: React.CSSProperties = { width: '38%', minWidth: 0 }

function rowStyle(header: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderBottom: '1px solid var(--color-border)',
    background: header ? 'var(--color-surface-2, #f6f3ee)' : 'transparent',
    fontSize: '0.88rem',
  }
}

// "Edm.String" → "טקסט" etc. — a light hint, not exhaustive.
function shortType(t: string): string {
  const x = (t || '').replace('Edm.', '').toLowerCase()
  if (!x) return ''
  if (x.includes('string')) return 'טקסט'
  if (x.includes('int') || x.includes('double') || x.includes('decimal')) return 'מספר'
  if (x.includes('date') || x.includes('time')) return 'תאריך'
  if (x.includes('bool')) return 'כן/לא'
  return x
}
