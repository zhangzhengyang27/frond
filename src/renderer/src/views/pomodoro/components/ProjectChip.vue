<template>
  <span class="project-chip" :title="`项目：${project.name}`">
    <span class="dot" :style="{ background: project.color || 'var(--pomo-text-faint)' }" />
    <span class="name">{{ project.name }}</span>
  </span>
</template>

<script setup lang="ts">
import type { PomodoroProject } from '../../../stores/pomodoro'

/** 2026-09-23 重建件（原件全盘无副本）：只用于任务详情标题行，形状按 detail.project。 */
defineProps<{ project: PomodoroProject }>()
</script>

<style scoped>
.project-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 160px;
  padding: 2px 8px;
  border: 1px solid var(--pomo-glass-border);
  border-radius: 999px;
  background: var(--pomo-surface-container-low);
  font-size: 11px;
  color: var(--pomo-text-soft);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
