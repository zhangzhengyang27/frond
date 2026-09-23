<template>
  <div class="task-dialog-mask" @click.self="emit('close')">
    <div class="task-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <header class="dialog-head">
        <h3>{{ title }}</h3>
        <button type="button" class="dialog-close" title="关闭" @click="emit('close')">
          <AppIcon icon="close" />
        </button>
      </header>

      <div class="dialog-body">
        <label class="field">
          <span class="field-label">标题</span>
          <input
            ref="titleInput"
            v-model="form.title"
            type="text"
            maxlength="200"
            placeholder="要做什么？"
          />
        </label>

        <label class="field">
          <span class="field-label">说明</span>
          <textarea v-model="form.description" rows="3" placeholder="补充细节（可选）"></textarea>
        </label>

        <div class="field-row">
          <label class="field field--third">
            <span class="field-label">优先级</span>
            <select v-model.number="form.priority">
              <option :value="0">无</option>
              <option :value="1">低</option>
              <option :value="2">中</option>
              <option :value="3">高</option>
            </select>
          </label>
          <label class="field field--third">
            <span class="field-label">预估（番茄）</span>
            <input v-model="form.estimate" type="number" min="0" step="0.5" placeholder="0" />
          </label>
          <div class="field field--third">
            <span class="field-label">项目</span>
            <select v-model="form.projectId">
              <option value="">无项目</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
            <button type="button" class="link-btn" @click="showNewProject = !showNewProject">
              <AppIcon icon="add" />
              新建项目
            </button>
          </div>
        </div>

        <div v-if="showNewProject" class="new-project">
          <input v-model="newProjectName" type="text" maxlength="40" placeholder="项目名称" />
          <div class="swatches">
            <button
              v-for="color in PROJECT_COLORS"
              :key="color"
              type="button"
              class="swatch"
              :class="{ active: newProjectColor === color }"
              :style="{ background: color }"
              :title="color"
              @click="newProjectColor = color"
            />
          </div>
          <button type="button" class="btn btn--ghost" @click="createProject">确定</button>
        </div>
      </div>

      <footer class="dialog-foot">
        <button type="button" class="btn btn--ghost" @click="emit('close')">取消</button>
        <template v-if="isCreate">
          <button type="button" class="btn" :disabled="!canSubmit" @click="submitCreate(false)">
            创建
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="!canSubmit"
            @click="submitCreate(true)"
          >
            创建并开始
          </button>
        </template>
        <button
          v-else
          type="button"
          class="btn btn--primary"
          :disabled="!canSubmit"
          @click="submit"
        >
          保存
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { PomodoroProject, PomodoroTask } from '../../../stores/pomodoro'

interface Props {
  task: PomodoroTask | null
  mode?: 'create' | 'edit'
  projects: PomodoroProject[]
  workDuration: number
  defaultProjectId?: string | null
}
const props = withDefaults(defineProps<Props>(), {
  mode: 'edit',
  defaultProjectId: null
})

const emit = defineEmits<{
  close: []
  save: [updates: Partial<PomodoroTask>]
  create: [
    payload: {
      title: string
      description: string
      priority: number
      projectId: string | null
      estimateMs: number | null
      startAfter: boolean
    }
  ]
  'create-project': [payload: { name: string; color: string }]
}>()

const PROJECT_COLORS = ['#3794f0', '#50c878', '#f59e0b', '#ba1a1a', '#9c7bff', '#8a8a8a']

const isCreate = computed(() => props.mode === 'create')
const title = computed(() => (isCreate.value ? '新建任务' : '编辑任务'))

const estimateOf = (ms: number | null | undefined): string => {
  if (!ms || ms <= 0 || props.workDuration <= 0) return ''
  const pomodoros = ms / (props.workDuration * 60_000)
  return pomodoros.toFixed(1).replace(/\.0$/, '')
}

const form = reactive({
  title: props.task?.title ?? '',
  description: props.task?.description ?? '',
  priority: props.task?.priority ?? 0,
  projectId: props.task?.projectId ?? props.defaultProjectId ?? '',
  estimate: estimateOf(props.task?.estimateMs)
})

