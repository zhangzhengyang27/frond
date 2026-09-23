<template>
  <section class="project-donut">
    <header class="chart-head">
      <h4>项目分布</h4>
      <span class="chart-hint">{{ totalLabel }}</span>
    </header>
    <div v-if="items.length === 0" class="chart-empty">还没有按项目聚合的数据</div>
    <div v-else class="donut-body">
      <svg class="donut" viewBox="0 0 42 42" role="img" aria-label="各项目专注时长占比">
        <circle cx="21" cy="21" r="15.915" class="track" />
        <!-- 半径取 15.915 让周长恰好 100：这样 stroke-dasharray 直接就是百分比，不用换算 -->
        <circle
          v-for="seg in segments"
          :key="seg.projectId ?? '__none'"
          cx="21"
          cy="21"
          r="15.915"
          class="slice"
          :stroke="seg.color"
          :stroke-dasharray="`${seg.percent} ${100 - seg.percent}`"
          :stroke-dashoffset="seg.offset"
        >
          <title>
            {{ seg.projectName }} · {{ seg.minutesLabel }}（{{ seg.percent.toFixed(0) }}%）
          </title>
        </circle>
      </svg>
      <ul class="legend">
        <li v-for="seg in segments" :key="seg.projectId ?? `__none-${seg.projectName}`">
          <span class="swatch" :style="{ background: seg.color }" />
          <span class="legend-name">{{ seg.projectName }}</span>
          <span class="legend-value">{{ seg.minutesLabel }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectDistributionPoint } from '../../../stores/pomodoro'

/** 2026-09-23 重建件（原件全盘无副本）：props 对齐 StatisticsPanel 的 `:items="projectDistribution"`。 */
const props = defineProps<{ items: ProjectDistributionPoint[] }>()

const FALLBACK_COLOR = 'var(--pomo-text-faint)'

const totalMinutes = computed(() => props.items.reduce((s, i) => s + i.workMinutes, 0))
const totalLabel = computed(() =>
  totalMinutes.value > 0 ? `共 ${Math.round(totalMinutes.value / 60)} 小时` : '暂无数据'
)

interface Segment extends ProjectDistributionPoint {
  percent: number
  /** 环从 12 点起画：每段往前挪掉前面已占掉的百分比 */
  offset: number
  minutesLabel: string
}

const segments = computed<Segment[]>(() => {
  let walked = 0
  return props.items.map((i) => {
    const percent = totalMinutes.value > 0 ? (i.workMinutes / totalMinutes.value) * 100 : 0
    const seg: Segment = {
      ...i,
      color: i.color || FALLBACK_COLOR,
      percent,
      offset: 25 - walked,
      minutesLabel: `${i.workMinutes} 分钟`
    }
    walked += percent
    return seg
  })
})
</script>

<style scoped>
.project-donut {
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

.donut-body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.donut {
  width: 92px;
  height: 92px;
  flex: 0 0 auto;
}

.track {
  fill: none;
  stroke: var(--pomo-ring-track);
  stroke-width: 5;
}

.slice {
  fill: none;
  stroke-width: 5;
}

.legend {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--pomo-text-soft);
}

.swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.legend-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-value {
  margin-left: auto;
  color: var(--pomo-text-muted);
}
</style>
