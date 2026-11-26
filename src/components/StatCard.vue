<script setup lang="ts">
import { computed } from 'vue'
import type { Kpi } from '@/types'

const props = defineProps<{ kpi: Kpi; loading?: boolean; index?: number }>()

const displayValue = computed(() => {
  const { value, unit } = props.kpi
  if (unit === 'CNY') {
    return '¥' + new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)
  }
  if (unit === '%') return value.toFixed(1) + '%'
  return new Intl.NumberFormat('zh-CN').format(value)
})

const positive = computed(() => props.kpi.trend >= 0)
</script>

<template>
  <article
    class="stat card fade-up"
    :style="{ animationDelay: `${(index ?? 0) * 60}ms` }"
  >
    <header class="stat__head">
      <span class="stat__label">{{ kpi.label }}</span>
      <span class="stat__trend" :class="positive ? 'stat__trend--up' : 'stat__trend--down'">
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path
            :d="positive ? 'M6 2.5L10 8H2z' : 'M6 9.5L2 4h8z'"
            fill="currentColor"
          />
        </svg>
        {{ positive ? '+' : '' }}{{ kpi.trend.toFixed(1) }}%
      </span>
    </header>

    <div v-if="loading" class="stat__skeleton skeleton" />
    <p v-else class="stat__value mono">{{ displayValue }}</p>

    <footer class="stat__foot">
      <span class="stat__hint">{{ kpi.hint }}</span>
      <span class="stat__bar" aria-hidden="true">
        <i :style="{ width: `${Math.min(100, Math.abs(kpi.trend) * 9 + 22)}%` }" />
      </span>
    </footer>
  </article>
</template>

<style scoped>
.stat {
  padding: 18px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  transition: transform 0.28s var(--ease-out), border-color 0.28s;
}

.stat:hover {
  transform: translateY(-3px);
  border-color: rgba(124, 157, 255, 0.32);
}

.stat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stat__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.01em;
}

.stat__trend {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
}

.stat__trend--up {
  color: #8ef3dc;
  background: rgba(53, 224, 192, 0.12);
}

.stat__trend--down {
  color: #ffb3bd;
  background: rgba(255, 107, 129, 0.12);
}

.stat__value {
  font-size: clamp(22px, 2.4vw, 28px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.stat__skeleton {
  height: 32px;
  width: 70%;
}

.stat__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.stat__hint {
  font-size: 11px;
  color: var(--text-muted);
}

.stat__bar {
  flex: 1;
  max-width: 74px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  overflow: hidden;
}

.stat__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--gradient-brand);
  transition: width 0.8s var(--ease-out);
}
</style>
