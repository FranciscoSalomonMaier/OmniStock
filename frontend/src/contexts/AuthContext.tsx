import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { configureApiAuth, invalidateApiSession } from '../services/api'
import { authService } from '../services/auth.service'
import type { User } from '../types/auth'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)
  const sessionVersion = useRef(0)
  const applySession = useCallback((session: { user: User; accessToken: string } | null) => {
    tokenRef.current = session?.accessToken ?? null; setAccessToken(session?.accessToken ?? null); setUser(session?.user ?? null)
  }, [])
  const clearSession = useCallback(() => {
    sessionVersion.current += 1; invalidateApiSession(); localStorage.removeItem('omnistock_company_id')
    window.dispatchEvent(new Event('omnistock:logout')); applySession(null)
  }, [applySession])
  const refreshSession = useCallback(async () => {
    const version = sessionVersion.current
    try { const session=await authService.refresh(); if(version!==sessionVersion.current)return false; applySession(session); return true }
    catch { if(version===sessionVersion.current)applySession(null); return false }
  }, [applySession])
  useEffect(() => {
    configureApiAuth({ getAccessToken: () => tokenRef.current, renewSession: refreshSession, onSessionExpired: () => applySession(null) })
    queueMicrotask(() => void refreshSession().finally(() => setIsLoading(false)))
  }, [applySession, refreshSession])
  const value = useMemo<AuthContextValue>(() => ({ user, isAuthenticated: Boolean(user && accessToken), isLoading,
    login: async (input) => applySession(await authService.login(input)),
    register: (input) => authService.register(input),
    logout: async () => { clearSession(); try { await authService.logout() } catch { /* local session is already closed */ } }, clearSession, refreshSession,
  }), [accessToken, applySession, clearSession, isLoading, refreshSession, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
