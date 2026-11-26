<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SeriesPoint } from '@/types'

const props = defineProps<{
  series: SeriesPoint[]
  metric: 'visits' | 'signups' | 'revenue'
  loading?: boolean
}>()

const W = 760
const H = 260
const PAD = { top: 18, right: 12, bottom: 26, left: 44 }

const hoverIndex = ref<number | null>(null)

const values = computed(() => props.series.map((p) => p[props.metric]))
const maxValue = computed(() => {
  const max = Math.max(...values.value, 1)
  // 取整到较好看的刻度
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
  return Math.ceil(max / magnitude) * magnitude
})

const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom

function x(index: number) {
  if (props.series.length <= 1) return PAD.left + innerW / 2
  return PAD.left + (index / (props.series.length - 1)) * innerW
}

function y(value: number) {
  return PAD.top + innerH - (value / maxValue.value) * innerH
}

/** 生成平滑路径（Catmull-Rom → 三次贝塞尔） */
function smoothPath(points: Array<[number, number]>) {
  if (points.length === 0) return ''
  if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const tension = 0.18
    const c1x = p1[0] + (p2[0] - p0[0]) * tension
    const c1y = p1[1] + (p2[1] - p0[1]) * tension
    const c2x = p2[0] - (p3[0] - p1[0]) * tension
    const c2y = p2[1] - (p3[1] - p1[1]) * tension
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

const points = computed<Array<[number, number]>>(() =>
  props.series.map((p, i) => [x(i), y(p[props.metric])]),
)

const linePath = computed(() => smoothPath(points.value))
const areaPath = computed(() => {
  if (points.value.length === 0) return ''
  const base = PAD.top + innerH
  return `${linePath.value} L${points.value.at(-1)![0]},${base} L${points.value[0][0]},${base} Z`
})

const yTicks = computed(() => {
  const count = 4
  const step = maxValue.value / count
  return Array.from({ length: count + 1 }, (_, i) => {
    const value = step * i
    return { value, y: y(value), label: formatTick(value) }
  })
})

const xTicks = computed(() => {
  const len = props.series.length
  if (len === 0) return []
  const stride = len <= 8 ? 1 : Math.ceil(len / 6)
  return props.series
    .map((p, i) => ({ i, date: p.date, x: x(i) }))
    .filter((t) => t.i % stride === 0 || t.i === len - 1)
})

function formatTick(value: number) {
  if (props.metric === 'revenue') {
    return value >= 10000 ? `${(value / 10000).toFixed(0)}万` : `${Math.round(value / 1000)}k`
  }
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value))
}

function formatValue(value: number) {
  if (props.metric === 'revenue') {
    return '¥' + new Intl.NumberFormat('zh-CN').format(value)
  }
  return new Intl.NumberFormat('zh-CN').format(value)
}

const hovered = computed(() => {
  const i = hoverIndex.value
  if (i === null || !props.series[i]) return null
  const p = props.series[i]
  return {
    point: p,
    cx: x(i),
    cy: y(p[props.metric]),
    left: `${(x(i) / W) * 100}%`,
    top: `${(y(p[props.metric]) / H) * 100}%`,
  }
})

function onMove(event: MouseEvent) {
  const target = event.currentTarget as SVGElement
  const rect = target.getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width
  const index = Math.round(ratio * (props.series.length - 1))
  hoverIndex.value = Math.max(0, Math.min(props.series.length - 1, index))
}

function shortDate(date: string) {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}
</script>

<template>
  <div class="chart">
    <div v-if="loading" class="chart__loading">
      <div class="skeleton" style="height: 100%" />
    </div>

    <template v-else>
      <svg
        class="chart__svg"
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`${metric} 趋势图`"
        @mousemove="onMove"
        @mouseleave="hoverIndex = null"
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7c9dff" stop-opacity="0.42" />
            <stop offset="55%" stop-color="#7c9dff" stop-opacity="0.12" />
            <stop offset="100%" stop-color="#7c9dff" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#7c9dff" />
            <stop offset="60%" stop-color="#a78bfa" />
            <stop offset="100%" stop-color="#35e0c0" />
          </linearGradient>
        </defs>

        <!-- 横向网格 -->
        <g class="chart__grid">
          <line
            v-for="tick in yTicks"
            :key="`gy-${tick.value}`"
            :x1="PAD.left"
            :x2="W - PAD.right"
            :y1="tick.y"
            :y2="tick.y"
          />
        </g>

        <!-- 纵轴刻度 -->
        <g class="chart__axis">
          <text
            v-for="tick in yTicks"
            :key="`ty-${tick.value}`"
            :x="PAD.left - 10"
            :y="tick.y + 3.5"
            text-anchor="end"
          >
            {{ tick.label }}
          </text>
        </g>

        <path :d="areaPath" fill="url(#areaFill)" />
        <path
          :d="linePath"
          fill="none"
          stroke="url(#lineStroke)"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="chart__line"
        />

        <!-- 悬停指示 -->
        <g v-if="hovered">
          <line
            :x1="hovered.cx"
            :x2="hovered.cx"
            :y1="PAD.top"
            :y2="PAD.top + innerH"
            class="chart__crosshair"
          />
          <circle :cx="hovered.cx" :cy="hovered.cy" r="9" fill="rgba(124,157,255,0.18)" />
          <circle :cx="hovered.cx" :cy="hovered.cy" r="4" fill="#cfe0ff" stroke="#5b7cfa" stroke-width="2" />
        </g>

        <!-- 横轴标签 -->
        <g class="chart__axis">
          <text
            v-for="tick in xTicks"
            :key="`tx-${tick.i}`"
            :x="tick.x"
            :y="H - 8"
            text-anchor="middle"
          >
            {{ shortDate(tick.date) }}
          </text>
        </g>
      </svg>

      <div v-if="hovered" class="chart__tip" :style="{ left: hovered.left, top: hovered.top }">
        <span class="chart__tip-date">{{ hovered.point.date }}</span>
        <strong class="mono">{{ formatValue(hovered.point[metric]) }}</strong>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
  height: 260px;
}

.chart__loading {
  height: 100%;
  padding: 4px;
}

.chart__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.chart__grid line {
  stroke: rgba(148, 163, 184, 0.12);
  stroke-width: 1;
  stroke-dasharray: 3 5;
}

.chart__axis text {
  fill: var(--text-muted);
  font-size: 10.5px;
  font-family: var(--font-mono);
}

.chart__line {
  filter: drop-shadow(0 6px 18px rgba(91, 124, 250, 0.45));
}

.chart__crosshair {
  stroke: rgba(148, 163, 184, 0.4);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.chart__tip {
  position: absolute;
  transform: translate(-50%, -140%);
  padding: 7px 11px;
  border-radius: 10px;
  background: rgba(10, 15, 28, 0.94);
  border: 1px solid rgba(124, 157, 255, 0.36);
  box-shadow: var(--shadow-md);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  white-space: nowrap;
  z-index: 5;
}

.chart__tip-date {
  font-size: 10.5px;
  color: var(--text-muted);
}

.chart__tip strong {
  font-size: 13px;
  color: #dce6ff;
}
</style>
