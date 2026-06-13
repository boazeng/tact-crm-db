import { useEffect, useState } from 'react'
import { Customers, Fields, RoleOptions, ParamLabels, NumberLabels, FlagLabels, ListFields, DisplayColumns, type Customer, type FieldDefinition, type ParamLabel, type NumberLabel, type FlagLabel, type ListFieldDef, type DisplayColumn } from '../lib/api'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import CustomerForm, {
  EMPTY_CORE,
  toBody,
  todayISO,
  type CoreForm,
} from '../components/CustomerForm'
import { useAuth, useEffectiveCompanyId } from '../lib/AuthContext'

/** Open the full-page editor for a customer in a new browser tab. */
function openEditTab(membershipId: number, companyId?: number) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('view', 'customer')
  url.searchParams.set('id', String(membershipId))
  if (companyId) url.searchParams.set('company_id', String(companyId))
  window.open(url.toString(), '_blank')
}

export default function CustomersPage() {
  const { user } = useAuth()
  const companyId = useEffectiveCompanyId()
  const cid = user?.role === 'super_admin' ? companyId ?? undefined : undefined
  const needsCompany = user?.role === 'super_admin' && !companyId

  const [rows, setRows] = useState<Customer[]>([])
  const [defs, setDefs] = useState<FieldDefinition[]>([])
  const [roleOpts, setRoleOpts] = useState<string[]>([])
  const [paramDefs, setParamDefs] = useState<ParamLabel[]>([])
  const [numberDefs, setNumberDefs] = useState<NumberLabel[]>([])
  const [flagDefs, setFlagDefs] = useState<FlagLabel[]>([])
  const [listDefs, setListDefs] = useState<ListFieldDef[]>([])
  const [displayCols, setDisplayCols] = useState<DisplayColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // The modal is used for CREATE only; editing happens in a full-page tab.
  const [open, setOpen] = useState(false)
  const [core, setCore] = useState<CoreForm>(EMPTY_CORE)
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
      Customers.list(cid, search || undefined, { excludeStatus: 'lead' }),
      Fields.list(cid),
      RoleOptions.list(cid),
      ParamLabels.list(cid),
      NumberLabels.list(cid),
      FlagLabels.list(cid),
      ListFields.list(cid),
      DisplayColumns.list(cid),
    ])
      .then(([c, d, ro, pl, nl, fl, lf, dc]) => {
        setRows(c)
        setDefs(d.filter((x) => x.is_active))
        setRoleOpts(ro.map((r) => r.label))
        setParamDefs(pl)
        setNumberDefs(nl)
        setFlagDefs(fl)
        setListDefs(lf)
        setDisplayCols(dc)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [companyId, user?.role])

  function openCreate() {
    setCore({ ...EMPTY_CORE, creation_date: todayISO() })
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

  async function remove(c: Customer) {
    if (!confirm(`להסיר את "${c.full_name}" מהחברה? (הלקוח הגלובלי יישמר)`)) return
    await Customers.remove(c.membership_id, cid)
    load()
  }

  // Resolve a user-configured display column to a table header + cell renderer.
  function colHeader(c: DisplayColumn): string {
    const i = c.ref_index - 1
    if (c.kind === 'param') return paramDefs[i]?.label || `פרמטר ${c.ref_index}`
    if (c.kind === 'flag') return flagDefs[i]?.label || `דגל ${c.ref_index}`
    return listDefs[i]?.label || `רשימה ${c.ref_index}`
  }
  function colCell(r: Customer, c: DisplayColumn) {
    const i = c.ref_index - 1
    if (c.kind === 'flag') {
      const on = r.flags?.[i]
      return (
        <span className={`tact-badge ${on ? 'tact-badge-pos' : 'tact-badge-soon'}`}>
          {on ? 'כן' : 'לא'}
        </span>
      )
    }
    if (c.kind === 'list') return r.lists?.[i] || '—'
    return r.params?.[i] || '—'
  }

  if (needsCompany) {
    return (
      <div className="tact-kpi" style={{ textAlign: 'center' }}>
        <div className="tact-kpi-label">בחר חברה כדי לצפות בלקוחות</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            לקוחות
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            פרטי הלקוח + הסיווגים המותאמים-אישית של החברה
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
          <button onClick={openCreate} className="tact-btn tact-btn-primary">+ לקוח חדש</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-accent)', marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)' }}>טוען…</div>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.membership_id}
          pageSize={50}
          columns={[
            { header: "מס' לקוח", key: 'customer_number', render: (r: Customer) => r.customer_number || '—' },
            { header: 'שם', key: 'full_name' },
            { header: 'כינוי', key: 'nickname', render: (r: Customer) => r.nickname || '—' },
            { header: 'שם חברה', key: 'company_name', render: (r: Customer) => r.company_name || '—' },
            { header: 'תפקיד', key: 'role', render: (r: Customer) => r.role || '—' },
            { header: 'טלפון', key: 'phone' },
            {
              header: 'פעיל',
              key: 'status',
              render: (r) => (
                <span className={`tact-badge ${r.status === 'active' ? 'tact-badge-pos' : 'tact-badge-soon'}`}>
                  {r.status === 'active' ? 'כן' : 'לא'}
                </span>
              ),
            },
            {
              header: 'תאריך יצירה',
              key: 'creation_date',
              render: (r: Customer) => (r.creation_date ? r.creation_date.split('-').reverse().join('/') : '—'),
            },
            {
              header: 'משלם',
              key: 'is_paying',
              render: (r: Customer) => (
                <span className={`tact-badge ${r.is_paying ? 'tact-badge-pos' : 'tact-badge-soon'}`}>
                  {r.is_paying ? 'כן' : 'לא'}
                </span>
              ),
            },
            ...displayCols.map((c, idx) => ({
              header: colHeader(c),
              key: `dc_${idx}`,
              render: (r: Customer) => colCell(r, c),
            })),
          ]}
          actions={(r) => (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => openEditTab(r.membership_id, cid)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                ערוך
              </button>
              <button onClick={() => remove(r)} className="tact-btn tact-btn-ghost" style={{ padding: '6px 14px', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                הסר
              </button>
            </div>
          )}
          empty="עדיין אין לקוחות. לחץ '+ לקוח חדש'."
        />
      )}

      <Modal
        open={open}
        title="לקוח חדש"
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
          roleOptions={roleOpts}
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
