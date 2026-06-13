import { type ReactNode } from 'react'
import { useAuth } from '../lib/AuthContext'
import TactLogo from './TactLogo'
import TactIcon from './TactIcon'
import CompanyPicker from './CompanyPicker'

export type NavKey =
  | 'dashboard'
  | 'customers'
  | 'projects'
  | 'leads'
  | 'company'
  | 'api_keys'
  | 'system_admin'

type Role = 'super_admin' | 'company_admin' | 'company_user'

type NavItem = {
  key: NavKey
  label: string
  icon: string
  roles: Role[]
}

const ALL_NAV: NavItem[] = [
  { key: 'dashboard', label: 'דאשבורד',  icon: 'dashboard', roles: ['super_admin', 'company_admin', 'company_user'] },
  { key: 'customers', label: 'לקוחות',    icon: 'users',      roles: ['super_admin', 'company_admin', 'company_user'] },
  { key: 'projects',  label: 'פרויקטים',  icon: 'briefcase',  roles: ['super_admin', 'company_admin', 'company_user'] },
  { key: 'leads',     label: 'לידים',     icon: 'user-plus',  roles: ['super_admin', 'company_admin', 'company_user'] },
  { key: 'company',   label: 'ניהול חברה', icon: 'building',   roles: ['super_admin', 'company_admin'] },
  { key: 'api_keys',  label: 'מפתחות API', icon: 'key',       roles: ['super_admin', 'company_admin'] },
]

export function visibleNav(role: string | undefined): NavItem[] {
  if (!role) return []
  return ALL_NAV.filter((n) => n.roles.includes(role as Role))
}

/** System administration (users + companies) is available to admins, and lives
 * in its own button above logout — not in the main nav. */
export function canSystemAdmin(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'company_admin'
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'מנהל-על',
  company_admin: 'אדמין חברה',
  company_user: 'משתמש',
}

type Props = {
  current: NavKey
  onNavigate: (k: NavKey) => void
  children: ReactNode
}

export default function AppShell({ current, onNavigate, children }: Props) {
  const { user, logout } = useAuth()
  const items = visibleNav(user?.role)

  return (
    <div className="tact-aurora" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: 'var(--color-bg-white)',
          borderInlineStart: '1px solid var(--color-border)',
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ padding: '6px 8px 18px' }}>
          <TactLogo word="crm" size={1.05} />
        </div>

        {items.map((it) => {
          const active = it.key === current
          return (
            <button
              key={it.key}
              onClick={() => onNavigate(it.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid transparent',
                background: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'var(--color-text-white)' : 'var(--color-text)',
                fontWeight: active ? 600 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                textAlign: 'start',
                transition: 'background .15s, color .15s',
                font: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!active)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(31,58,95,0.08)'
              }}
              onMouseLeave={(e) => {
                if (!active)
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <TactIcon name={it.icon} size={18} />
              {it.label}
            </button>
          )
        })}

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.full_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 4 }}>
            {ROLE_LABEL[user?.role || '']}
          </div>
          {user?.company_name && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: 10 }}>
              {user.company_name}
            </div>
          )}
          {canSystemAdmin(user?.role) && (
            <button
              onClick={() => onNavigate('system_admin')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '9px 12px',
                marginBottom: 8,
                borderRadius: 10,
                border: '1px solid transparent',
                background: current === 'system_admin' ? 'var(--color-primary)' : 'rgba(31,58,95,0.08)',
                color: current === 'system_admin' ? 'var(--color-text-white)' : 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <TactIcon name="cog" size={17} />
              ניהול מערכת
            </button>
          )}
          <button
            onClick={logout}
            className="tact-btn tact-btn-ghost"
            style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
          >
            יציאה
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            background: 'var(--color-bg-white)',
            borderBottom: '1px solid var(--color-border)',
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: '1.05rem', color: 'var(--color-primary)', fontWeight: 700 }}>
            {current === 'system_admin' ? 'ניהול מערכת' : items.find((i) => i.key === current)?.label || ''}
          </h1>
          <CompanyPicker />
        </div>
        <div style={{ padding: '24px 28px', flex: 1 }}>{children}</div>
      </main>
    </div>
  )
}
