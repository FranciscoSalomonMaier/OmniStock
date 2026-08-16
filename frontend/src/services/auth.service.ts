import { apiRequest } from './api'
import type { AuthResponse, LoginInput, RegisterInput, RegistrationResponse, User } from '../types/auth'

export const authService = {
  register: (input: RegisterInput) => apiRequest<RegistrationResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input), skipAuthRefresh: true }),
  verifyEmail: (token: string) => apiRequest<{ message: string }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }), skipAuthRefresh: true }),
  resendVerification: (email: string) => apiRequest<{ message: string }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }), skipAuthRefresh: true }),
  login: (input: LoginInput) => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input), skipAuthRefresh: true }),
  refresh: () => apiRequest<AuthResponse>('/auth/refresh', { method: 'POST', skipAuthRefresh: true }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', skipAuthRefresh: true }),
  me: () => apiRequest<User>('/auth/me'),
}
