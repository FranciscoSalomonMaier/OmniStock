import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmation: '' })
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (form.password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres'); return }
    if (form.password !== form.confirmation) { setError('As senhas não coincidem'); return }
    setSubmitting(true)
    try { await register({ name: form.name, email: form.email, password: form.password }); navigate('/dashboard', { replace: true }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar') }
    finally { setSubmitting(false) }
  }
  const field = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value })
  return <><h1>Criar conta</h1><p className="subtitle">Comece com acesso de visualização.</p>
    <form onSubmit={submit} className="auth-form">
      <label htmlFor="name">Nome</label><input id="name" autoComplete="name" required minLength={2} value={form.name} onChange={field('name')} />
      <label htmlFor="register-email">E-mail</label><input id="register-email" type="email" autoComplete="email" required value={form.email} onChange={field('email')} />
      <label htmlFor="register-password">Senha</label><input id="register-password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={field('password')} />
      <label htmlFor="confirmation">Confirmar senha</label><input id="confirmation" type="password" autoComplete="new-password" required minLength={8} value={form.confirmation} onChange={field('confirmation')} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'Criando conta...' : 'Criar conta'}</button>
    </form><p className="auth-link">Já possui conta? <Link to="/login">Entrar</Link></p></>
}
