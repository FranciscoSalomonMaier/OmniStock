import { apiRequest } from './api'
import type { AuthResponse, LoginInput, RegisterInput, User } from '../types/auth'

export const authService = {
  register: (input: RegisterInput) => apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input), skipAuthRefresh: true }),
  login: (input: LoginInput) => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input), skipAuthRefresh: true }),
  refresh: () => apiRequest<AuthResponse>('/auth/refresh', { method: 'POST', skipAuthRefresh: true }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', skipAuthRefresh: true }),
  me: () => apiRequest<User>('/auth/me'),
}
