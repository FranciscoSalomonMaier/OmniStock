import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AuthLayout } from '../layouts/AuthLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage'
import { VerificationPendingPage } from '../pages/auth/VerificationPendingPage'
import { ResendVerificationPage } from '../pages/auth/ResendVerificationPage'
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage'
import { CompaniesPage } from '../pages/companies/CompaniesPage'
import { NewCompanyPage } from '../pages/companies/NewCompanyPage'
import { MembersPage } from '../pages/companies/MembersPage'
import { CompanySettingsPage } from '../pages/companies/CompanySettingsPage'
import { ProfilePage } from '../pages/profile/ProfilePage'
import { CompanyRequiredRoute } from '../components/company/CompanyRequiredRoute'
export function AppRoutes() { return <Routes>
  <Route element={<AuthLayout />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/verify-email" element={<VerifyEmailPage />} /><Route path="/verification-pending" element={<VerificationPendingPage />} /><Route path="/resend-verification" element={<ResendVerificationPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /></Route>
  <Route element={<ProtectedRoute />}><Route path="/companies" element={<CompaniesPage />} /><Route path="/companies/new" element={<NewCompanyPage />} /><Route path="/profile" element={<ProfilePage />} /><Route element={<CompanyRequiredRoute/>}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/settings/company" element={<CompanySettingsPage />} /><Route path="/settings/company/members" element={<MembersPage />} /></Route></Route>
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes> }
