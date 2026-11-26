import { computed, reactive, readonly } from 'vue'
import { api, ApiError, tokenStore } from '@/api/client'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  ready: boolean
  loading: boolean
  error: string | null
}

const state = reactive<AuthState>({
  user: null,
  token: tokenStore.get(),
  ready: false,
  loading: false,
  error: null,
})

/**
 * 会话状态（演示级实现，用 reactive 单例代替 Pinia）
 *
 * GitHub Pages 上只有静态文件，刷新页面后内存状态全部丢失，
 * 所以启动时必须拿 localStorage 里的 token 调 /auth/me 做一次"会话恢复"。
 */
async function bootstrap() {
  if (state.ready) return
  if (!state.token) {
    state.ready = true
    return
  }
  try {
    const { user } = await api.me()
    state.user = user
  } catch (error) {
    // token 失效（过期/被改签名）→ 清理并回到未登录
    state.token = null
    state.user = null
    tokenStore.clear()
    if (!(error instanceof ApiError && error.status === 401)) {
      state.error = error instanceof Error ? error.message : '会话恢复失败'
    }
  } finally {
    state.ready = true
  }
}

async function login(email: string, password: string) {
  state.loading = true
  state.error = null
  try {
    const result = await api.login(email, password)
    state.token = result.token
    state.user = result.user
    tokenStore.set(result.token)
    return result
  } catch (error) {
    state.error = error instanceof Error ? error.message : '登录失败'
    throw error
  } finally {
    state.loading = false
  }
}

async function logout() {
  try {
    await api.logout()
  } catch {
    /* 无状态 token，服务端失败不影响本地登出 */
  }
  state.token = null
  state.user = null
  state.error = null
  tokenStore.clear()
}

export function useAuth() {
  return {
    state: readonly(state),
    user: computed(() => state.user),
    isAuthenticated: computed(() => Boolean(state.user && state.token)),
    login,
    logout,
    bootstrap,
  }
}
