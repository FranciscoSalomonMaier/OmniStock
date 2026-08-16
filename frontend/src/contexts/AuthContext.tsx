import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { configureApiAuth } from '../services/api'
import { authService } from '../services/auth.service'
import type { User } from '../types/auth'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)
  const applySession = useCallback((session: { user: User; accessToken: string } | null) => {
    tokenRef.current = session?.accessToken ?? null; setAccessToken(session?.accessToken ?? null); setUser(session?.user ?? null)
  }, [])
  const refreshSession = useCallback(async () => {
    try { applySession(await authService.refresh()); return true } catch { applySession(null); return false }
  }, [applySession])
  useEffect(() => {
    configureApiAuth({ getAccessToken: () => tokenRef.current, renewSession: refreshSession, onSessionExpired: () => applySession(null) })
    queueMicrotask(() => void refreshSession().finally(() => setIsLoading(false)))
  }, [applySession, refreshSession])
  const value = useMemo<AuthContextValue>(() => ({ user, isAuthenticated: Boolean(user && accessToken), isLoading,
    login: async (input) => applySession(await authService.login(input)),
    register: async (input) => applySession(await authService.register(input)),
    logout: async () => { try { await authService.logout() } finally { applySession(null) } }, refreshSession,
  }), [accessToken, applySession, isLoading, refreshSession, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
