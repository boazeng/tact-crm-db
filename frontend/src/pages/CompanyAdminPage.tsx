import { useState } from 'react'
import RolesPage from './RolesPage'
import FieldsPage from './FieldsPage'
import ParamLabelsPage from './ParamLabelsPage'
import DisplayColumnsPage from './DisplayColumnsPage'
import ProjectFieldLabelsPage from './ProjectFieldLabelsPage'
import ProjectFieldOrderPage from './ProjectFieldOrderPage'

type Section = 'customers' | 'projects' | 'leads'

// Top-level sections, each with its own set of configuration sub-tabs.
const SECTIONS: { k: Section; l: string; subs: { k: string; l: string; el: JSX.Element }[] }[] = [
  {
    k: 'customers',
    l: 'לקוחות',
    subs: [
      { k: 'roles', l: 'תפקידים', el: <RolesPage /> },
      { k: 'fields', l: 'שדות סיווג', el: <FieldsPage /> },
      { k: 'params', l: 'שמות פרמטרים', el: <ParamLabelsPage /> },
      { k: 'columns', l: 'עמודות בטבלה', el: <DisplayColumnsPage /> },
    ],
  },
  {
    k: 'projects',
    l: 'פרויקטים',
    subs: [
      { k: 'project_fields', l: 'שדות פרויקט', el: <ProjectFieldLabelsPage /> },
      { k: 'project_order', l: 'סדר הצגה', el: <ProjectFieldOrderPage /> },
    ],
  },
  {
    k: 'leads',
    l: 'לידים',
    subs: [],
  },
]

const tabBtn = (active: boolean, top: boolean) => ({
  padding: top ? '11px 22px' : '8px 16px',
  border: 'none',
  background: 'transparent',
  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
  color: active ? 'var(--color-primary)' : 'var(--color-text-light)',
  fontWeight: (active ? 700 : 500) as number,
  fontSize: top ? '1rem' : '0.9rem',
  cursor: 'pointer',
  font: 'inherit',
  marginBottom: -1,
})

/** "ניהול חברה" — per-company configuration, grouped into top-level sections
 * (לקוחות / פרויקטים / לידים), each with its own sub-tabs. */
export default function CompanyAdminPage() {
  const [section, setSection] = useState<Section>('customers')
  // One remembered sub-tab key per section.
  const [subBySection, setSubBySection] = useState<Record<Section, string>>({
    customers: 'roles',
    projects: 'project_fields',
    leads: '',
  })

  const active = SECTIONS.find((s) => s.k === section)!
  const activeSub = active.subs.find((t) => t.k === subBySection[section])

  return (
    <div>
      {/* Top-level sections */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)' }}>
        {SECTIONS.map((s) => (
          <button key={s.k} onClick={() => setSection(s.k)} style={tabBtn(s.k === section, true)}>
            {s.l}
          </button>
        ))}
      </div>

      {/* Sub-tabs for the active section */}
      {active.subs.length > 0 && (
        <div style={{ display: 'flex', gap: 4, margin: '14px 0 22px', borderBottom: '1px solid var(--color-border)' }}>
          {active.subs.map((t) => (
            <button
              key={t.k}
              onClick={() => setSubBySection((prev) => ({ ...prev, [section]: t.k }))}
              style={tabBtn(t.k === subBySection[section], false)}
            >
              {t.l}
            </button>
          ))}
        </div>
      )}

      {active.subs.length === 0 ? (
        <div className="tact-kpi" style={{ textAlign: 'center', marginTop: 24 }}>
          <div className="tact-kpi-label">ניהול לידים — בקרוב</div>
        </div>
      ) : (
        activeSub?.el
      )}
    </div>
  )
}
