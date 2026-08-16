const API_URL = import.meta.env.VITE_API_URL as string | undefined
if (!API_URL) throw new Error('VITE_API_URL não está configurada')

let getAccessToken: () => string | null = () => null
let renewSession: () => Promise<boolean> = async () => false
let onSessionExpired: () => void = () => undefined
let refreshPromise: Promise<boolean> | null = null

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export function configureApiAuth(config: { getAccessToken: () => string | null; renewSession: () => Promise<boolean>; onSessionExpired: () => void }) {
  getAccessToken = config.getAccessToken
  renewSession = config.renewSession
  onSessionExpired = config.onSessionExpired
}

interface ApiOptions extends RequestInit { skipAuthRefresh?: boolean }

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 401 && !options.skipAuthRefresh && getAccessToken()) {
    refreshPromise ??= renewSession().finally(() => { refreshPromise = null })
    if (await refreshPromise) return parseResponse<T>(await send(path, options))
    onSessionExpired()
  }
  return parseResponse<T>(response)
}

async function send(path: string, options: ApiOptions): Promise<Response> {
  const headers = new Headers(options.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' })
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const data: unknown = (response.headers.get('content-type') ?? '').includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? (Array.isArray(data.message) ? data.message.join('. ') : String(data.message)) : 'Não foi possível concluir a solicitação'
    throw new ApiError(message, response.status)
  }
  return data as T
}
