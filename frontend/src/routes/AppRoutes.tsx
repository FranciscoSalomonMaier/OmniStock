import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AuthLayout } from '../layouts/AuthLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage'
import { VerificationPendingPage } from '../pages/auth/VerificationPendingPage'
import { ResendVerificationPage } from '../pages/auth/ResendVerificationPage'
export function AppRoutes() { return <Routes>
  <Route element={<AuthLayout />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/verification-pending" element={<VerificationPendingPage />} /><Route path="/resend-verification" element={<ResendVerificationPage />} /></Route>
  <Route element={<ProtectedRoute />}><Route path="/dashboard" element={<DashboardPage />} /></Route>
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes> }
