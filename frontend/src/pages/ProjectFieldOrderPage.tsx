import { useEffect, useState } from 'react'
import { ProjectFieldLabels, type ProjectFieldLabel, type ProjectFieldKind } from '../lib/api'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

// Short badge shown next to each field so the user sees its type at a glance.
const KIND_BADGE: Record<ProjectFieldKind, string> = {
  param: 'פרמטר',
  number: 'מספר',
  flag: 'דגל',
  list: 'רשימה',
}
const KIND_COLOR: Record<ProjectFieldKind, string> = {
  param: '#1f3a5f',
  number: '#0f766e',
  flag: '#b45309',
  list: '#6d28d9',
}
const keyOf = (f: { kind: ProjectFieldKind; idx: number }) => `${f.kind}:${f.idx}`

/** "סדר הצגה" — drag the project fields (params / numbers / flags / lists) into the
 * order they should appear in the project form. Order is saved per-company. */
export default function ProjectFieldOrderPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [items, setItems] = useState<ProjectFieldLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)

  function load() {
    if (needsCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    ProjectFieldLabels.list(cid)
      .then((rows) => setItems([...rows].sort((a, b) => a.sort_order - b.sort_order)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  // Move the dragged field to sit before `targetKey`.
  function reorderTo(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return
    setSaved(false)
    setItems((prev) => {
      const from = prev.findIndex((f) => keyOf(f) === dragKey)
      const to = prev.findIndex((f) => keyOf(f) === targetKey)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await ProjectFieldLabels.reorder(items.map((f) => ({ kind: f.kind, idx: f.idx })), cid)
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
        <div className="tact-kpi-label">בחר חברה כדי לסדר את שדות הפרויקט</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            סדר הצגה
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            גרור כדי לקבוע את הסדר שבו הפרמטרים, המספרים, הדגלים והרשימות יוצגו בכרטיס הפרויקט.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 }}>
          {items.map((f) => {
            const k = keyOf(f)
            const dragging = k === dragKey
            return (
              <div
                key={k}
                draggable
                onDragStart={() => setDragKey(k)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => {
                  e.preventDefault()
                  reorderTo(k)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-white)',
                  opacity: dragging ? 0.4 : 1,
                  cursor: 'grab',
                  boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
                }}
              >
                <span style={{ color: 'var(--color-text-light)', fontSize: '1.1rem', lineHeight: 1 }}>⠿</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#fff',
                    background: KIND_COLOR[f.kind],
                    borderRadius: 6,
                    padding: '2px 8px',
                    minWidth: 48,
                    textAlign: 'center',
                  }}
                >
                  {KIND_BADGE[f.kind]}
                </span>
                <span style={{ flex: 1, fontSize: '0.92rem', fontWeight: 500 }}>{f.label}</span>
                {!f.is_active && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>לא בשימוש</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
