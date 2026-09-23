<template>
  <section class="task-panel">
    <header class="panel-head">
      <h4 class="panel-title">任务</h4>
      <span class="panel-meta">{{ pendingCount }} 待办</span>
    </header>

    <p v-if="tasks.length === 0" class="panel-empty">还没有任务，点上方「新建任务」添加。</p>
    <ul v-else class="task-rows">
      <li
        v-for="task in tasks"
        :key="task.id"
        class="task-row"
        :class="{ current: task.id === currentTaskId, done: task.completed }"
        @click="emit('select', task.id)"
      >
        <button
          type="button"
          class="row-check"
          :title="task.completed ? '标记为未完成' : '标记完成'"
          @click.stop="emit('complete', task.id)"
        >
          <AppIcon :icon="task.completed ? 'checkbox-circle' : 'checkbox-blank-circle'" />
        </button>

        <div class="row-body">
          <button
            type="button"
            class="row-title"
            :title="`${task.title}（点击查看详情）`"
            @click.stop="emit('open-detail', task.id)"
          >
            {{ task.title }}
          </button>
          <div class="row-meta">
            <span v-if="projectOf(task)" class="row-project">
              <span class="row-dot" :style="{ background: projectOf(task)?.color }" />
              {{ projectOf(task)?.name }}
            </span>
            <span v-if="task.priority > 0" class="row-priority" :class="`p${task.priority}`">
              <AppIcon icon="flag" />
              {{ priorityLabel(task.priority) }}
            </span>
            <span v-if="estimateLabel(task)" class="row-estimate"
              >🍅 {{ estimateLabel(task) }}</span
            >
          </div>
        </div>

        <div class="row-actions">
          <button
            v-if="!task.completed"
            type="button"
            class="row-btn start"
            title="开始这个番茄"
            @click.stop="emit('start', task.id)"
          >
            <AppIcon icon="play" />
          </button>
          <button
            type="button"
            class="row-btn"
            title="编辑任务"
            @click.stop="emit('edit', task.id)"
          >
            <AppIcon icon="edit" />
          </button>
          <button
            type="button"
            class="row-btn danger"
            title="删除任务"
            @click.stop="removeTask(task)"
          >
            <AppIcon icon="delete-bin" />
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/** 2026-09-23 重建件（原件全盘无副本，按 index.vue 的用法与 props/emits 契约重建）。 */
import { computed } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { PomodoroProject, PomodoroTask } from '../../../stores/pomodoro'

interface Props {
  tasks: PomodoroTask[]
  projects: PomodoroProject[]
  currentTaskId: string | null
  workDuration: number
}
const props = defineProps<Props>()

const emit = defineEmits<{
  select: [id: string]
  start: [id: string]
  complete: [id: string]
  edit: [id: string]
  'open-detail': [id: string]
  delete: [id: string]
}>()

const pendingCount = computed(() => props.tasks.filter((t) => !t.completed).length)

function projectOf(task: PomodoroTask): PomodoroProject | undefined {
  if (!task.projectId) return undefined
  return props.projects.find((p) => p.id === task.projectId)
}

function priorityLabel(priority: number): string {
  if (priority >= 3) return '高'
  if (priority === 2) return '中'
  return '低'
}

function estimateLabel(task: PomodoroTask): string {
  const ms = task.estimateMs
  if (!ms || ms <= 0 || props.workDuration <= 0) return ''
  const pomodoros = ms / (props.workDuration * 60_000)
  return pomodoros < 10 ? pomodoros.toFixed(1).replace(/\.0$/, '') : String(Math.round(pomodoros))
}

function removeTask(task: PomodoroTask): void {
  if (!window.confirm(`删除任务「${task.title}」？此操作不可撤销。`)) return
  emit('delete', task.id)
}
</script>

<style scoped>
.task-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
}

.panel-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pomo-text-muted);
}

.panel-meta {
  font-size: 11px;
  color: var(--pomo-text-faint);
}

.panel-empty {
  margin: 4px 0 8px;
  padding: 14px;
  border: 1px dashed var(--pomo-outline-variant);
  border-radius: 10px;
  text-align: center;
  font-size: 12px;
  color: var(--pomo-text-faint);
}

.task-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.task-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--pomo-surface-container-low);
  cursor: pointer;
  transition:
    background 0.18s,
    border-color 0.18s;
}

.task-row:hover {
  background: var(--pomo-surface-container);
}

.task-row.current {
  border-color: var(--pomo-work);
  background: var(--pomo-work-soft);
}

.row-check {
  flex: 0 0 auto;
  margin-top: 1px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  color: var(--pomo-text-faint);
  transition: color 0.18s;
}

.row-check:hover {
  color: var(--pomo-work);
}

.task-row.done .row-check {
  color: var(--pomo-short);
}

.row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-title {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--pomo-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-title:hover {
  text-decoration: underline;
}

.task-row.done .row-title {
  color: var(--pomo-text-faint);
  text-decoration: line-through;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--pomo-text-muted);
}

.row-project {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.row-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.row-priority {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.row-priority i {
  font-size: 11px;
}

.row-priority.p1 {
  color: var(--pomo-priority-low);
}

.row-priority.p2 {
  color: var(--pomo-priority-med);
}

.row-priority.p3 {
  color: var(--pomo-priority-high);
}

.row-estimate {
  font-variant-numeric: tabular-nums;
}

.row-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}

.task-row:hover .row-actions,
.task-row:focus-within .row-actions,
.task-row.current .row-actions {
  opacity: 1;
  pointer-events: auto;
}

.row-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--pomo-text-muted);
  transition:
    background 0.16s,
    color 0.16s;
}

.row-btn:hover {
  background: var(--pomo-surface-variant);
  color: var(--pomo-text-strong);
}

.row-btn.start:hover {
  color: var(--pomo-work);
}

.row-btn.danger:hover {
  color: var(--pomo-priority-high);
}
</style>
