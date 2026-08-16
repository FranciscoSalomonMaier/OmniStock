import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate(); const location = useLocation()
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard'
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSubmitting(true)
    try { await login({ email, password }); navigate(destination, { replace: true }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar') }
    finally { setSubmitting(false) }
  }
  return <><h1>Entrar</h1><p className="subtitle">Acesse sua operação de estoque.</p>
    <form onSubmit={submit} className="auth-form">
      <label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'Entrando...' : 'Entrar'}</button>
    </form><p className="auth-link">Ainda não tem conta? <Link to="/register">Cadastre-se</Link></p></>
}
