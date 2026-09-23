<template>
  <section class="task-completion">
    <header class="chart-head">
      <h4>任务完成度</h4>
      <span class="chart-hint">{{ taskStats.total }} 个任务</span>
    </header>
    <div class="stat-row">
      <div class="stat">
        <span class="stat-value">{{ rateLabel }}</span>
        <span class="stat-label">完成率</span>
        <div class="rate-track"><div class="rate-fill" :style="{ width: rateLabel }" /></div>
      </div>
      <div class="stat">
        <span class="stat-value">{{ taskStats.completed }}</span>
        <span class="stat-label">已完成 / {{ taskStats.total }}</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ taskStats.completedPomodoros }}</span>
        <span class="stat-label">投入番茄数</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ avgPomodorosLabel }}</span>
        <span class="stat-label">每任务平均番茄</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ deviationLabel }}</span>
        <span class="stat-label">预估偏差（{{ overLabel }}超 / {{ underLabel }}低）</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskCompletionStats } from '../../../stores/pomodoro'

/** 2026-09-23 重建件（原件全盘无副本）：字段取 store 的 TaskCompletionStats，
 *  completionRate 是 0–1（PomodoroRepository 按 completed/total 算），这里才乘 100。 */
const props = defineProps<{ taskStats: TaskCompletionStats }>()

const rateLabel = computed(() => `${Math.round(props.taskStats.completionRate * 100)}%`)
const avgPomodorosLabel = computed(() => props.taskStats.avgPomodorosPerTask.toFixed(1))
const overLabel = computed(() => props.taskStats.estimateOverCount)
const underLabel = computed(() => props.taskStats.estimateUnderCount)

/** 偏差中位数级别的量纲是毫秒；15 分钟以内说「分钟」，再往上说「小时」 */
const deviationLabel = computed(() => {
  const ms = Math.abs(props.taskStats.avgEstimateDeviationMs)
  const sign = props.taskStats.avgEstimateDeviationMs < 0 ? '-' : ''
  const minutes = ms / 60000
  if (minutes < 60) return `${sign}${Math.round(minutes)} 分`
  return `${sign}${(minutes / 60).toFixed(1)} 小时`
})
</script>

<style scoped>
.task-completion {
  padding: 12px 14px;
  margin-bottom: 12px;
  border: 1px solid var(--pomo-glass-border);
  border-radius: 10px;
  background: var(--pomo-surface-container-low);
}

.chart-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
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

.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-value {
  font-size: 17px;
  font-weight: 600;
  color: var(--pomo-text-strong);
}

.stat-label {
  font-size: 11px;
  color: var(--pomo-text-muted);
}

.rate-track {
  height: 3px;
  border-radius: 2px;
  background: var(--pomo-ring-track);
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  background: var(--pomo-accent);
}
</style>
