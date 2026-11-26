<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { apiBase, apiBaseIsAbsolute } from '@/api/client'

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated, logout } = useAuth()

const navItems = [
  { name: 'dashboard', to: '/', label: '数据概览', icon: 'grid' },
  { name: 'orders', to: '/orders', label: '订单列表', icon: 'list' },
  { name: 'architecture', to: '/architecture', label: '架构说明', icon: 'layers' },
] as const

const showShell = computed(() => route.meta.public !== true && isAuthenticated.value)

const apiHint = computed(() =>
  apiBaseIsAbsolute ? apiBase.replace(/^https?:\/\//, '') : '同源 /api（Vite 代理）',
)

async function handleLogout() {
  await logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--bare': !showShell }">
    <template v-if="showShell">
      <aside class="sidebar">
        <RouterLink to="/" class="brand">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <defs>
                <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#9db4ff" />
                  <stop offset="100%" stop-color="#35e0c0" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="9" fill="none" stroke="url(#bg1)" stroke-width="2.6" />
              <circle cx="16" cy="16" r="3.4" fill="url(#bg1)" />
            </svg>
          </span>
          <span class="brand__text">
            <strong>Nebula</strong>
            <small>Console</small>
          </span>
        </RouterLink>

        <nav class="nav">
          <p class="nav__label">工作台</p>
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="item.to"
            class="nav__item"
            active-class="nav__item--active"
            :aria-label="item.label"
          >
            <svg v-if="item.icon === 'grid'" viewBox="0 0 24 24" width="17" height="17" fill="none">
              <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" stroke-width="1.7" />
              <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" stroke-width="1.7" />
              <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" stroke-width="1.7" />
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" stroke-width="1.7" />
            </svg>
            <svg v-else-if="item.icon === 'list'" viewBox="0 0 24 24" width="17" height="17" fill="none">
              <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              <circle cx="3.6" cy="6" r="1.4" fill="currentColor" />
              <circle cx="3.6" cy="12" r="1.4" fill="currentColor" />
              <circle cx="3.6" cy="18" r="1.4" fill="currentColor" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="none">
              <path
                d="M12 3l8.5 4.8v8.4L12 21 3.5 16.2V7.8L12 3z"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round"
              />
              <path d="M12 12l8.5-4.2M12 12v9M12 12L3.5 7.8" stroke="currentColor" stroke-width="1.7" />
            </svg>
            <span>{{ item.label }}</span>
            <span v-if="item.name === 'architecture'" class="nav__badge">PAGES</span>
          </RouterLink>
        </nav>

        <div class="sidebar__footer">
          <div class="env-card">
            <div class="env-card__row">
              <span class="dot" :class="apiBaseIsAbsolute ? 'dot--live' : 'dot--local'" />
              <span class="env-card__label">{{ apiBaseIsAbsolute ? '远端 API' : '本地 API（代理）' }}</span>
            </div>
            <code class="env-card__value" :title="apiBase || '同源 /api'">{{ apiHint }}</code>
            <RouterLink to="/architecture" class="env-card__link">查看架构 →</RouterLink>
          </div>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar__crumbs">
            <span class="topbar__env">GitHub Pages</span>
            <span class="topbar__sep">/</span>
            <span>{{ (route.meta.title as string) || '工作台' }}</span>
          </div>

          <div class="topbar__right">
            <span class="pill pill--accent topbar__ping">
              <span class="dot dot--live" />
              静态托管 · HTTPS
            </span>
            <div class="user">
              <span class="user__avatar" aria-hidden="true">{{ user?.avatar }}</span>
              <span class="user__meta">
                <strong>{{ user?.name }}</strong>
                <small>{{ user?.role }}</small>
              </span>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" @click="handleLogout">退出</button>
          </div>
        </header>

        <main class="content">
          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </main>
      </div>
    </template>

    <RouterView v-else />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  display: flex;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  width: var(--sidebar-width);
  flex: 0 0 var(--sidebar-width);
  display: flex;
  flex-direction: column;
  gap: 26px;
  padding: 22px 16px;
  border-right: 1px solid var(--border-subtle);
  background: linear-gradient(180deg, rgba(13, 18, 33, 0.9), rgba(7, 10, 20, 0.72));
  backdrop-filter: blur(16px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 4px 6px;
  color: var(--text-primary);
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(124, 157, 255, 0.26);
  background: rgba(124, 157, 255, 0.1);
  box-shadow: inset 0 0 18px rgba(124, 157, 255, 0.16);
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.brand__text strong {
  font-size: 15px;
  letter-spacing: 0.02em;
}

.brand__text small {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.nav__label {
  padding: 0 10px 8px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 11px;
  border-radius: 11px;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 550;
  transition: all 0.2s var(--ease-out);
  border: 1px solid transparent;
}

.nav__item:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.nav__item--active {
  color: #dce6ff;
  background: linear-gradient(90deg, rgba(124, 157, 255, 0.18), rgba(124, 157, 255, 0.04));
  border-color: rgba(124, 157, 255, 0.24);
  box-shadow: inset 0 0 24px rgba(124, 157, 255, 0.08);
}

.nav__item--active svg {
  color: var(--brand);
}

.nav__badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 5px;
  border-radius: 5px;
  color: #9af5e2;
  background: var(--accent-soft);
  border: 1px solid rgba(53, 224, 192, 0.28);
}

.sidebar__footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.env-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.03);
}

.env-card__row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.env-card__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.env-card__value {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.env-card__link {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--brand);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.dot--live {
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(53, 224, 192, 0.16);
  animation: pulse 2.4s infinite;
}

.dot--local {
  background: var(--amber);
  box-shadow: 0 0 0 3px rgba(255, 180, 84, 0.16);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 28px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(6, 9, 18, 0.72);
  backdrop-filter: blur(18px) saturate(140%);
}

.topbar__crumbs {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  color: var(--text-secondary);
}

.topbar__env {
  font-weight: 650;
  color: var(--text-primary);
}

.topbar__sep {
  color: var(--text-muted);
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.user {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-left: 14px;
  border-left: 1px solid var(--border-subtle);
}

.user__avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #071022;
  background: var(--gradient-brand);
}

.user__meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.user__meta strong {
  font-size: 12.5px;
  font-weight: 650;
}

.user__meta small {
  font-size: 11px;
  color: var(--text-muted);
}

.content {
  padding: 26px 28px 56px;
  flex: 1;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s var(--ease-out), transform 0.22s var(--ease-out);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
}

@media (max-width: 960px) {
  .sidebar {
    display: none;
  }
  .topbar {
    padding: 0 16px;
  }
  .content {
    padding: 18px 16px 40px;
  }
  .topbar__ping,
  .user__meta {
    display: none;
  }
}
</style>
