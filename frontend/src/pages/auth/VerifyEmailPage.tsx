import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../../services/auth.service'
export function VerifyEmailPage() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const started = useRef(false); const [state, setState] = useState<'loading'|'success'|'error'|'missing'>('loading'); const [message, setMessage] = useState('Confirmando seu e-mail...')
  useEffect(() => { if (started.current) return; started.current = true; const token = params.get('token'); navigate('/verify-email', { replace: true })
    if (!token) { queueMicrotask(() => { setState('missing'); setMessage('O token de confirmação não foi informado.') }); return }
    void authService.verifyEmail(token).then((result) => { setState('success'); setMessage(result.message) }).catch((error: unknown) => { setState('error'); setMessage(error instanceof Error ? error.message : 'O link de confirmação é inválido ou expirou.') })
  }, [navigate, params])
  return <><h1>{state === 'success' ? 'E-mail confirmado' : 'Confirmação de e-mail'}</h1><p className={state === 'error' ? 'form-error' : 'subtitle'} role="status">{message}</p>{state === 'success' && <Link className="primary-link" to="/login">Ir para o login</Link>}{(state === 'error' || state === 'missing') && <div className="auth-actions"><Link to="/resend-verification">Reenviar confirmação</Link><Link to="/login">Voltar ao login</Link></div>}</>
}
