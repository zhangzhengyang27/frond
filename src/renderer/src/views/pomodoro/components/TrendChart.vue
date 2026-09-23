<template>
  <section class="trend-chart">
    <header class="chart-head">
      <h4>每日趋势</h4>
      <span class="chart-hint">柱=专注分钟，点=完成任务数</span>
    </header>
    <div v-if="points.length === 0" class="chart-empty">这段时间还没有记录</div>
    <svg v-else class="chart-svg" :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="每日专注趋势">
      <!-- 任务数折线走右侧独立刻度：与分钟数不同量纲，共用一根轴会让线贴地 -->
      <line
        :x1="PAD"
        :y1="plotBottom"
        :x2="W - PAD"
        :y2="plotBottom"
        class="axis"
        vector-effect="non-scaling-stroke"
      />
      <g v-for="(p, i) in points" :key="p.date">
        <rect
          :x="barX(i) - barW / 2"
          :y="barY(p.workMinutes)"
          :width="barW"
          :height="plotBottom - barY(p.workMinutes)"
          rx="2"
          class="bar"
        >
          <title>{{ p.date }} · 专注 {{ p.workMinutes }} 分钟</title>
        </rect>
        <circle :cx="barX(i)" :cy="dotY(p.completedTasks)" r="2.5" class="dot">
          <title>{{ p.date }} · 完成 {{ p.completedTasks }} 个任务</title>
        </circle>
      </g>
      <path :d="linePath" class="line" vector-effect="non-scaling-stroke" />
    </svg>
    <footer v-if="points.length > 0" class="chart-axis-labels">
      <span>{{ points[0].date.slice(5) }}</span>
      <span>{{ points[points.length - 1].date.slice(5) }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DailyTrendPoint } from '../../../stores/pomodoro'

/** 2026-09-23 重建件（原件全盘无副本）：形状按 StatisticsPanel 的 `:points="dailyTrend"` 与
 *  store 的 DailyTrendPoint 对齐，配色走 pomo token。 */
const props = defineProps<{ points: DailyTrendPoint[] }>()

const W = 640
const H = 180
const PAD = 12
const plotBottom = H - 22

const maxMinutes = computed(() => Math.max(1, ...props.points.map((p) => p.workMinutes)))
const maxTasks = computed(() => Math.max(1, ...props.points.map((p) => p.completedTasks)))
/** 柱子留一点顶：最高那天贴着上边框会读不出「还有没有更高」 */
const barTop = computed(() => 24)

const slot = computed(() => (W - PAD * 2) / Math.max(1, props.points.length))
const barW = computed(() => Math.max(3, Math.min(26, slot.value - 4)))

function barX(i: number): number {
  return PAD + slot.value * (i + 0.5)
}

function barY(minutes: number): number {
  const usable = plotBottom - barTop.value
  return plotBottom - (minutes / maxMinutes.value) * usable
}

function dotY(tasks: number): number {
  return plotBottom - (tasks / maxTasks.value) * (plotBottom - barTop.value)
}

const linePath = computed(() =>
  props.points
    .map(
      (p, i) => `${i === 0 ? 'M' : 'L'}${barX(i).toFixed(1)},${dotY(p.completedTasks).toFixed(1)}`
    )
    .join(' ')
)
</script>

<style scoped>
.trend-chart {
  padding: 12px 14px;
  border: 1px solid var(--pomo-glass-border);
  border-radius: 10px;
  background: var(--pomo-surface-container-low);
}

.chart-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}

.chart-head h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--pomo-text-strong);
}

.chart-hint {
  font-size: 11px;
  color: var(--pomo-text-muted);
}

.chart-empty {
  padding: 26px 0;
  text-align: center;
  font-size: 12px;
  color: var(--pomo-text-faint);
}

.chart-svg {
  display: block;
  width: 100%;
  height: 180px;
}

.axis {
  stroke: var(--pomo-outline-variant);
  stroke-width: 1;
}

.bar {
  fill: var(--pomo-work-soft);
}

.line {
  fill: none;
  stroke: var(--pomo-accent);
  stroke-width: 1.5;
}

.dot {
  fill: var(--pomo-accent);
}

.chart-axis-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--pomo-text-faint);
}
</style>
