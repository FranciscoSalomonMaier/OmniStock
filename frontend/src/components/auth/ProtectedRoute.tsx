import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth(); const location = useLocation()
  if (isLoading) return <main className="loading" role="status">Verificando sua sessão...</main>
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />
}
