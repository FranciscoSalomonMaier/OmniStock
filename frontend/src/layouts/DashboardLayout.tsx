import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompany } from '../hooks/useCompany'
import './DashboardLayout.css'

const menu = [
  ['Início', [['⌂', 'Dashboard', '/dashboard', false]]],
  ['Empresas', [['▣', 'Minhas empresas', '/companies', false], ['＋', 'Cadastrar empresa', '/companies/new', false], ['⚙', 'Configurações', '/settings/company', true], ['♟', 'Usuários', '/settings/company/members', true]]],
  ['Produtos', [['▤', 'Listar produtos', '/products', true], ['＋', 'Cadastrar produto', '/products/new', true], ['◫', 'Categorias', '/product-categories', true]]],
  ['Estoque', [['▦', 'Visão geral', '/inventory', true], ['↕', 'Movimentações', '/inventory/movements', true], ['＋', 'Nova entrada', '/inventory/entries/new', true], ['−', 'Nova saída', '/inventory/exits/new', true], ['≋', 'Ajustar estoque', '/inventory/adjustments/new', true], ['◇', 'Reservas', '/inventory/reservations', true]]],
  ['Minha conta', [['●', 'Perfil', '/profile', false], ['⌁', 'Alterar senha', '/profile/password', false]]],
] as const
const stockWriteLabels=new Set(['Nova entrada','Nova saída','Ajustar estoque'])

export function DashboardLayout() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Empresas: false, Produtos: false, Estoque: false, 'Minha conta': false })
  const { user, logout } = useAuth()
  const { companies, activeCompany, activeMembership, isLoading, pendingCompany, requestCompanySwitch, confirmCompanySwitch, cancelCompanySwitch } = useCompany()
  const navigate = useNavigate()
  const toggleGroup = (group: string) => setExpanded(current => ({ ...current, [group]: !current[group] }))
  async function leave() { await logout(); navigate('/login', { replace: true }) }
  return <div className="app-shell">
    <aside className={open ? 'sidebar open' : 'sidebar'} aria-label="Menu principal">
      <div className="brand sidebar-brand">OmniStock</div>
      {menu.map(([group, items]) => { 
        const collapsible = group !== 'Início'; 
        const isExpanded = !collapsible || expanded[group]; 
    
        return (
        <nav key={group}>{
          collapsible ? (
            <button className="nav-group-toggle" type="button" aria-expanded={isExpanded} aria-controls={`menu-${group}`} onClick={() => toggleGroup(group)}>
              <span>{group}</span>
              <span className="nav-chevron" aria-hidden="true">⌄</span>
            </button>
          ) : 
          (
            <h2>{group}</h2>
          )
        }
        
        <div id={`menu-${group}`} className={isExpanded ? 'nav-group-items expanded' : 'nav-group-items'}>
          {
            items.filter(([,label])=>group!=='Estoque'||(label!=='Movimentações'||activeMembership?.role!=='SUPPORT')&&(!stockWriteLabels.has(label)||['ADMIN','MANAGER','STOCKIST'].includes(activeMembership?.role??''))).map(([icon, label, to, requiresCompany]) => requiresCompany && !activeCompany ?
              <span key={to} className="nav-item disabled" title="Selecione uma empresa para acessar" aria-disabled="true">
                <b>{icon}</b>{label}
              </span> 
              : 
              <NavLink key={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} to={to} onClick={() => setOpen(false)}>
                <b>{icon}</b>{label}
              </NavLink>
            )
          }
        </div>
      </nav>)
    
    })}
      
      </aside><div className="app-main"><header className="app-header"><button className="menu-toggle" aria-label="Abrir menu" onClick={() => setOpen(!open)}>☰</button><div className="company-picker">{isLoading ? <span>Carregando empresas...</span> : companies.length ? <select aria-label="Empresa ativa" value={activeCompany?.id ?? ''} onChange={e => requestCompanySwitch(e.target.value)}><option value="" disabled>Selecione uma empresa</option>{companies.map(x => <option key={x.companyId} value={x.companyId}>{x.company.tradeName}</option>)}</select> : <Link to="/companies/new">Cadastrar empresa</Link>}</div><details className="user-menu"><summary>{user?.name}</summary><Link to="/profile">Perfil</Link><Link to="/profile/password">Alterar senha</Link><button onClick={() => void leave()}>Sair</button></details></header><div className="content"><Outlet /></div></div>{open && <button className="backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}{pendingCompany && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="switch-title"><h2 id="switch-title">Trocar empresa ativa?</h2><p>Você passará a trabalhar em <strong>{pendingCompany.tradeName}</strong>. Dados abertos da empresa atual serão descartados.</p><div className="form-actions"><button className="secondary" onClick={cancelCompanySwitch}>Cancelar</button><button onClick={confirmCompanySwitch}>Confirmar troca</button></div></section></div>}</div>
}
