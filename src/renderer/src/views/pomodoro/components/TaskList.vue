<script setup lang="ts">
/**
 * TaskList · 任务清单（新增 / 选中 / 完成 / 删除）
 * 2026-09-23 重建：原文件被截断，仅存 23 行脚本尾，脚本头部与模板为重建
 */
// 待核：当前仓库在用 TaskListPanel，本组件盘上零引用，接口按存留脚本反推
import { ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { PomodoroTask } from '../../../stores/pomodoro'

interface Props {
  tasks: PomodoroTask[]
  currentTaskId: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'add-task': [title: string]
  'select-task': [taskId: string | null]
  'delete-task': [taskId: string]
  'complete-task': [taskId: string]
}>()

const showAddInput = ref(false)
const newTaskTitle = ref('')

const handleAdd = (): void => {
  const title = newTaskTitle.value.trim()
  if (title) {
    emit('add-task', title)
    newTaskTitle.value = ''
    showAddInput.value = false
  }
}

const handleSelect = (taskId: string): void => {
  emit('select-task', props.currentTaskId === taskId ? null : taskId)
}

const handleDelete = (taskId: string): void => {
  emit('delete-task', taskId)
}

const handleComplete = (taskId: string): void => {
  emit('complete-task', taskId)
}
</script>

<template>
  <div class="task-list">
    <ul class="task-items">
      <li
        v-for="task in tasks"
        :key="task.id"
        class="task-item"
        :class="{ selected: currentTaskId === task.id, done: task.completed }"
      >
        <button class="task-check" type="button" title="完成" @click="handleComplete(task.id)">
          <AppIcon
            :icon="task.completed ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
          />
        </button>
        <button class="task-title" type="button" @click="handleSelect(task.id)">
          {{ task.title }}
        </button>
        <button class="task-delete" type="button" title="删除" @click="handleDelete(task.id)">
          <AppIcon icon="ri-delete-bin-line" />
        </button>
      </li>
    </ul>

    <button v-if="!showAddInput" class="task-add" type="button" @click="showAddInput = true">
      <AppIcon icon="ri-add-line" />
      <span>新任务</span>
    </button>
    <input
      v-else
      v-model="newTaskTitle"
      class="task-add-input"
      type="text"
      placeholder="任务标题，回车添加"
      @keyup.enter="handleAdd"
      @keyup.esc="showAddInput = false"
      @blur="showAddInput = false"
    />
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
}

.task-item.selected {
  background: var(--pomo-work-soft);
}

.task-item.done .task-title {
  color: var(--pomo-text-faint);
  text-decoration: line-through;
}

.task-check,
.task-delete,
.task-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border: 0;
  background: none;
  color: var(--pomo-text-muted);
  cursor: pointer;
}

.task-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  background: none;
  text-align: left;
  font-size: 13px;
  color: var(--pomo-text-strong);
  cursor: pointer;
}

.task-add {
  font-size: 12px;
  color: var(--pomo-text-muted);
}

.task-add-input {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--pomo-input-border);
  border-radius: 8px;
  background: var(--pomo-input-bg);
  color: var(--pomo-text-strong);
  font-size: 13px;
}
</style>
