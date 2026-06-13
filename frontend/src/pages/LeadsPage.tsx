import { useEffect, useState } from 'react'
import { Customers, Fields, ParamLabels, NumberLabels, FlagLabels, ListFields, type Customer, type CustomerInput, type FieldDefinition, type ParamLabel, type NumberLabel, type FlagLabel, type ListFieldDef } from '../lib/api'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import CustomerForm, {
  EMPTY_CORE,
  toBody,
  type CoreForm,
} from '../components/CustomerForm'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

/** A new contact starts life as a lead, not an active customer. */
const EMPTY_LEAD: CoreForm = { ...EMPTY_CORE, status: 'lead' }

/** Open the full-page editor for a contact in a new browser tab (shared with customers). */
function openEditTab(membershipId: number, companyId?: number) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('view', 'customer')
  url.searchParams.set('id', String(membershipId))
  if (companyId) url.searchParams.set('company_id', String(companyId))
  window.open(url.toString(), '_blank')
}

/** Rebuild the write-DTO from a fetched row, so we can flip a single field. */
function rowToBody(c: Customer): CustomerInput {
  return {
    customer_number: c.customer_number,
    full_name: c.full_name,
    customer_type: c.customer_type,
    company_name: c.company_name,
    national_id: c.national_id,
    nickname: c.nickname,
    street1: c.street1,
    city1: c.city1,
    street2: c.street2,
    city2: c.city2,
    phone: c.phone,
    email: c.email,
    allow_mailing: c.allow_mailing,
    notes: c.notes,
    params: c.params,
    numbers: c.numbers,
    flags: c.flags,
    lists: c.lists,
    status: c.status,
    source: c.source,
    external_ref: c.external_ref,
    is_paying: c.is_paying,
    paid_by_membership_id: c.paid_by_membership_id,
    links: (c.links || []).map((l) => ({ linked_membership_id: l.linked_membership_id, role: l.role })),
    fields: c.fields,
  }
}

export default function LeadsPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [rows, setRows] = useState<Customer[]>([])
  const [defs, setDefs] = useState<FieldDefinition[]>([])
  const [paramDefs, setParamDefs] = useState<ParamLabel[]>([])
  const [numberDefs, setNumberDefs] = useState<NumberLabel[]>([])
  const [flagDefs, setFlagDefs] = useState<FlagLabel[]>([])
  const [listDefs, setListDefs] = useState<ListFieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // The modal is used for CREATE only; editing happens in a full-page tab.
  const [open, setOpen] = useState(false)
  const [core, setCore] = useState<CoreForm>(EMPTY_LEAD)
  const [fieldVals, setFieldVals] = useState<Record<string, unknown>>({})
  const [saveErr, setSaveErr] = useState<string | null>(null)

  function load() {
    if (needsCompany) {
      setRows([])
      setDefs([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      Customers.list(cid, search || undefined, { status: 'lead' }),
      Fields.list(cid),
      ParamLabels.list(cid),
      NumberLabels.list(cid),
      FlagLabels.list(cid),
      ListFields.list(cid),
    ])
      .then(([c, d, pl, nl, fl, lf]) => {
        setRows(c)
        setDefs(d.filter((x) => x.is_active))
        setParamDefs(pl)
        setNumberDefs(nl)
        setFlagDefs(fl)
        setListDefs(lf)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  function openCreate() {
    setCore(EMPTY_LEAD)
    setFieldVals({})
    setSaveErr(null)
    setOpen(true)
  }

  async function save() {
    setSaveErr(null)
    try {
      await Customers.create(toBody(core, fieldVals), cid)
      setOpen(false)
      load()
    } catch (e) {
      setSaveErr(String(e))
    }
  }

  /** Promote a lead to an active customer — it then moves to the customers page. */
  async function convert(c: Customer) {
    if (!confirm(`להמיר את "${c.full_name}" מליד ללקוח פעיל?`)) return
    await Customers.update(c.membership_id, { ...rowToBody(c), status: 'active' }, cid)
    load()
  }

  async function remove(c: Customer) {
    if (!confirm(`למחוק את הליד "${c.full_name}"? (הלקוח הגלובלי יישמר)`)) return
    await Customers.remove(c.membership_id, cid)
    load()
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לצפות בלידים</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            לידים
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            אנשי קשר שעדיין לא הפכו ללקוחות — המר ללקוח כשהם מבשילים
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="חיפוש…"
            style={{ width: 200, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontFamily: 'inherit', fontSize: '0.92rem', color: 'var(--color-text)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button onClick={load} className="tact-btn tact-btn-ghost">חפש</button>
          <button onClick={openCreate} className="tact-btn tact-btn-primary">+ ליד חדש</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.membership_id}
          columns={[
            { header: "מס'", key: 'customer_number', render: (r: Customer) => r.customer_number || '—' },
            { header: 'שם', key: 'full_name' },
            { header: 'כינוי', key: 'nickname', render: (r: Customer) => r.nickname || '—' },
            { header: 'טלפון', key: 'phone', render: (r: Customer) => r.phone || '—' },
            { header: 'אימייל', key: 'email', render: (r: Customer) => r.email || '—' },
            {
              header: 'מקושרים',
              key: 'links',
              render: (r: Customer) =>
                r.links && r.links.length
                  ? r.links.map((l) => (l.role ? `${l.name} (${l.role})` : l.name)).join(', ')
                  : '—',
            },
          ]}
          actions={(r) => (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => convert(r)} className="tact-btn tact-btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                המר ללקוח
              </button>
              <button onClick={() => openEditTab(r.membership_id, cid)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                ערוך
              </button>
              <button onClick={() => remove(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                מחק
              </button>
            </div>
          )}
          empty="עדיין אין לידים. לחץ '+ ליד חדש'."
        />
      )}

      <Modal
        open={open}
        title="ליד חדש"
        width={720}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="tact-btn tact-btn-ghost" onClick={() => setOpen(false)}>ביטול</button>
            <button className="tact-btn tact-btn-primary" onClick={save}>שמור</button>
          </>
        }
      >
        <CustomerForm
          core={core}
          setCore={setCore}
          defs={defs}
          fieldVals={fieldVals}
          setFieldVals={setFieldVals}
          linkOptions={rows}
          paramLabels={paramDefs}
          numberLabels={numberDefs}
          flagLabels={flagDefs}
          listFields={listDefs}
        />
        {saveErr && <div style={{ color: 'var(--color-accent)' }}>{saveErr}</div>}
      </Modal>
    </div>
  )
}
