<template>
  <section class="hour-heatmap">
    <header class="chart-head">
      <h4>专注热力</h4>
      <span class="chart-hint">行=星期，列=小时</span>
    </header>
    <div v-if="cells.length === 0" class="chart-empty">还没有分时的专注记录</div>
    <div v-else class="heat-grid" :style="{ gridTemplateColumns: `28px repeat(24, 1fr)` }">
      <span class="corner" />
      <span v-for="h in hours" :key="`h-${h}`" class="hour-label">{{ h % 6 === 0 ? h : '' }}</span>
      <template v-for="d in dayIndexes" :key="`d-${d}`">
        <span class="day-label">{{ dayNames[d] }}</span>
        <span
          v-for="h in hours"
          :key="`c-${d}-${h}`"
          class="cell"
          :style="{ background: backgroundOf(d, h) }"
          :title="titleOf(d, h)"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HeatmapCell } from '../../../stores/pomodoro'

/** 2026-09-23 重建件（原件全盘无副本）：props 对齐 StatisticsPanel 的 `:cells="focusHeatmap"`。 */
const props = defineProps<{ cells: HeatmapCell[] }>()

const hours = Array.from({ length: 24 }, (_, i) => i)
const dayNames = ['一', '二', '三', '四', '五', '六', '日']

/** 格子的 `day` 从哪天开始由主进程决定，这里不猜：按数据里出现过的值排出来 */
const dayIndexes = computed(() => [...new Set(props.cells.map((c) => c.day))].sort((a, b) => a - b))

const byKey = computed(() => {
  const m = new Map<string, HeatmapCell>()
  for (const c of props.cells) m.set(`${c.day}:${c.hour}`, c)
  return m
})

const maxMinutes = computed(() => Math.max(1, ...props.cells.map((c) => c.workMinutes)))

function backgroundOf(day: number, hour: number): string {
  const cell = byKey.value.get(`${day}:${hour}`)
  if (!cell || cell.workMinutes <= 0) return 'var(--pomo-ring-track)'
  // 0.18 起步：再淡就跟空格子分不出来了
  const alpha = 0.18 + 0.82 * Math.min(1, cell.workMinutes / maxMinutes.value)
  return `color-mix(in srgb, var(--pomo-work) ${Math.round(alpha * 100)}%, transparent)`
}

function titleOf(day: number, hour: number): string {
  const cell = byKey.value.get(`${day}:${hour}`)
  if (!cell || cell.workMinutes <= 0) return `${cell?.date ?? ''} ${hour}:00 无专注`
  return `${cell.date} ${hour}:00 · 专注 ${cell.workMinutes} 分钟`
}
</script>

<style scoped>
.hour-heatmap {
  padding: 12px 14px;
  border: 1px solid var(--pomo-glass-border);
  border-radius: 10px;
  background: var(--pomo-surface-container-low);
}

.chart-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
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
  padding: 22px 0;
  text-align: center;
  font-size: 12px;
  color: var(--pomo-text-faint);
}

.heat-grid {
  display: grid;
  gap: 2px;
  align-items: center;
}

.corner,
.day-label,
.hour-label {
  font-size: 9px;
  color: var(--pomo-text-faint);
}

.hour-label {
  text-align: center;
}

.cell {
  height: 12px;
  border-radius: 2px;
}
</style>
