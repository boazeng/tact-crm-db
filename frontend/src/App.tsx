import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ToastProvider } from './lib/Toast'
import AppShell, { visibleNav, canSystemAdmin, type NavKey } from './components/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'
import LeadsPage from './pages/LeadsPage'
import ProjectsPage from './pages/ProjectsPage'
import CustomerEditPage from './pages/CustomerEditPage'
import CompanyAdminPage from './pages/CompanyAdminPage'
import ApiKeysPage from './pages/ApiKeysPage'
import SystemAdminPage from './pages/SystemAdminPage'

/** Read a standalone "view" route from the URL (used for the customer editor
 * opened in its own tab). Returns null for the normal app shell. */
function readRoute() {
  const p = new URLSearchParams(window.location.search)
  if (p.get('view') === 'customer' && p.get('id')) {
    return {
      view: 'customer' as const,
      id: Number(p.get('id')),
      companyId: p.get('company_id') ? Number(p.get('company_id')) : null,
    }
  }
  return null
}

function ProtectedShell() {
  const { user, loading } = useAuth()
  const [current, setCurrent] = useState<NavKey>('dashboard')
  const route = readRoute()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span style={{ color: 'var(--color-text-light)' }}>טוען…</span>
      </div>
    )
  }
  if (!user) return <LoginPage />

  // Standalone full-page customer editor (own tab) — no sidebar shell.
  if (route?.view === 'customer') {
    return <CustomerEditPage membershipId={route.id} companyIdFromUrl={route.companyId} />
  }

  const nav = visibleNav(user.role)
  const isValid =
    nav.some((n) => n.key === current) ||
    (current === 'system_admin' && canSystemAdmin(user.role))
  const safe: NavKey = isValid ? current : nav[0]?.key ?? 'dashboard'

  return (
    <AppShell current={safe} onNavigate={setCurrent}>
      {safe === 'dashboard' && <DashboardPage />}
      {safe === 'customers' && <CustomersPage />}
      {safe === 'projects' && <ProjectsPage />}
      {safe === 'leads' && <LeadsPage />}
      {safe === 'company' && <CompanyAdminPage />}
      {safe === 'api_keys' && <ApiKeysPage />}
      {safe === 'system_admin' && <SystemAdminPage />}
    </AppShell>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ProtectedShell />
      </AuthProvider>
    </ToastProvider>
  )
}
