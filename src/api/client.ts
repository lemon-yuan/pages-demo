/**
 * API 客户端：整个 demo 唯一的"后端边界"。
 *
 * 设计要点（也是本演示要说明的架构重点）：
 * 1. GitHub Pages 只能托管静态资源，没有任何服务端能力，
 *    所以这里的前端必须显式指向一个外部 API 地址。
 * 2. 地址来自 `VITE_API_BASE_URL`（构建期注入），本地开发留空走 Vite 代理。
 * 3. token 只放内存 + localStorage（demo 简化），请求时带 Authorization: Bearer。
 */
import type {
  ApiEnvelope,
  LoginResponse,
  OrderPage,
  Overview,
  User,
} from '@/types'
import { logRequest } from '@/composables/useRequestLog'

const TOKEN_KEY = 'nebula.token'

/**
 * 解析 API 根地址：
 * - 配置了 VITE_API_BASE_URL（如 https://api.example.com 或 http://127.0.0.1:8787）→ 直接用
 * - 否则用相对路径 ""，交给 Vite dev server / preview 的 /api 代理
 */
export function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  return ''
}

export const apiBase = resolveApiBase()
export const apiBaseIsAbsolute = /^https?:\/\//i.test(apiBase)

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'ApiError'
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* 隐私模式下写入失败可忽略 */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
  query?: Record<string, string | number | undefined>
  /** 日志中显示的简短说明 */
  note?: string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal, query, note } = options

  const search = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''

  const url = `${apiBase}/api${path}${search}`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const startedAt = performance.now()
  let status: number | 'ERR' = 'ERR'

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      // 演示里前后端跨域，不带 cookie；鉴权用 Authorization 头，天然避开 SameSite 问题
      credentials: 'omit',
    })
    status = response.status

    const text = await response.text()
    const payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : null

    if (!response.ok || !payload || payload.success === false) {
      const code = payload?.error?.code || `HTTP_${response.status}`
      const message = payload?.error?.message || `请求失败（HTTP ${response.status}）`
      throw new ApiError(response.status, code, message)
    }
    return payload.data
  } finally {
    logRequest({
      method,
      path: `/api${path}${search}`,
      status,
      ms: Math.round(performance.now() - startedAt),
      note,
    })
  }
}

export const api = {
  health: (signal?: AbortSignal) =>
    request<{
      status: string
      service: string
      version: string
      runtime: string
      uptimeSeconds: number
      serverTime: string
      requestId: string
    }>('/health', { auth: false, signal, note: '健康检查' }),

  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
      note: '登录',
    }),

  me: (signal?: AbortSignal) => request<{ user: User; expiresAt: number }>('/auth/me', { signal, note: '恢复会话' }),

  logout: () => request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST', note: '登出' }),

  overview: (range: '7d' | '30d', signal?: AbortSignal) =>
    request<Overview>('/metrics/overview', { query: { range }, signal, note: `概览 ${range}` }),

  orders: (
    params: { status?: string; page?: number; pageSize?: number; q?: string },
    signal?: AbortSignal,
  ) => request<OrderPage>('/orders', { query: params, signal, note: '订单列表' }),
}
