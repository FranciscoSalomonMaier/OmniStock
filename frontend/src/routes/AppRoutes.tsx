import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AuthLayout } from '../layouts/AuthLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { DashboardPage } from '../pages/dashboard/DashboardPage'
export function AppRoutes() { return <Routes>
  <Route element={<AuthLayout />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /></Route>
  <Route element={<ProtectedRoute />}><Route path="/dashboard" element={<DashboardPage />} /></Route>
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes> }
