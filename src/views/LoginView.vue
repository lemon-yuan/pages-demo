<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { ApiError, apiBase, apiBaseProblem } from '@/api/client'

const route = useRoute()
const router = useRouter()
const { login, state } = useAuth()

const form = reactive({ email: 'demo@example.com', password: 'demo1234' })
const showPassword = ref(false)
const localError = ref<string | null>(null)

const demos = [
  { label: '演示用户', email: 'demo@example.com', password: 'demo1234', role: '产品负责人' },
  { label: '管理员', email: 'admin@example.com', password: 'admin1234', role: '平台管理员' },
]

function fill(item: (typeof demos)[number]) {
  form.email = item.email
  form.password = item.password
  localError.value = null
}

async function submit() {
  localError.value = null
  if (!form.email.trim() || !form.password) {
    localError.value = '请输入邮箱和密码'
    return
  }
  try {
    await login(form.email.trim(), form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (error) {
    if (error instanceof ApiError) {
      localError.value =
        error.code === 'ORIGIN_NOT_ALLOWED'
          ? '当前页面来源未被 Mock API 放行，请检查后端 ALLOWED_ORIGINS 配置。'
          : error.message
    } else {
      localError.value =
        '无法连接 API。请确认已执行 `npm run server`，且 VITE_API_BASE_URL 指向正确的地址。'
    }
  }
}

onMounted(() => {
  // 页面进入时给个轻微焦点引导（桌面端）
  if (window.matchMedia('(min-width: 960px)').matches) {
    document.querySelector<HTMLInputElement>('#email')?.focus({ preventScroll: true })
  }
})
</script>

<template>
  <div class="login">
   <div class="login-wrap">
    <!-- 左：品牌叙事 -->
    <section class="login__aside">
      <div class="login__brand">
        <span class="login__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="26" height="26">
            <defs>
              <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#9db4ff" />
                <stop offset="100%" stop-color="#35e0c0" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="9" fill="none" stroke="url(#lg1)" stroke-width="2.6" />
            <circle cx="16" cy="16" r="3.4" fill="url(#lg1)" />
          </svg>
        </span>
        <span>
          <strong>Nebula Console</strong>
          <small>GitHub Pages 架构演示</small>
        </span>
      </div>

      <div class="login__pitch">
        <h1>
          静态前端托管在 <span class="text-gradient">GitHub Pages</span><br />
          数据来自你自己的 API
        </h1>
        <p>
          前端构建产物由 GitHub Actions 发布到 Pages，运行时通过 HTTPS 调用本地/远端 Mock API。
          这个页面本身就是方案可行性的证明。
        </p>
      </div>

      <ul class="login__points">
        <li>
          <span class="point__icon">01</span>
          <div>
            <strong>零服务器成本的前端托管</strong>
            <p>Pages 只分发静态文件，无需维护 CDN、Nginx 或容器。</p>
          </div>
        </li>
        <li>
          <span class="point__icon">02</span>
          <div>
            <strong>push 即发布的 CI/CD</strong>
            <p>GitHub Actions 自动 <code>vite build</code> 并部署，产物可回滚。</p>
          </div>
        </li>
        <li>
          <span class="point__icon">03</span>
          <div>
            <strong>后端完全解耦</strong>
            <p>换 API 域名即可切换环境，前端镜像与后端发布互不阻塞。</p>
          </div>
        </li>
      </ul>

      <p class="login__note">
        <span class="dot dot--local" />
        演示账号已预填，Mock API 需在本地以 <code>npm run server</code> 运行
      </p>
    </section>

    <!-- 右：登录卡片 -->
    <section class="login__panel">
      <form class="login-card card" @submit.prevent="submit">
        <header class="login-card__head">
          <h2>登录控制台</h2>
          <p>使用演示账号体验鉴权链路（登录 → 签发 token → 携带 Bearer 调数据接口）</p>
        </header>

        <!-- 构建期未注入 API 地址时，直接把原因和修复方式摆出来 -->
        <div v-if="apiBaseProblem" class="config-error" role="alert">
          <strong>{{ apiBaseProblem.title }}</strong>
          <p>{{ apiBaseProblem.message }}</p>
          <p class="config-error__hint">{{ apiBaseProblem.hint }}</p>
        </div>

        <div class="field">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="form.email"
            class="input"
            type="email"
            autocomplete="username"
            placeholder="you@example.com"
            spellcheck="false"
          />
        </div>

        <div class="field">
          <label for="password">密码</label>
          <div class="input-wrap">
            <input
              id="password"
              v-model="form.password"
              class="input"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              class="input-wrap__toggle"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
        </div>

        <p v-if="localError || state.error" class="login-card__error" role="alert">
          <span class="login-card__error-icon">!</span>
          {{ localError || state.error }}
        </p>

        <button class="btn btn--primary login-card__submit" type="submit" :disabled="state.loading">
          <span v-if="state.loading" class="spinner" aria-hidden="true" />
          {{ state.loading ? '正在验证…' : '登录' }}
        </button>

        <div class="login-card__divider"><span>快速填充演示账号</span></div>

        <div class="login-card__demos">
          <button
            v-for="item in demos"
            :key="item.email"
            type="button"
            class="demo-account"
            @click="fill(item)"
          >
            <span class="demo-account__avatar">{{ item.label.slice(0, 1) }}</span>
            <span class="demo-account__text">
              <strong>{{ item.label }}</strong>
              <small>{{ item.email }}</small>
            </span>
            <span class="demo-account__role">{{ item.role }}</span>
          </button>
        </div>

        <p class="login-card__foot">
          当前 API：<code class="mono">{{ apiBase || '同源 /api（本地代理）' }}</code><br />
          纯演示项目：账号密码硬编码在 Mock 服务内，<strong>请勿用于生产</strong>。
        </p>
      </form>
    </section>
   </div>
  </div>
</template>

<style scoped>
.login {
  /* .app-shell 是 flex 容器：不加 flex:1 会被收缩成内容宽度，
     导致整块内容贴左、右侧留白（见 .login-wrap 的居中逻辑） */
  flex: 1;
  min-width: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 48px clamp(24px, 4vw, 64px);
}

/* 承载左右两栏的定宽容器：限制最大宽度并水平居中，
   避免「视口越宽、右侧留白越多」的视觉偏移 */
.login-wrap {
  width: 100%;
  max-width: 1180px;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: clamp(32px, 5vw, 72px);
  align-items: center;
}

/* ---------- 左侧叙事 ---------- */
.login__aside {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 560px;
  justify-self: end;
  animation: fade-up 0.6s var(--ease-out) both;
}

.login__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.login__mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(124, 157, 255, 0.26);
  background: rgba(124, 157, 255, 0.1);
  box-shadow: inset 0 0 22px rgba(124, 157, 255, 0.18);
}

.login__brand span:last-child {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.login__brand strong {
  font-size: 16px;
  letter-spacing: 0.01em;
}

.login__brand small {
  font-size: 11.5px;
  color: var(--text-muted);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.login__pitch h1 {
  font-size: clamp(28px, 3.1vw, 42px);
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
}

.login__pitch p {
  color: var(--text-secondary);
  font-size: 14.5px;
  line-height: 1.75;
  max-width: 480px;
}

.login__points {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
  margin: 0;
}

.login__points li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.point__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--brand);
  background: rgba(124, 157, 255, 0.1);
  border: 1px solid rgba(124, 157, 255, 0.22);
}

.login__points strong {
  display: block;
  font-size: 13.5px;
  font-weight: 650;
  margin-bottom: 2px;
}

.login__points p {
  color: var(--text-muted);
  font-size: 12.5px;
  line-height: 1.6;
}

.login__points code,
.login__note code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.06);
  color: #cbd6f2;
}

