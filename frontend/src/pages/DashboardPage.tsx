import { useEffect, useState } from 'react'
import KpiCard from '../components/KpiCard'
import { Dashboard, type DashboardResponse } from '../lib/api'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

const STATUS_LABEL: Record<string, string> = {
  lead: 'לידים',
  active: 'פעילים',
  inactive: 'לא פעילים',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.role === 'super_admin' && !companyId) {
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    Dashboard.fetch(user?.role === 'super_admin' ? companyId ?? undefined : undefined)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [companyId, user?.role])

  if (user?.role === 'super_admin' && !companyId) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לצפות בדאשבורד</div>
        <div style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', marginTop: 8 }}>
          השתמש ברשימה "חברה פעילה" שלמעלה.
        </div>
      </div>
    )
  }
  if (loading) return <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
  if (error) return <div style={{ color: 'var(--color-accent)' }}>{error}</div>
  if (!data) return null

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)' }}>
          תמונת מצב
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
          סך הלקוחות, חלוקה לפי סטטוס, וסיווגים מותאמים-אישית של החברה
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginBottom: 30 }}>
        <KpiCard label="סך הלקוחות" value={data.total_customers} />
        <KpiCard label="פעילים" value={data.by_status['active'] || 0} />
        <KpiCard label="לידים" value={data.by_status['lead'] || 0} accent />
        <KpiCard label="שדות סיווג" value={data.total_fields} sub="מוגדרים לחברה" />
      </section>

      <section>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>
          חלוקה לפי סטטוס
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4" style={{ marginBottom: 30 }}>
          {Object.entries(data.by_status).map(([k, v]) => (
            <KpiCard key={k} label={STATUS_LABEL[k] || k} value={v} />
          ))}
          {Object.keys(data.by_status).length === 0 && (
            <div className="tact-kpi"><div className="tact-kpi-label">אין נתונים</div></div>
          )}
        </div>
      </section>

      {data.breakdowns.map((b) => (
        <section key={b.key} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>
            {b.label}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(b.counts).map(([opt, n]) => (
              <KpiCard key={opt} label={opt} value={n} />
            ))}
            {Object.keys(b.counts).length === 0 && (
              <div className="tact-kpi"><div className="tact-kpi-label">אין אפשרויות</div></div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
