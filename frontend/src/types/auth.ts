export type UserRole = 'ADMIN' | 'MANAGER' | 'STOCKIST' | 'BILLING' | 'SUPPORT' | 'VIEWER'
export interface User { id: string; name: string; email: string; role: UserRole; isActive: boolean; createdAt?: string }
export interface AuthResponse { user: User; accessToken: string }
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { name: string }
