import { Outlet } from 'react-router-dom'
export function AuthLayout() { return <main className="auth-shell"><section className="auth-card"><div className="brand">OmniStock</div><Outlet /></section></main> }
