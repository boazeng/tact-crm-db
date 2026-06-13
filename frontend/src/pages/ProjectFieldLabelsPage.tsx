import { useEffect, useState } from 'react'
import { ProjectFieldLabels, type ProjectFieldKind } from '../lib/api'
import { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

type Item = { kind: ProjectFieldKind; idx: number; label: string; optionsText: string; is_active: boolean }

const SECTIONS: { kind: ProjectFieldKind; title: string }[] = [
  { kind: 'param', title: 'פרמטרים' },
  { kind: 'number', title: 'מספרים' },
  { kind: 'flag', title: 'דגלים' },
  { kind: 'list', title: 'רשימות' },
]
const DEFAULT_LABEL: Record<ProjectFieldKind, string> = {
  param: 'פרמטר', number: 'מספר', flag: 'דגל', list: 'רשימה',
}

/** Rename a company's project fields (and set the options for list fields). */
export default function ProjectFieldLabelsPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [items, setItems] = useState<Item[]>([])
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
    ProjectFieldLabels.list(cid)
      .then((rows) => {
        setItems(
          rows.map((r) => ({
            kind: r.kind,
            idx: r.idx,
            // blank when it's the default, so it reads as a placeholder
            label: r.label === `${DEFAULT_LABEL[r.kind]} ${r.idx}` ? '' : r.label,
            optionsText: (r.options || []).join('\n'),
            is_active: r.is_active,
          })),
        )
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  function patch(kind: ProjectFieldKind, idx: number, p: Partial<Item>) {
    setSaved(false)
    setItems((prev) => prev.map((it) => (it.kind === kind && it.idx === idx ? { ...it, ...p } : it)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const labels = items.map((it) => ({
        kind: it.kind,
        idx: it.idx,
        label: it.label.trim(),
        options: it.kind === 'list'
          ? it.optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
          : [],
        is_active: it.is_active,
      }))
      await ProjectFieldLabels.update(labels, cid)
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
        <div className="tact-kpi-label">בחר חברה כדי לנהל שדות פרויקט</div>
      </div>
    )
  }

  const of = (kind: ProjectFieldKind) => items.filter((it) => it.kind === kind)

  // Small "in use" checkbox shown next to each field; off → hidden in the form.
  const useBox = (it: Item) => (
    <label
      title="האם השדה בשימוש (יוצג בכרטיס הפרויקט)"
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}
    >
      <input
        type="checkbox"
        checked={it.is_active}
        onChange={(e) => patch(it.kind, it.idx, { is_active: e.target.checked })}
      />
      בשימוש
    </label>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            שדות פרויקט
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            שמות השדות שיוצגו בכרטיס הפרויקט. לרשימות — הגדר גם את האפשרויות (ערך בכל שורה). השאר ריק לברירת מחדל.
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
        SECTIONS.map((sec) => (
          <div key={sec.kind} style={{ borderTop: '1px solid var(--color-border)', margin: '14px 0 10px', paddingTop: 12 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>
              {sec.title}
            </div>
            {sec.kind === 'list' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {of('list').map((it) => (
                  <div key={it.idx}>
                    <Field label={`רשימה ${it.idx} — שם`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={it.label}
                          placeholder={`רשימה ${it.idx}`}
                          onChange={(e) => patch('list', it.idx, { label: e.target.value })}
                        />
                        {useBox(it)}
                      </div>
                    </Field>
                    <Field label="אפשרויות (שורה לכל ערך)">
                      <textarea
                        style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                        value={it.optionsText}
                        onChange={(e) => patch('list', it.idx, { optionsText: e.target.value })}
                      />
                    </Field>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {of(sec.kind).map((it) => (
                  <Field key={it.idx} label={`${DEFAULT_LABEL[sec.kind]} ${it.idx}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={it.label}
                        placeholder={`${DEFAULT_LABEL[sec.kind]} ${it.idx}`}
                        onChange={(e) => patch(sec.kind, it.idx, { label: e.target.value })}
                      />
                      {useBox(it)}
                    </div>
                  </Field>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
