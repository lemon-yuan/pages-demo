<script setup lang="ts">
import type { Channel } from '@/types'

defineProps<{ channels: Channel[]; loading?: boolean; total: number }>()
</script>

<template>
  <div class="channels">
    <template v-if="loading">
      <div v-for="i in 4" :key="i" class="channel channel--loading">
        <div class="skeleton" style="height: 12px; width: 42%" />
        <div class="skeleton" style="height: 8px; width: 100%" />
      </div>
    </template>

    <template v-else>
      <div v-for="(channel, index) in channels" :key="channel.key" class="channel fade-up" :style="{ animationDelay: `${index * 70}ms` }">
        <div class="channel__top">
          <span class="channel__name">
            <i class="channel__dot" :style="{ background: channel.color }" />
            {{ channel.name }}
          </span>
          <span class="channel__share mono">{{ channel.share.toFixed(1) }}%</span>
        </div>
        <div class="channel__track">
          <i
            class="channel__fill"
            :style="{
              width: `${channel.share}%`,
              background: `linear-gradient(90deg, ${channel.color}55, ${channel.color})`,
            }"
          />
        </div>
        <span class="channel__value mono">
          {{ new Intl.NumberFormat('zh-CN').format(channel.visits) }} 次访问
        </span>
      </div>

      <p class="channels__total">
        合计 <strong class="mono">{{ new Intl.NumberFormat('zh-CN').format(total) }}</strong> 次访问
      </p>
    </template>
  </div>
</template>

<style scoped>
.channels {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.channel {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.channel--loading {
  gap: 10px;
}

.channel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.channel__name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.channel__dot {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  box-shadow: 0 0 12px currentColor;
}

.channel__share {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.channel__track {
  height: 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  overflow: hidden;
}

.channel__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.9s var(--ease-out);
}

.channel__value {
  font-size: 10.5px;
  color: var(--text-muted);
}

.channels__total {
  padding-top: 12px;
  border-top: 1px dashed var(--border-subtle);
  font-size: 11.5px;
  color: var(--text-muted);
}

.channels__total strong {
  color: var(--text-primary);
  font-size: 12.5px;
}
</style>
