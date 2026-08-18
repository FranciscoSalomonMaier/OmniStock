import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Link } from 'react-router-dom'
import { useCompany } from '../../hooks/useCompany'
export function DashboardPage() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const {activeCompany}=useCompany()
  async function leave() { await logout(); navigate('/login', { replace: true }) }
  return <main className="dashboard"><header><div className="brand">OmniStock</div><button className="secondary" onClick={() => void leave()}>Sair</button></header>
    <section className="welcome"><span className="eyebrow">PAINEL</span><h1>Bem-vindo, {user?.name}</h1><p>Sua sessão está protegida e pronta para trabalhar.</p>
      <dl><div><dt>E-mail</dt><dd>{user?.email}</dd></div><div><dt>Empresa ativa</dt><dd>{activeCompany?.tradeName??'Nenhuma'}</dd></div></dl><nav className="dashboard-links"><Link to="/products">Produtos</Link><Link to="/product-categories">Categorias</Link><Link to="/companies">Empresas</Link><Link to="/profile">Perfil</Link><Link to="/settings/company">Configurações</Link><Link to="/settings/company/members">Membros</Link></nav>
    </section></main>
}
