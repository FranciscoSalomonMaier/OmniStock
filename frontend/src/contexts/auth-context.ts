import { createContext } from 'react'
import type { LoginInput, RegisterInput, RegistrationResponse, User } from '../types/auth'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<RegistrationResponse>
  logout: () => Promise<void>
  clearSession: () => void
  refreshSession: () => Promise<boolean>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
