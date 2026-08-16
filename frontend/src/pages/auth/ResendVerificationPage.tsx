import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authService } from '../../services/auth.service'
export function ResendVerificationPage() {
  const initialEmail = (useLocation().state as { email?: string } | null)?.email ?? ''; const [email, setEmail] = useState(initialEmail); const [message, setMessage] = useState(''); const [submitting, setSubmitting] = useState(false); const [seconds, setSeconds] = useState(0)
  useEffect(() => { if (seconds <= 0) return; const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer) }, [seconds])
  async function submit(event: FormEvent) { event.preventDefault(); setSubmitting(true); setMessage(''); try { const result = await authService.resendVerification(email); setMessage(result.message); setSeconds(60) } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a solicitação') } finally { setSubmitting(false) } }
  return <><h1>Reenviar confirmação</h1><p className="subtitle">Informe o e-mail usado no cadastro.</p><form className="auth-form" onSubmit={submit}><label htmlFor="resend-email">E-mail</label><input id="resend-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />{message && <p className="notice" role="status">{message}</p>}<button disabled={submitting || seconds > 0}>{submitting ? 'Enviando...' : seconds > 0 ? `Aguarde ${seconds}s` : 'Reenviar confirmação'}</button></form><p className="auth-link"><Link to="/login">Voltar ao login</Link></p></>
}
