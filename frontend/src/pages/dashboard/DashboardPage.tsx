import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
export function DashboardPage() {
  const { user, logout } = useAuth(); const navigate = useNavigate()
  async function leave() { await logout(); navigate('/login', { replace: true }) }
  return <main className="dashboard"><header><div className="brand">OmniStock</div><button className="secondary" onClick={() => void leave()}>Sair</button></header>
    <section className="welcome"><span className="eyebrow">PAINEL</span><h1>Bem-vindo, {user?.name}</h1><p>Sua sessão está protegida e pronta para trabalhar.</p>
      <dl><div><dt>E-mail</dt><dd>{user?.email}</dd></div><div><dt>Perfil</dt><dd><span className="role">{user?.role}</span></dd></div></dl>
    </section></main>
}
