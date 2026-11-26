<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api } from '@/api/client'
import type { Order, OrderPage, OrderStatus } from '@/types'

const page = ref(1)
const pageSize = 8
const status = ref<'all' | OrderStatus>('all')
const keyword = ref('')
const data = ref<OrderPage | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selected = ref<Order | null>(null)

let controller: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

const statusTabs: Array<{ key: 'all' | OrderStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'paid', label: '已支付' },
  { key: 'pending', label: '待支付' },
  { key: 'refunded', label: '已退款' },
  { key: 'failed', label: '失败' },
]

const statusMeta: Record<OrderStatus, { label: string; cls: string }> = {
  paid: { label: '已支付', cls: 'pill--accent' },
  pending: { label: '待支付', cls: 'pill--amber' },
  refunded: { label: '已退款', cls: 'pill--brand' },
  failed: { label: '失败', cls: 'pill--danger' },
}

const totalPages = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1))

async function load() {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = null
  try {
    data.value = await api.orders(
      { status: status.value, page: page.value, pageSize, q: keyword.value },
      controller.signal,
    )
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

watch([status, page], () => load())

watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 280)
})

function go(next: number) {
  page.value = Math.min(totalPages.value, Math.max(1, next))
}

function formatAmount(order: Order) {
  return '¥' + new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(order.amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

onMounted(() => load())
onUnmounted(() => {
  controller?.abort()
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="orders">
    <header class="orders__head fade-up">
      <div>
        <p class="orders__eyebrow"><span class="pill pill--brand">DATA API</span> 分页 · 筛选 · 搜索</p>
        <h1 class="orders__title">订单列表</h1>
        <p class="orders__sub">每次筛选/翻页都会真实请求 <code class="mono">GET /api/orders</code>，由后端完成过滤与分页。</p>
      </div>
      <div class="orders__search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" />
          <path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input v-model="keyword" class="orders__search-input" placeholder="搜索订单号 / 客户 / 套餐" />
      </div>
    </header>

    <div class="tabs-row fade-up">
      <div class="tabs">
        <button
          v-for="tab in statusTabs"
          :key="tab.key"
          type="button"
          class="tabs__item"
          :class="{ 'tabs__item--active': status === tab.key }"
          @click="status = tab.key; page = 1"
        >
          {{ tab.label }}
          <span v-if="data" class="tabs__count">{{ data.summary[tab.key] ?? 0 }}</span>
        </button>
      </div>
      <p class="tabs-row__hint">共 {{ data?.total ?? '—' }} 条匹配记录</p>
    </div>

    <div v-if="error" class="alert card">
      <strong>加载失败：</strong>{{ error }}
      <button class="btn btn--sm" @click="load">重试</button>
    </div>

    <div class="table-card card fade-up">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>客户</th>
              <th>套餐</th>
              <th class="table__num">金额</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>负责人</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading && !data">
              <tr v-for="i in pageSize" :key="`sk-${i}`">
                <td v-for="c in 7" :key="c"><div class="skeleton" style="height: 12px" /></td>
              </tr>
            </template>
            <template v-else-if="data && data.items.length">
              <tr
                v-for="order in data.items"
                :key="order.id"
                class="table__row"
                tabindex="0"
                @click="selected = order"
                @keydown.enter="selected = order"
              >
                <td class="mono table__id">{{ order.id }}</td>
                <td>{{ order.customer }}</td>
                <td><span class="pill">{{ order.plan }}</span></td>
                <td class="table__num mono">{{ formatAmount(order) }}</td>
                <td><span class="pill" :class="statusMeta[order.status].cls">{{ statusMeta[order.status].label }}</span></td>
                <td class="muted mono">{{ formatDate(order.createdAt) }}</td>
                <td class="muted">{{ order.owner }}</td>
              </tr>
            </template>
            <tr v-else>
              <td colspan="7" class="table__empty">没有符合条件的订单</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="table-foot">
        <span class="muted">第 {{ data?.page ?? 1 }} / {{ totalPages }} 页</span>
        <div class="pager">
          <button class="btn btn--sm" :disabled="page <= 1 || loading" @click="go(1)">首页</button>
          <button class="btn btn--sm" :disabled="page <= 1 || loading" @click="go(page - 1)">上一页</button>
          <button class="btn btn--sm" :disabled="page >= totalPages || loading" @click="go(page + 1)">下一页</button>
          <button class="btn btn--sm" :disabled="page >= totalPages || loading" @click="go(totalPages)">末页</button>
        </div>
      </footer>
    </div>

    <!-- 详情抽屉 -->
    <Transition name="drawer">
      <aside v-if="selected" class="drawer" @click.self="selected = null">
        <div class="drawer__panel card">
          <header class="drawer__head">
            <h3 class="section-title">订单详情</h3>
            <button class="btn btn--ghost btn--sm" @click="selected = null">关闭</button>
          </header>
          <dl class="drawer__list">
            <div><dt>订单号</dt><dd class="mono">{{ selected.id }}</dd></div>
            <div><dt>客户</dt><dd>{{ selected.customer }}</dd></div>
            <div><dt>套餐</dt><dd>{{ selected.plan }}</dd></div>
            <div><dt>金额</dt><dd class="mono">{{ formatAmount(selected) }}</dd></div>
            <div><dt>状态</dt><dd><span class="pill" :class="statusMeta[selected.status].cls">{{ statusMeta[selected.status].label }}</span></dd></div>
            <div><dt>创建时间</dt><dd class="mono">{{ new Date(selected.createdAt).toLocaleString('zh-CN', { hour12: false }) }}</dd></div>
            <div><dt>负责人</dt><dd>{{ selected.owner }}</dd></div>
          </dl>
          <p class="drawer__note">数据来自 Mock API 的内存数据集合；刷新服务后序号会重新生成。</p>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.orders {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.orders__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.orders__eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 9px;
}

.orders__title {
  font-size: clamp(22px, 2.6vw, 28px);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}

.orders__sub {
  font-size: 12.5px;
  color: var(--text-muted);
}

.orders__sub code {
  font-family: var(--font-mono);
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #c7d3f0;
}

.orders__search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 13px;
  width: min(320px, 100%);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-input);
  color: var(--text-muted);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.orders__search:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(124, 157, 255, 0.16);
}

.orders__search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 12.5px;
  color: var(--text-primary);
}

.orders__search-input::placeholder {
  color: var(--text-muted);
}

.tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}

