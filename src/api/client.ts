/**
 * API 客户端：整个 demo 唯一的"后端边界"。
 *
 * 设计要点（也是本演示要说明的架构重点）：
 * 1. GitHub Pages 只能托管静态资源，没有任何服务端能力，
 *    所以这里的前端必须显式指向一个外部 API 地址。
 * 2. 地址来自 `VITE_API_BASE_URL`（构建期注入），本地开发留空走 Vite 代理。
 * 3. token 只放内存 + localStorage（demo 简化），请求时带 Authorization: Bearer。
 *
 * ⚠️ 最容易踩的坑：VITE_API_BASE_URL 没注入成功时，前端会"安静地"退回同源
 *    /api，部署到 Pages 后请求就打到 https://<user>.github.io/api/... → 404。
 *    因此这里对"线上环境 + 同源 base"的组合主动报错，而不是让它静默失败。
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

/** 解析 API 根地址：配置了就用，否则空字符串（走同源 /api 代理） */
export function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  return ''
}

export const apiBase = resolveApiBase()
export const apiBaseIsAbsolute = /^https?:\/\//i.test(apiBase)

const isDev = import.meta.env.DEV
const isLoopback =
  typeof location !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)

/**
 * 配置错误：构建产物部署在公网、却没有任何 API 地址。
 * 这不是运行时故障，而是"构建期变量没传进来"，需要给出明确指引。
 */
export const apiBaseMisconfigured = !isDev && !apiBaseIsAbsolute && !isLoopback

export const apiBaseProblem = apiBaseMisconfigured
  ? {
      title: 'API 地址未注入',
      message:
        '构建产物里没有 VITE_API_BASE_URL，前端正尝试请求同源 /api（GitHub Pages 上不存在该接口）。',
      hint: '请在仓库 Settings → Secrets and variables → Actions → Variables 配置 VITE_API_BASE_URL=https://你的API域名，然后重新运行工作流。',
    }
  : null

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
      let message = payload?.error?.message || `请求失败（HTTP ${response.status}）`

      // 同源 404 + 未注入地址 = 几乎必然是构建变量缺失，给出精准提示
      if (apiBaseMisconfigured && response.status === 404) {
        message = `接口 404：请求打到了同源 ${location.origin}${path}。原因是构建时未注入 VITE_API_BASE_URL。`
      }
      // 网络层拦截（CORS / 混合内容）会先经过这里
      throw new ApiError(response.status, code, message)
    }
    return payload.data
  } catch (error) {
    // fetch 抛 TypeError 通常是网络层被拦（CORS 预检失败 / 混合内容）
    if (error instanceof TypeError && !(error instanceof ApiError)) {
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        apiBaseIsAbsolute
          ? `无法连接 API（${apiBase}）：可能是跨域被拒、服务未启动，或 HTTPS 页面请求了 HTTP 接口。`
          : '无法连接 API：当前为同源模式，需要本地启动 Mock 服务并配置 VITE_API_BASE_URL。',
      )
    }
    throw error
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

  me: (signal?: AbortSignal) =>
    request<{ user: User; expiresAt: number }>('/auth/me', { signal, note: '恢复会话' }),

  logout: () => request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST', note: '登出' }),

  overview: (range: '7d' | '30d', signal?: AbortSignal) =>
    request<Overview>('/metrics/overview', { query: { range }, signal, note: `概览 ${range}` }),

  orders: (
    params: { status?: string; page?: number; pageSize?: number; q?: string },
    signal?: AbortSignal,
  ) => request<OrderPage>('/orders', { query: params, signal, note: '订单列表' }),
}
