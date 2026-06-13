import { useEffect, useState } from 'react'
import { Customers, Fields, RoleOptions, ParamLabels, NumberLabels, FlagLabels, ListFields, type Customer, type FieldDefinition, type ParamLabel, type NumberLabel, type FlagLabel, type ListFieldDef } from '../lib/api'
import CustomerForm, {
  coreFromCustomer,
  toBody,
  type CoreForm,
} from '../components/CustomerForm'
import TactLogo from '../components/TactLogo'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

/** Full-page customer editor, opened in its own browser tab from the customers list. */
export default function CustomerEditPage({
  membershipId,
  companyIdFromUrl,
}: {
  membershipId: number
  companyIdFromUrl: number | null
}) {
  const { user } = useAuth()
  const effective = useEffectiveCompanyId()
  const cid =
    companyIdFromUrl ?? (user?.role === 'super_admin' ? effective ?? undefined : undefined)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [core, setCore] = useState<CoreForm | null>(null)
  const [fieldVals, setFieldVals] = useState<Record<string, unknown>>({})
  const [defs, setDefs] = useState<FieldDefinition[]>([])
  const [roleOpts, setRoleOpts] = useState<string[]>([])
  const [paramDefs, setParamDefs] = useState<ParamLabel[]>([])
  const [numberDefs, setNumberDefs] = useState<NumberLabel[]>([])
  const [flagDefs, setFlagDefs] = useState<FlagLabel[]>([])
  const [listDefs, setListDefs] = useState<ListFieldDef[]>([])
  const [others, setOthers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      Customers.get(membershipId, cid),
      Fields.list(cid),
      Customers.list(cid),
      RoleOptions.list(cid),
      ParamLabels.list(cid),
      NumberLabels.list(cid),
      FlagLabels.list(cid),
      ListFields.list(cid),
    ])
      .then(([c, d, list, ro, pl, nl, fl, lf]) => {
        setCustomer(c)
        setCore(coreFromCustomer(c))
        setFieldVals({ ...c.fields })
        setDefs(d.filter((x) => x.is_active))
        setOthers(list.filter((r) => r.membership_id !== membershipId))
        setRoleOpts(ro.map((r) => r.label))
        setParamDefs(pl)
        setNumberDefs(nl)
        setFlagDefs(fl)
        setListDefs(lf)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipId])

  async function save() {
    if (!core) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await Customers.update(membershipId, toBody(core, fieldVals), cid)
      setCustomer(updated)
      setCore(coreFromCustomer(updated))
      setFieldVals({ ...updated.fields })
      setSaved(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tact-aurora" style={{ minHeight: '100vh', padding: '18px 0' }}>
      <div
        style={{
          width: 'min(860px, 94vw)',
          margin: '0 auto',
          background: 'var(--color-bg-white)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            <TactLogo word="crm" size={0.85} />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: 6 }}>
              {customer ? `עריכת לקוח — ${customer.full_name}` : 'עריכת לקוח'}
            </h1>
            {customer?.customer_number && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                מספר לקוח: {customer.customer_number}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && <span className="tact-badge tact-badge-pos">נשמר ✓</span>}
            <button className="tact-btn tact-btn-ghost" onClick={() => window.close()}>סגירה</button>
            <button className="tact-btn tact-btn-primary" onClick={save} disabled={saving || !core}>
              {saving ? 'שומר…' : 'שמור'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {loading && <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>}
          {error && <div style={{ color: 'var(--color-accent)', marginBottom: 12 }}>{error}</div>}
          {core && (
            <CustomerForm
              core={core}
              setCore={setCore as React.Dispatch<React.SetStateAction<CoreForm>>}
              defs={defs}
              fieldVals={fieldVals}
              setFieldVals={setFieldVals}
              linkOptions={others}
              roleOptions={roleOpts}
              paramLabels={paramDefs}
              numberLabels={numberDefs}
              flagLabels={flagDefs}
              listFields={listDefs}
            />
          )}
        </div>

        {/* Footer mirror of actions for long forms */}
        {core && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '14px 24px',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button className="tact-btn tact-btn-ghost" onClick={() => window.close()}>סגירה</button>
            <button className="tact-btn tact-btn-primary" onClick={save} disabled={saving}>
              {saving ? 'שומר…' : 'שמור'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
