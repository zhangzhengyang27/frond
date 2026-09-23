<template>
  <section class="focus-records">
    <header class="records-head">
      <h4 class="records-title">今日专注</h4>
      <span class="records-meta">{{ metaLabel }}</span>
    </header>

    <p v-if="records.length === 0" class="records-empty">今天还没有完成的番茄。</p>
    <ul v-else class="records-list">
      <li v-for="record in records" :key="record.id" class="record">
        <span class="record-time">{{ formatClock(record.completedAt) }}</span>
        <span class="record-task" :title="record.taskTitle || '未归属'">
          {{ record.taskTitle || '未归属' }}
        </span>
        <span class="record-duration">{{ minutesLabel(record.duration) }}</span>
        <span class="record-badge" :class="`is-${record.type}`">{{ badgeLabel(record.type) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/** 2026-09-23 重建件（原件全盘无副本，按 index.vue 的用法与 props/emits 契约重建）。 */
import { computed } from 'vue'
import type { PomodoroRecord, TimerMode } from '../../../stores/pomodoro'
import { formatClock } from '@utils/format'

const props = defineProps<{ records: PomodoroRecord[] }>()

const metaLabel = computed(() => {
  const minutes = Math.round(props.records.reduce((sum, r) => sum + (r.duration || 0), 0) / 60_000)
  return `${props.records.length} 条 · ${minutes} 分钟`
})

function minutesLabel(ms: number): string {
  const minutes = Math.max(1, Math.round((ms || 0) / 60_000))
  return `${minutes} 分`
}

function badgeLabel(type: TimerMode): string {
  if (type === 'shortBreak') return '短休'
  if (type === 'longBreak') return '长休'
  return '专注'
}
</script>

<style scoped>
.focus-records {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--pomo-surface-container-low);
  border: 1px solid var(--pomo-glass-border);
  border-radius: 12px;
}

.records-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.records-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--pomo-text-strong);
}

.records-meta {
  font-size: 11px;
  color: var(--pomo-text-muted);
  font-variant-numeric: tabular-nums;
}

.records-empty {
  margin: 6px 0;
  font-size: 12px;
  color: var(--pomo-text-faint);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.record {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 5px 0;
  border-top: 1px solid var(--pomo-glass-border);
  font-size: 12px;
}

.record:first-child {
  border-top: none;
}

.record-time {
  flex: 0 0 auto;
  color: var(--pomo-text-muted);
  font-variant-numeric: tabular-nums;
}

.record-task {
  flex: 1;
  min-width: 0;
  color: var(--pomo-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-duration {
  flex: 0 0 auto;
  color: var(--pomo-text-muted);
  font-variant-numeric: tabular-nums;
}

.record-badge {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}

.record-badge.is-work {
  background: var(--pomo-work-soft);
  color: var(--pomo-work);
}

.record-badge.is-shortBreak {
  background: var(--pomo-short-soft);
  color: var(--pomo-short);
}

.record-badge.is-longBreak {
  background: var(--pomo-long-soft);
  color: var(--pomo-long);
}
</style>
