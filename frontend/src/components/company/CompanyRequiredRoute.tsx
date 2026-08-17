import { Navigate, Outlet } from 'react-router-dom'
import { useCompany } from '../../hooks/useCompany'
export function CompanyRequiredRoute(){const{activeCompany,isLoading}=useCompany();if(isLoading)return <main className="loading">Carregando empresas...</main>;return activeCompany?<Outlet/>:<Navigate to="/companies/new" replace/>}
