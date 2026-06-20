import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  Auth,
  clearToken,
  setToken,
  getActiveCompanyId,
  setActiveCompanyId,
  type CurrentUser,
} from './api'

type AuthState = {
  user: CurrentUser | null
  loading: boolean
  /** For super_admin: the company they're currently inspecting. Null for non-super. */
  activeCompanyId: number | null
  /** Production login: email + password. */
  login: (email: string, password: string) => Promise<void>
  /** Dev-only convenience login: pick a user by email, no password. */
  loginAs: (email: string) => Promise<void>
  /** Sign in with Google: exchange a Google ID token for a session. */
  loginWithGoogle: (credential: string) => Promise<void>
  logout: () => void
  setActiveCompany: (id: number | null) => void
  refresh: () => Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCompanyId, setActiveCompanyIdState] = useState<number | null>(
    getActiveCompanyId(),
  )

  const refresh = useCallback(async () => {
    try {
      const me = await Auth.me()
      setUser(me)
    } catch {
      setUser(null)
      clearToken()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const applySession = useCallback((access_token: string, me: CurrentUser) => {
    setToken(access_token)
    setUser(me)
    // For non-super_admin set their own company as active; super_admin must pick.
    if (me.role !== 'super_admin' && me.company_id) {
      setActiveCompanyId(me.company_id)
      setActiveCompanyIdState(me.company_id)
    } else {
      setActiveCompanyId(null)
      setActiveCompanyIdState(null)
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token, user: me } = await Auth.login(email, password)
      applySession(access_token, me)
    },
    [applySession],
  )

  const loginAs = useCallback(
    async (email: string) => {
      const { access_token, user: me } = await Auth.devLogin(email)
      applySession(access_token, me)
    },
    [applySession],
  )

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const { access_token, user: me } = await Auth.google(credential)
      applySession(access_token, me)
    },
    [applySession],
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setActiveCompanyIdState(null)
  }, [])

  const setActiveCompany = useCallback((id: number | null) => {
    setActiveCompanyId(id)
    setActiveCompanyIdState(id)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      activeCompanyId,
      login,
      loginAs,
      loginWithGoogle,
      logout,
      setActiveCompany,
      refresh,
    }),
    [user, loading, activeCompanyId, login, loginAs, loginWithGoogle, logout, setActiveCompany, refresh],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

/** Resolves which company_id the current view should target. Returns null when
 * the user is super_admin and hasn't picked one yet — pages should show a picker.
 */
export function useEffectiveCompanyId(): number | null {
  const { user, activeCompanyId } = useAuth()
  if (!user) return null
  if (user.role === 'super_admin') return activeCompanyId
  return user.company_id
}
