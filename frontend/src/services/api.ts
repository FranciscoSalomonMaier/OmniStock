const API_URL = import.meta.env.VITE_API_URL as string | undefined
if (!API_URL) throw new Error('VITE_API_URL não está configurada')

let getAccessToken: () => string | null = () => null
let renewSession: () => Promise<boolean> = async () => false
let onSessionExpired: () => void = () => undefined
let refreshPromise: Promise<boolean> | null = null
let sessionVersion = 0
export function invalidateApiSession(){sessionVersion += 1; refreshPromise = null}
let getCompanyId: () => string | null = () => localStorage.getItem('omnistock_company_id')
export function configureApiCompany(getter:()=>string|null){getCompanyId=getter}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code }
}

export function configureApiAuth(config: { getAccessToken: () => string | null; renewSession: () => Promise<boolean>; onSessionExpired: () => void }) {
  getAccessToken = config.getAccessToken
  renewSession = config.renewSession
  onSessionExpired = config.onSessionExpired
}

interface ApiOptions extends RequestInit { skipAuthRefresh?: boolean }

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const requestVersion = sessionVersion
  const response = await send(path, options)
  if (requestVersion !== sessionVersion) throw new ApiError('Sessao encerrada', 401)
  if (response.status === 401 && !options.skipAuthRefresh && getAccessToken()) {
    refreshPromise ??= renewSession().finally(() => { refreshPromise = null })
    if (await refreshPromise && requestVersion === sessionVersion) return parseResponse<T>(await send(path, options))
    onSessionExpired()
  }
  return parseResponse<T>(response)
}

async function send(path: string, options: ApiOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const companyId=getCompanyId(); if(companyId) headers.set('X-Company-Id',companyId)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' })
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const contentType=response.headers.get('content-type')??''
  const data: unknown = contentType.includes('application/json') ? await response.json() : contentType.startsWith('image/') ? await response.blob() : await response.text()
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? (Array.isArray(data.message) ? data.message.join('. ') : String(data.message)) : 'Não foi possível concluir a solicitação'
    const code = typeof data === 'object' && data !== null && 'code' in data ? String(data.code) : undefined
    throw new ApiError(message, response.status, code)
  }
  return data as T
}
