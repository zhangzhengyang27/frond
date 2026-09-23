<template>
  <div
    class="focus-assets"
    :class="{ 'is-active': streak.activeToday }"
    :title="`当前连续 ${streak.current} 天 · 历史最长 ${streak.longest} 天`"
  >
    <span class="asset-flame" aria-hidden="true">🔥</span>
    <span class="asset-text">连续 {{ streak.current }} 天</span>
    <span class="asset-divider" aria-hidden="true">·</span>
    <span class="asset-text asset-best">最长 {{ streak.longest }} 天</span>
    <span v-if="!streak.activeToday" class="asset-tag">今日待点亮</span>
    <span v-else class="asset-tag asset-tag--ok">今日已打卡</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePomodoroStore } from '../../../stores/pomodoro'

const store = usePomodoroStore()

const streak = computed(() => store.streak)
</script>

<style scoped>
.focus-assets {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--pomo-glass-border);
  border-radius: 999px;
  background: var(--pomo-surface-container-low);
  font-size: 12px;
  color: var(--pomo-text-soft);
}

/* 今天还没开始专注：整条降饱和，只留火焰本色 */
.focus-assets:not(.is-active) {
  color: var(--pomo-text-faint);
  border-style: dashed;
}

.asset-flame {
  font-size: 14px;
  filter: grayscale(0);
}

.focus-assets:not(.is-active) .asset-flame {
  filter: grayscale(1);
  opacity: 0.6;
}

.asset-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.focus-assets.is-active .asset-text {
  color: var(--pomo-text-strong);
}

.asset-divider {
  color: var(--pomo-text-faint);
}

.asset-tag {
  margin-left: auto;
  padding: 1px 8px;
  border: 1px solid var(--pomo-outline-variant);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--pomo-text-muted);
  white-space: nowrap;
}

.asset-tag--ok {
  border-color: var(--pomo-work);
  background: var(--pomo-work-soft);
  color: var(--pomo-work);
}
</style>
