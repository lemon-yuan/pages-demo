<script setup lang="ts">
import { computed } from 'vue'
import { requestLog } from '@/composables/useRequestLog'
import { apiBase } from '@/api/client'

const props = defineProps<{ collapsed?: boolean }>()

const endpoint = computed(() => {
  const base = apiBase || `${location.origin}`
  return base.replace(/^https?:\/\//, '').replace(/\/+$/, '') + '/api/*'
})
</script>

<template>
  <section class="net card" :class="{ 'net--collapsed': collapsed }">
    <header class="net__head">
      <h3 class="section-title">
        <span class="net__spark" aria-hidden="true" />
        网络请求
      </h3>
      <code class="net__endpoint mono" :title="endpoint">{{ endpoint }}</code>
    </header>

    <ul v-if="requestLog.length" class="net__list">
      <li v-for="item in requestLog" :key="item.id" class="net__item">
        <span class="net__method" :class="`net__method--${item.method.toLowerCase()}`">{{ item.method }}</span>
        <span class="net__path mono" :title="item.path">{{ item.path }}</span>
        <span
          class="net__status mono"
          :class="{
            'net__status--ok': typeof item.status === 'number' && item.status < 400,
            'net__status--warn': item.status === 401 || item.status === 403,
            'net__status--err': item.status === 'ERR' || (typeof item.status === 'number' && item.status >= 500),
          }"
        >
          {{ item.status }}
        </span>
        <span class="net__ms mono">{{ item.ms }}ms</span>
      </li>
    </ul>
    <p v-else class="net__empty">等待请求…（登录后即可看到前端 → API 的调用轨迹）</p>
  </section>
</template>

<style scoped>
.net {
  padding: 16px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.net__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.net__spark {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(53, 224, 192, 0.14);
}

.net__endpoint {
  font-size: 10.5px;
  color: var(--text-muted);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.net__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 218px;
  overflow-y: auto;
}

.net__item {
  display: grid;
  grid-template-columns: 44px 1fr 36px 46px;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 7px;
  font-size: 10.5px;
  transition: background 0.2s;
}

.net__item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.net__method {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  text-align: center;
  padding: 2px 0;
  border-radius: 5px;
  color: var(--text-secondary);
  background: rgba(148, 163, 184, 0.12);
}

.net__method--post {
  color: #c3d3ff;
  background: rgba(124, 157, 255, 0.16);
}

.net__path {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.net__status {
  text-align: right;
  font-weight: 700;
}

.net__status--ok {
  color: #8ef3dc;
}

.net__status--warn {
  color: var(--amber);
}

.net__status--err {
  color: var(--danger);
}

.net__ms {
  text-align: right;
  color: var(--text-muted);
}

.net__empty {
  font-size: 11.5px;
  color: var(--text-muted);
  padding: 6px 4px 10px;
}
</style>
