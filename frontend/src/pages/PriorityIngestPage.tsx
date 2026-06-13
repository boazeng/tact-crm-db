import { useEffect, useState } from 'react'
import { PrioritySync, type PriorityConnection, type PriorityFieldMap, type IngestSummary } from '../lib/api'
import { inputStyle } from '../components/Modal'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

/** "קליטת נתוני לקוח מפריורטי" — pulls customer records from the company's
 * Priority connection and upserts them per the saved field mapping. */
export default function PriorityIngestPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [conn, setConn] = useState<PriorityConnection | null>(null)
  const [maps, setMaps] = useState<PriorityFieldMap[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState('')          // empty = all
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<IngestSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (needsCompany) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([PrioritySync.getConnection(cid), PrioritySync.mappings(cid)])
      .then(([c, m]) => {
        setConn(c)
        setMaps(m)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.role])

  const mapped = maps.filter((m) => m.is_imported && m.target_field)

  async function run() {
    const n = mapped.length
    const lim = limit.trim() ? Number(limit) : null
    const scope = lim ? `${lim} הרשומות הראשונות` : 'כל הלקוחות'
    if (!confirm(`לקלוט ${scope} מפריורטי לפי ${n} השדות הממופים? לקוחות קיימים יעודכנו בשדות הממופים בלבד.`)) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      setResult(await PrioritySync.ingest(lim, cid))
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לקלוט נתונים מפריורטי</div>
      </div>
    )
  }
  if (loading) return <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>

  const ready = !!conn?.base_url && mapped.length > 0

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
          קליטת נתוני לקוח מפריורטי
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
          משיכת לקוחות מפריורטי ועדכון המערכת לפי המיפוי. פריורטי מעדכן רק את השדות הממופים;
          שדות אחרים נשמרים.
        </div>
      </div>

      {/* Status card */}
      <div className="tact-kpi" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: '0.9rem' }}>
          <div>
            <div className="tact-kpi-label">חיבור פריורטי</div>
            <div style={{ fontWeight: 700, color: conn?.base_url ? 'var(--color-success, #2e9e6b)' : 'var(--color-accent)' }}>
              {conn?.base_url ? 'מוגדר' : 'לא מוגדר'}
            </div>
          </div>
          <div>
            <div className="tact-kpi-label">שדות ממופים לקליטה</div>
            <div style={{ fontWeight: 700 }}>{mapped.length}</div>
          </div>
        </div>
        {!ready && (
          <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--color-accent)' }}>
            {conn?.base_url
              ? 'אין שדות ממופים — הגדר מיפוי בלשונית "סנכרון שדות פריורטי" ושמור.'
              : 'הגדר חיבור ומיפוי בלשונית "סנכרון שדות פריורטי" תחילה.'}
          </div>
        )}
      </div>

      {/* Run controls */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: 4 }}>
            מגבלת רשומות (ריק = הכל) — מומלץ לבדיקה ראשונית
          </div>
          <input
            type="number"
            min={1}
            placeholder="הכל"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            style={{ ...inputStyle, maxWidth: 160 }}
          />
        </div>
        <button className="tact-btn tact-btn-primary" onClick={run} disabled={running || !ready}>
          {running ? 'קולט…' : '⬇ קלוט נתוני לקוחות'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}

      {result && (
        <div className="tact-kpi" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: 12 }}>תוצאות הקליטה</div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: '0.95rem' }}>
            <Stat label="סה״כ נקראו" value={result.total} />
            <Stat label="נוצרו" value={result.created} color="var(--color-success, #2e9e6b)" />
            <Stat label="עודכנו" value={result.updated} color="var(--color-primary)" />
            <Stat label="דולגו (שגיאה)" value={result.skipped} color={result.skipped ? 'var(--color-accent)' : undefined} />
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-accent)', marginBottom: 6 }}>
                שגיאות ({result.errors.length}{result.skipped > result.errors.length ? '+' : ''}):
              </div>
              <div style={{ maxHeight: 220, overflow: 'auto', fontSize: '0.8rem' }}>
                {result.errors.map((er, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontFamily: 'var(--font-family-en)' }}>{er.key ?? '—'}</span> — {er.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="tact-kpi-label">{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color ?? 'var(--color-text)' }}>{value}</div>
    </div>
  )
}
