<template>
  <!-- 待核：模板头部与 goal 条样式为 2026-09-23 重建（原件仅存 goal-fill 起的 4 行模板） -->
  <div class="zf-stats-bar" :class="{ active: streak.activeToday }">
    <div class="zf-stats-row">
      <span class="zf-stat-item" :title="`最长连续 ${streak.longest} 天`">
        <AppIcon icon="ri-fire-line" />
        <span>连续专注 {{ streak.current }} 天</span>
      </span>
      <span class="zf-stat-item">
        <AppIcon icon="ri-time-line" />
        <span>今日 {{ focusMinutes }} 分钟</span>
      </span>
      <span class="zf-stat-item">{{ workCount }} / {{ DAILY_GOAL }} 个</span>
    </div>
    <div class="zf-stats-goal" :title="`今日目标 ${DAILY_GOAL} 个番茄`">
      <div class="zf-stats-goal-fill" :style="{ width: `${goalPct}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@components/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    workCount?: number
    workDuration?: number
    streak?: { current: number; longest: number; activeToday: boolean }
  }>(),
  {
    workCount: 0,
    workDuration: 25,
    streak: () => ({ current: 0, longest: 0, activeToday: false })
  }
)

const DAILY_GOAL = 8

const focusMinutes = computed(() => props.workCount * props.workDuration)
const goalPct = computed(() => Math.min(100, (props.workCount / DAILY_GOAL) * 100))
</script>

<style scoped>
/* 单行紧凑数据条：连续专注 + 今日番茄（替代原两张大卡片，高度 44px） */
.zf-stats-bar {
  padding: 10px 12px 8px;
  background: var(--pomo-surface-container-low);
  border: 1px solid var(--pomo-glass-border);
  border-radius: 12px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.zf-stats-bar.active {
  border-color: rgba(245, 158, 11, 0.35);
}

.zf-stats-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zf-stat-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 12px;
  color: var(--pomo-text-soft);
  white-space: nowrap;
}

.zf-stats-goal {
  margin-top: 8px;
  height: 4px;
  border-radius: 999px;
  background: var(--pomo-surface-variant);
  overflow: hidden;
}

.zf-stats-goal-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--pomo-accent);
  transition: width 0.2s;
}
</style>