.login__note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* ---------- 右侧表单 ---------- */
.login__panel {
  display: flex;
  justify-content: center;
  animation: fade-up 0.7s 0.08s var(--ease-out) both;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

.login-card__head h2 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}

.login-card__head p {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.6;
}

.input-wrap {
  position: relative;
}

.input-wrap input {
  padding-right: 62px;
}

.input-wrap__toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.input-wrap__toggle:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.login-card__submit {
  height: 44px;
  margin-top: 4px;
  font-size: 14px;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(7, 16, 34, 0.35);
  border-top-color: #071022;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.login-card__error {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px 13px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  line-height: 1.55;
  color: #ffc2ca;
  background: rgba(255, 107, 129, 0.1);
  border: 1px solid rgba(255, 107, 129, 0.26);
}

.login-card__error-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border-radius: 50%;
  background: rgba(255, 107, 129, 0.24);
  font-size: 11px;
  font-weight: 800;
}

.login-card__divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 2px 0;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.login-card__divider::before,
.login-card__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

.login-card__demos {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.demo-account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s var(--ease-out);
}

.demo-account:hover {
  border-color: rgba(124, 157, 255, 0.4);
  background: rgba(124, 157, 255, 0.08);
  transform: translateX(2px);
}

.demo-account__avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  color: #071022;
  background: var(--gradient-brand);
}

.demo-account__text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  min-width: 0;
}

.demo-account__text strong {
  font-size: 12.5px;
}

.demo-account__text small {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-account__role {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--text-muted);
  white-space: nowrap;
}

.config-error {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 13px;
  border-radius: var(--radius-sm);
  color: #ffd39b;
  background: rgba(255, 180, 84, 0.1);
  border: 1px solid rgba(255, 180, 84, 0.3);
  font-size: 12px;
  line-height: 1.6;
}

.config-error strong {
  font-size: 12.5px;
  color: #ffd39b;
}

.config-error__hint {
  color: #c9b48c;
  font-size: 11.5px;
}

.login-card__foot code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #c7d3f0;
}

.login-card__foot {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
  border-top: 1px solid var(--border-subtle);
  padding-top: 14px;
}

.login-card__foot strong {
  color: var(--text-secondary);
}

@media (max-width: 1080px) {
  .login {
    padding: 32px 20px 48px;
    align-items: start;
  }

  .login-wrap {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
    max-width: 520px;
  }

  .login__aside {
    max-width: none;
    justify-self: stretch;
    gap: 24px;
  }

  .login__points {
    display: none;
  }
}
</style>
