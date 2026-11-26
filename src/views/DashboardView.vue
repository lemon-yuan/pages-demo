<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api, apiBase, apiBaseIsAbsolute } from '@/api/client'
import type { Overview } from '@/types'
import StatCard from '@/components/StatCard.vue'
import TrendChart from '@/components/TrendChart.vue'
import ChannelBars from '@/components/ChannelBars.vue'
import RequestLog from '@/components/RequestLog.vue'

type Range = '7d' | '30d'
type Metric = 'visits' | 'signups' | 'revenue'

const range = ref<Range>('7d')
const metric = ref<Metric>('visits')
const overview = ref<Overview | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const health = ref<{ status: string; version: string; uptimeSeconds: number } | null>(null)
const refreshing = ref(false)

let controller: AbortController | null = null

const metricTabs: Array<{ key: Metric; label: string }> = [
  { key: 'visits', label: '访问量' },
  { key: 'signups', label: '注册数' },
  { key: 'revenue', label: '成交额' },
]

const totalVisits = computed(() =>
  overview.value ? overview.value.channels.reduce((acc, c) => acc + c.visits, 0) : 0,
)

const lastUpdated = computed(() => {
  if (!overview.value?.generatedAt) return ''
  return new Date(overview.value.generatedAt).toLocaleTimeString('zh-CN', { hour12: false })
})

async function load(silent = false) {
  controller?.abort()
  controller = new AbortController()
  if (silent) refreshing.value = true
  else loading.value = true
  error.value = null

  try {
    const data = await api.overview(range.value, controller.signal)
    overview.value = data
    if (!health.value) {
      health.value = await api.health(controller.signal).catch(() => null)
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

watch(range, () => load(true))
onMounted(() => load())
onUnmounted(() => controller?.abort())

const greet = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
</script>

<template>
  <div class="dash">
    <!-- 页头 -->
    <header class="dash__head fade-up">
      <div>
        <p class="dash__eyebrow">
          <span class="pill pill--brand">DASHBOARD</span>
          <span class="muted">数据由 {{ apiBaseIsAbsolute ? '远端' : '本地' }} Mock API 实时提供</span>
        </p>
        <h1 class="dash__title">
          {{ greet }}，<span class="text-gradient">欢迎回到 Nebula</span>
        </h1>
        <p class="dash__sub">
          前端是纯静态产物（Vite 构建 → GitHub Actions → Pages），
          下方所有数字都来自独立部署的 API 服务。
        </p>
      </div>

      <div class="dash__actions">
        <div class="segmented" role="group" aria-label="时间范围">
          <button
            v-for="item in (['7d', '30d'] as Range[])"
            :key="item"
            type="button"
            class="segmented__item"
            :class="{ 'segmented__item--active': range === item }"
            @click="range = item"
          >
            近 {{ item === '7d' ? 7 : 30 }} 天
          </button>
        </div>
        <button class="btn btn--sm" type="button" :disabled="loading || refreshing" @click="load(true)">
          <span v-if="refreshing" class="spin" aria-hidden="true" />
          刷新
        </button>
      </div>
    </header>

    <!-- 错误态 -->
    <div v-if="error" class="alert card fade-up" role="alert">
      <div class="alert__icon">!</div>
      <div class="alert__body">
        <strong>数据加载失败</strong>
        <p>{{ error }}</p>
        <p class="alert__hint mono">
          当前 API：{{ apiBase || '同源 /api（需 npm run dev 代理）' }}
        </p>
      </div>
      <button class="btn btn--sm" type="button" @click="load()">重试</button>
    </div>

    <!-- KPI -->
    <section class="dash__kpis">
      <StatCard
        v-for="(kpi, index) in overview?.kpis || []"
        :key="kpi.key"
        :kpi="kpi"
        :loading="loading"
        :index="index"
      />
      <template v-if="loading && !overview">
        <article v-for="i in 4" :key="`sk-${i}`" class="stat-placeholder card">
          <div class="skeleton" style="height: 12px; width: 46%" />
          <div class="skeleton" style="height: 28px; width: 68%" />
          <div class="skeleton" style="height: 8px; width: 100%" />
        </article>
      </template>
    </section>

    <!-- 图表 + 渠道 -->
    <section class="dash__grid">
      <article class="panel card fade-up" style="animation-delay: 120ms">
        <header class="panel__head">
          <div>
            <h2 class="section-title">趋势分析</h2>
            <p class="panel__sub">
              {{ lastUpdated ? `数据生成于 ${lastUpdated}` : '加载中…' }}
              <span v-if="health" class="panel__health">
                <span class="dot dot--live" /> API v{{ health.version }}
              </span>
            </p>
          </div>
          <div class="tabs" role="tablist">
            <button
              v-for="tab in metricTabs"
              :key="tab.key"
              type="button"
              role="tab"
              class="tabs__item"
              :class="{ 'tabs__item--active': metric === tab.key }"
              :aria-selected="metric === tab.key"
              @click="metric = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
        </header>

        <TrendChart
          v-if="overview"
          :series="overview.series"
          :metric="metric"
          :loading="loading && !overview"
        />
        <div v-else class="chart-placeholder skeleton" />
      </article>

      <article class="panel card fade-up" style="animation-delay: 180ms">
        <header class="panel__head">
          <h2 class="section-title">流量渠道</h2>
          <span class="pill">近 {{ range === '7d' ? 7 : 30 }} 天</span>
        </header>
        <ChannelBars
          v-if="overview"
          :channels="overview.channels"
          :total="totalVisits"
          :loading="loading && !overview"
        />
        <div v-else class="skeleton" style="height: 200px" />
      </article>
    </section>

    <!-- 架构提示 + 请求日志 -->
    <section class="dash__grid dash__grid--bottom">
      <article class="panel card fade-up" style="animation-delay: 220ms">
        <header class="panel__head">
          <h2 class="section-title">这次请求走过了什么</h2>
          <RouterLink to="/architecture" class="panel__link">完整架构 →</RouterLink>
        </header>
        <ol class="flow">
          <li>
            <span class="flow__idx">1</span>
            <div>
              <strong>浏览器</strong>
              <p>加载 Pages 上的静态 <code>index.html</code> 与 JS/CSS 资源（CDN 边缘节点）。</p>
            </div>
          </li>
          <li>
            <span class="flow__idx">2</span>
            <div>
              <strong>Vue 应用启动</strong>
              <p>路由守卫读取 localStorage 中的 token 并调用 <code>/api/auth/me</code> 恢复会话。</p>
            </div>
          </li>
          <li>
            <span class="flow__idx">3</span>
            <div>
              <strong>跨域调用 API</strong>
              <p>
                携带 <code>Authorization: Bearer</code> 请求
                <code class="mono">{{ apiBase || '同源 /api' }}/metrics/overview</code>，
                由 API 端完成 CORS 校验与鉴权。
              </p>
            </div>
          </li>
          <li>
            <span class="flow__idx">4</span>
            <div>
              <strong>渲染</strong>
              <p>响应 JSON 直接驱动 KPI 卡片与 SVG 图表，全程无需服务端渲染。</p>
            </div>
          </li>
        </ol>
      </article>

      <RequestLog />
    </section>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.dash__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.dash__eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  margin-bottom: 10px;
}

.dash__title {
  font-size: clamp(24px, 2.8vw, 32px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin-bottom: 8px;
}

.dash__sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 620px;
  line-height: 1.7;
}

.dash__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.segmented {
  display: flex;
  padding: 3px;
  gap: 2px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-subtle);
}

.segmented__item {
  height: 30px;
  padding: 0 13px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.segmented__item:hover {
  color: var(--text-primary);
}

.segmented__item--active {
  color: #e6edff;
  background: rgba(124, 157, 255, 0.18);
  box-shadow: 0 2px 10px -4px rgba(91, 124, 250, 0.8);
}

.spin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.22);
  border-top-color: var(--brand);
  animation: rot 0.7s linear infinite;
}

