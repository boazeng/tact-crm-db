import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import UsersPage from './UsersPage'
import CompaniesPage from './CompaniesPage'

type Tab = 'users' | 'companies'

/** System administration hub. Holds system-user management and (super-admin
 * only) company management — both moved off the main sidebar into here. */
export default function SystemAdminPage() {
  const { user } = useAuth()
  const canCompanies = user?.role === 'super_admin'
  const [tab, setTab] = useState<Tab>('users')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'משתמשי מערכת' },
    ...(canCompanies ? [{ key: 'companies' as Tab, label: 'חברות' }] : []),
  ]

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)' }}>
          ניהול מערכת
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
          הגדרת משתמשי מערכת{canCompanies ? ' וניהול חברות' : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
        {tabs.map((t) => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tact-btn ${active ? 'tact-btn-primary' : 'tact-btn-ghost'}`}
              style={{ padding: '8px 18px' }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'users' && <UsersPage />}
      {tab === 'companies' && canCompanies && <CompaniesPage />}
    </div>
  )
}