.tabs__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12.5px;
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

.tabs__count {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.tabs-row__hint {
  font-size: 11.5px;
  color: var(--text-muted);
}

.alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  font-size: 12.5px;
  color: #ffc2ca;
  border-color: rgba(255, 107, 129, 0.3);
  background: rgba(255, 107, 129, 0.06);
}

.table-card {
  overflow: hidden;
  padding: 0;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.table th {
  text-align: left;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.02);
}

.table td {
  padding: 13px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  white-space: nowrap;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table__row {
  cursor: pointer;
  transition: background 0.18s;
}

.table__row:hover {
  background: rgba(124, 157, 255, 0.06);
}

.table__id {
  color: #c7d3f0;
  font-weight: 600;
}

.table__num {
  text-align: right;
  font-weight: 600;
  color: var(--text-primary);
}

.table__empty {
  text-align: center;
  padding: 42px 16px !important;
  color: var(--text-muted);
}

.table-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  font-size: 11.5px;
  background: rgba(255, 255, 255, 0.015);
  flex-wrap: wrap;
}

.pager {
  display: flex;
  gap: 6px;
}

/* 抽屉 */
.drawer {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  background: rgba(3, 6, 14, 0.55);
  backdrop-filter: blur(4px);
}

.drawer__panel {
  width: min(400px, 92vw);
  height: 100%;
  border-radius: 0;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: var(--shadow-lg);
  background: var(--bg-elevated-solid);
}

.drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
}

.drawer__list > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-bottom: 1px dashed var(--border-subtle);
}

.drawer__list dt {
  font-size: 12px;
  color: var(--text-muted);
}

.drawer__list dd {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
}

.drawer__note {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
  margin-top: auto;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.24s var(--ease-out);
}

.drawer-enter-active .drawer__panel,
.drawer-leave-active .drawer__panel {
  transition: transform 0.28s var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer__panel,
.drawer-leave-to .drawer__panel {
  transform: translateX(24px);
}
</style>