@keyframes rot {
  to {
    transform: rotate(360deg);
  }
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-color: rgba(255, 107, 129, 0.3);
  background: rgba(255, 107, 129, 0.06);
}

.alert__icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 8px;
  font-weight: 800;
  color: #ffc2ca;
  background: rgba(255, 107, 129, 0.18);
}

.alert__body {
  flex: 1;
}

.alert__body strong {
  font-size: 13px;
}

.alert__body p {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-top: 3px;
}

.alert__hint {
  font-size: 11px;
  color: var(--text-muted);
}

.dash__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-placeholder {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dash__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.85fr) minmax(0, 1fr);
  gap: 14px;
}

.dash__grid--bottom {
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
}

.panel {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel__sub {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 4px;
}

.panel__health {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
}

.panel__link {
  font-size: 12px;
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--border-subtle);
}

.tabs__item {
  height: 27px;
  padding: 0 11px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.tabs__item:hover {
  color: var(--text-primary);
}

.tabs__item--active {
  color: #e6edff;
  background: rgba(124, 157, 255, 0.16);
}

.chart-placeholder {
  height: 260px;
}

.flow {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  counter-reset: flow;
}

.flow li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.flow__idx {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--brand);
  background: rgba(124, 157, 255, 0.1);
  border: 1px solid rgba(124, 157, 255, 0.22);
}

.flow strong {
  display: block;
  font-size: 12.5px;
  font-weight: 650;
  margin-bottom: 2px;
}

.flow p {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.65;
}

.flow code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #c7d3f0;
}

@media (max-width: 1180px) {
  .dash__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dash__grid,
  .dash__grid--bottom {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 620px) {
  .dash__kpis {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
