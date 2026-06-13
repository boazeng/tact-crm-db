import { useEffect, useState } from 'react'
import { ApiKeys, type ApiKeyRow } from '../lib/api'
import DataTable from '../components/DataTable'
import Modal, { Field, inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

export default function ApiKeysPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [rows, setRows] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  function load() {
    if (needsCompany) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    ApiKeys.list(cid)
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  async function create() {
    setSaveErr(null)
    try {
      const res = await ApiKeys.create(label, cid)
      setOpen(false)
      setLabel('')
      setCreatedKey(res.raw_key)
      load()
    } catch (e) {
      setSaveErr(String(e))
    }
  }

  async function revoke(k: ApiKeyRow) {
    if (!confirm(`לבטל את המפתח "${k.label}"? פעולה זו בלתי הפיכה.`)) return
    await ApiKeys.remove(k.id, cid)
    load()
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לנהל מפתחות API</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            מפתחות API
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            גישה תכנותית ללקוחות של החברה דרך <code style={{ fontFamily: 'var(--font-family-en)' }}>X-API-Key</code> · נקודת קצה: <code style={{ fontFamily: 'var(--font-family-en)' }}>/api/v1/customers</code>
          </div>
        </div>
        <button onClick={() => { setLabel(''); setSaveErr(null); setOpen(true) }} className="tact-btn tact-btn-primary">
          + מפתח חדש
        </button>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { header: 'תווית', key: 'label' },
            { header: 'קידומת', key: 'key_prefix', render: (r) => <code style={{ fontFamily: 'var(--font-family-en)' }}>{r.key_prefix}…</code> },
            {
              header: 'שימוש אחרון',
              key: 'last_used_at',
              render: (r) => (r.last_used_at ? new Date(r.last_used_at).toLocaleString('he-IL') : '—'),
            },
            {
              header: 'סטטוס',
              key: 'is_active',
              render: (r) => (
                <span className={`tact-badge ${r.is_active ? 'tact-badge-pos' : 'tact-badge-soon'}`}>
                  {r.is_active ? 'פעיל' : 'בוטל'}
                </span>
              ),
            },
          ]}
          actions={(r) =>
            r.is_active ? (
              <button onClick={() => revoke(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                בטל
              </button>
            ) : null
          }
          empty="אין מפתחות API. לחץ '+ מפתח חדש'."
        />
      )}

      <Modal
        open={open}
        title="מפתח API חדש"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="tact-btn tact-btn-ghost" onClick={() => setOpen(false)}>ביטול</button>
            <button className="tact-btn tact-btn-primary" onClick={create}>צור מפתח</button>
          </>
        }
      >
        <Field label="תווית" hint="לזיהוי המפתח, למשל: אינטגרציה עם מערכת X">
          <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        {saveErr && <div style={{ color: 'var(--color-accent)' }}>{saveErr}</div>}
      </Modal>

      <Modal
        open={!!createdKey}
        title="המפתח נוצר"
        onClose={() => setCreatedKey(null)}
        footer={<button className="tact-btn tact-btn-primary" onClick={() => setCreatedKey(null)}>הבנתי</button>}
      >
        <div style={{ fontSize: '0.9rem', marginBottom: 10, color: 'var(--color-accent)', fontWeight: 600 }}>
          העתק את המפתח עכשיו — הוא לא יוצג שוב.
        </div>
        <code
          style={{
            display: 'block',
            padding: 12,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontFamily: 'var(--font-family-en)',
            wordBreak: 'break-all',
            fontSize: '0.85rem',
          }}
        >
          {createdKey}
        </code>
        <button
          className="tact-btn tact-btn-ghost"
          style={{ marginTop: 10 }}
          onClick={() => createdKey && navigator.clipboard?.writeText(createdKey)}
        >
          העתק
        </button>
      </Modal>
    </div>
  )
}
