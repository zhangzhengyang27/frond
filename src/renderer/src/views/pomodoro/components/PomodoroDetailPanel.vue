<script setup lang="ts">
/**
 * PomodoroDetailPanel · 单个番茄的详情（由 TaskDetailDrawer 内嵌）
 * 2026-09-23 重建：原文件被截断，仅存 3 行脚本尾 + 1 条样式，模板与脚本头部为重建
 */
// formatDateTime / formatTime 收敛到 @utils/format
import { computed, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import { formatClockWithSeconds, formatDateTime } from '@utils/format'
import { usePomodoroStore } from '../../../stores/pomodoro'

const formatTime = formatClockWithSeconds

interface Props {
  recordId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const store = usePomodoroStore()

const record = computed(() => store.recordDetail?.record ?? null)
const task = computed(() => store.recordDetail?.task ?? null)

const modeLabel = computed(() => {
  const type = record.value?.type
  if (type === 'shortBreak') return '短休息'
  if (type === 'longBreak') return '长休息'
  return '专注'
})

const startedAt = computed(() => {
  if (!record.value) return 0
  return record.value.completedAt - record.value.duration
})

const durationText = computed(() => {
  if (!record.value) return '—'
  return `${Math.round(record.value.duration / 60_000)} 分`
})

watch(
  () => props.recordId,
  (id) => {
    if (id) store.loadRecordDetail(id)
  },
  { immediate: true }
)
</script>

<template>
  <!-- 待核：模板整体重建，字段取自 store.recordDetail（PomodoroRecordDetail） -->
  <section v-if="record" class="record-detail">
    <header class="record-head">
      <span class="record-mode">{{ modeLabel }}</span>
      <span class="record-date">{{ formatDateTime(record.completedAt) }}</span>
      <button class="record-close" type="button" title="收起" @click="emit('close')">
        <AppIcon icon="ri-close-line" />
      </button>
    </header>
    <dl class="record-grid">
      <div class="record-field">
        <dt>开始</dt>
        <dd>{{ formatTime(startedAt) }}</dd>
      </div>
      <div class="record-field">
        <dt>结束</dt>
        <dd>{{ formatTime(record.completedAt) }}</dd>
      </div>
      <div class="record-field">
        <dt>时长</dt>
        <dd>{{ durationText }}</dd>
      </div>
      <div v-if="task" class="record-field">
        <dt>任务</dt>
        <dd>{{ task.title }}</dd>
      </div>
    </dl>
  </section>
  <p v-else class="record-detail">番茄详情加载中…</p>
</template>

<style scoped>
.record-detail {
  margin-top: 24px;
  padding: 16px 18px;
  border-radius: 14px;
  background: rgba(0, 122, 255, 0.06);
  border: 1px solid var(--brand-500);
}

.record-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-mode {
  font-size: 13px;
  font-weight: 600;
  color: var(--pomo-text-strong);
}

.record-date {
  flex: 1;
  font-size: 12px;
  color: var(--pomo-text-muted);
}

.record-close {
  display: inline-flex;
  padding: 2px;
  border: 0;
  background: none;
  color: var(--pomo-text-muted);
  cursor: pointer;
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 12px 0 0;
}

.record-field {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
}

.record-field dt {
  color: var(--pomo-text-muted);
}

.record-field dd {
  margin: 0;
  color: var(--pomo-text-soft);
}
</style>