const showNewProject = ref(false)
const newProjectName = ref('')
const newProjectColor = ref(PROJECT_COLORS[0])
const titleInput = ref<HTMLInputElement | null>(null)

const canSubmit = computed(() => form.title.trim().length > 0)

const estimateMs = computed<number | null>(() => {
  const pomodoros = Number.parseFloat(form.estimate)
  if (!Number.isFinite(pomodoros) || pomodoros <= 0 || props.workDuration <= 0) return null
  return Math.round(pomodoros * props.workDuration * 60_000)
})

// create-project 只能把名字带出去，父层建完再靠 projects 回填选中的 id
const pendingProjectName = ref('')
watch(
  () => props.projects,
  (list) => {
    if (!pendingProjectName.value) return
    const created = list.find((p) => p.name === pendingProjectName.value)
    if (!created) return
    form.projectId = created.id
    pendingProjectName.value = ''
  }
)

function createProject(): void {
  const name = newProjectName.value.trim()
  if (!name) return
  pendingProjectName.value = name
  emit('create-project', { name, color: newProjectColor.value })
  newProjectName.value = ''
  showNewProject.value = false
}

function submit(): void {
  const base = props.task
  if (!base || !canSubmit.value) return
  const patch: Partial<PomodoroTask> = {}
  if (form.title.trim() !== base.title) patch.title = form.title.trim()
  if (form.description.trim() !== (base.description ?? ''))
    patch.description = form.description.trim()
  if (form.priority !== base.priority) patch.priority = form.priority
  if (form.projectId !== (base.projectId ?? '')) patch.projectId = form.projectId || null
  if (estimateMs.value !== (base.estimateMs ?? null)) patch.estimateMs = estimateMs.value
  if (Object.keys(patch).length === 0) {
    emit('close')
    return
  }
  emit('save', patch)
}

function submitCreate(startAfter: boolean): void {
  if (!canSubmit.value) return
  emit('create', {
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    projectId: form.projectId || null,
    estimateMs: estimateMs.value,
    startAfter
  })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  void nextTick(() => titleInput.value?.focus())
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.task-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: dialog-fade 0.2s ease-out;
}

.task-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(520px, 100%);
  max-height: 90vh;
  overflow: hidden;
  padding: 18px 20px;
  background: var(--pomo-dialog-bg);
  border: 1px solid var(--pomo-dialog-border);
  border-radius: 18px;
  box-shadow: var(--pomo-shadow-elevated);
  color: var(--pomo-dialog-text);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.dialog-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--pomo-dialog-text);
}

.dialog-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  color: var(--pomo-dialog-muted);
  transition:
    background 0.16s,
    color 0.16s;
}

.dialog-close:hover {
  background: var(--pomo-input-bg);
  color: var(--pomo-dialog-text);
}

.dialog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.field-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.field--third {
  flex: 1 1 140px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--pomo-dialog-muted);
}

.field input,
.field textarea,
.field select,
.new-project input {
  width: 100%;
  padding: 8px 10px;
  background: var(--pomo-input-bg);
  border: 1px solid var(--pomo-input-border);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--pomo-dialog-text);
  transition: border-color 0.16s;
}

.field textarea {
  resize: vertical;
}

.field input:focus,
.field textarea:focus,
.field select:focus,
.new-project input:focus {
  outline: none;
  border-color: var(--pomo-work);
}

.link-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  color: var(--pomo-accent);
}

.new-project {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--pomo-input-bg);
  border: 1px solid var(--pomo-input-border);
  border-radius: 12px;
}

.swatches {
  display: flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}

.swatch.active {
  border-color: var(--pomo-dialog-text);
}

.dialog-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--pomo-dialog-border);
  border-radius: 999px;
  background: var(--pomo-input-bg);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--pomo-dialog-text);
  transition:
    opacity 0.16s,
    transform 0.16s;
}

.btn--ghost {
  background: transparent;
  color: var(--pomo-dialog-muted);
}

.btn--primary {
  background: var(--pomo-work);
  border-color: var(--pomo-work);
  color: var(--pomo-on-accent);
}

.btn:hover {
  opacity: 0.9;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@keyframes dialog-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
