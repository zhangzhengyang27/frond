<template>
  <Transition name="drawer">
    <aside v-if="open" class="task-drawer" role="dialog" aria-label="任务详情">
      <div class="drawer-header">
        <div class="drawer-eyebrow">
          <span>任务详情</span>
          <ProjectChip v-if="detail?.project" :project="detail.project" />
        </div>
        <div class="drawer-title">
          <span :class="['priority-bar', `p${detail?.task.priority ?? 0}`]" aria-hidden="true" />
          <h2>{{ detail?.task.title || '加载中…' }}</h2>
          <button class="icon-btn" type="button" title="关闭" @click="close">
            <AppIcon icon="ri-close-line" />
          </button>
        </div>
        <p v-if="detail?.task.description" class="drawer-description">
          {{ detail.task.description }}
        </p>
      </div>

      <div class="drawer-body">
        <!-- 摘要卡片 -->
        <section v-if="summary" class="summary-grid">
          <div class="summary-card">
            <span class="summary-label">已完成番茄</span>
            <strong>{{ summary.pomodoroCount }}</strong>
            <span class="summary-unit">个</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">专注总时长</span>
            <strong>{{ formatMinutes(summary.workMs) }}</strong>
            <span class="summary-unit">h</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">预估</span>
            <strong>{{ summary.estimateMs ? formatMinutes(summary.estimateMs) : '—' }}</strong>
            <span class="summary-unit">{{ summary.estimateMs ? 'h' : '' }}</span>
          </div>
          <div class="summary-card" :class="{ over: overEstimate, under: underEstimate }">
            <span class="summary-label">偏差</span>
            <strong>{{ formatDeviation(summary.estimateDeviationMs) }}</strong>
            <span class="summary-unit">{{
              summary.estimateDeviationMs == null ? '' : overEstimate ? '超出' : '低于'
            }}</span>
          </div>
          <div class="summary-card summary-card-wide">
            <span class="summary-label">首次专注</span>
            <strong>{{ formatDate(summary.firstStartedAt) }}</strong>
          </div>
          <div class="summary-card summary-card-wide">
            <span class="summary-label">最近专注</span>
            <strong>{{ formatDate(summary.lastCompletedAt) }}</strong>
          </div>
        </section>

        <!-- 操作区 -->
        <section class="action-row">
          <button class="action-btn" type="button" :disabled="!records.length" @click="exportCSV">
            <AppIcon icon="ri-file-text-line" />
            <span>导出 CSV</span>
          </button>
          <button
            class="action-btn"
            type="button"
            :disabled="!records.length"
            @click="exportMarkdown"
          >
            <AppIcon icon="ri-markdown-line" />
            <span>导出 Markdown</span>
          </button>
          <button
            v-if="lastExportMessage"
            class="action-feedback"
            :class="lastExportOk ? 'ok' : 'err'"
            type="button"
            disabled
          >
            {{ lastExportMessage }}
          </button>
        </section>

        <!-- 时间轴 -->
        <section class="timeline-section">
          <header class="section-header">
            <h3>番茄时间轴</h3>
            <span class="section-meta">{{ records.length }} 条记录</span>
          </header>

          <p v-if="taskDetailLoading" class="empty">加载中…</p>
          <p v-else-if="records.length === 0" class="empty">还没有专注记录，开始第一个番茄吧。</p>

          <ol v-else class="timeline">
            <li
              v-for="record in records"
              :key="record.id"
              :class="['timeline-item', { selected: selectedRecordId === record.id }]"
              @click="selectRecord(record.id)"
            >
              <div class="timeline-dot" :data-type="record.type" />
              <div class="timeline-card">
                <div class="timeline-card-head">
                  <span class="timeline-mode">{{ modeLabel(record.type) }}</span>
                  <span class="timeline-time">{{ formatTime(record.completedAt) }}</span>
                </div>
                <div class="timeline-card-body">
                  <span class="timeline-duration">{{ formatMinutes(record.duration) }}</span>
                  <span class="timeline-meta"
                    >#{{ records.length - records.indexOf(record) }} / {{ records.length }}</span
                  >
                </div>
              </div>
            </li>
          </ol>
        </section>

        <!-- 单番茄详情 -->
        <PomodoroDetailPanel
          v-if="selectedRecordId"
          :record-id="selectedRecordId"
          @close="selectedRecordIdLocal = null"
        />

        <!-- M11：截图/录屏关联引导 -->
        <section class="assets-hint">
          <header class="section-header">
            <h3>截图 / 录屏</h3>
          </header>
          <p class="hint-text">
            截图按 ⌥⇧S（或下面的「开始截图」），录屏用「屏幕录制」模块；
            标题中包含本任务名称时会被自动索引（标题层匹配）。
          </p>
          <div class="hint-actions">
            <button class="action-btn" type="button" @click="startScreenshot">
              <AppIcon icon="ri-camera-line" />
              <span>开始截图</span>
            </button>
            <button class="action-btn" type="button" @click="goRecordingView">
              <AppIcon icon="ri-movie-line" />
              <span>打开录屏</span>
            </button>
          </div>
        </section>

        <!-- M4：自由番茄（未绑定任务）记录 -->
        <section class="free-records">
          <header class="section-header">
            <h3>自由番茄</h3>
            <span class="section-meta">{{ freeRecords.length }} 条未绑定</span>
          </header>
          <p v-if="freeRecords.length === 0" class="empty">没有未绑定的番茄记录。</p>
          <ol v-else class="timeline compact">
            <li v-for="r in freeRecords" :key="r.id" class="timeline-item">
              <div class="timeline-dot" :data-type="r.type" />
              <div class="timeline-card">
                <div class="timeline-card-head">
                  <span class="timeline-mode">{{ modeLabel(r.type) }}</span>
                  <span class="timeline-time">{{ formatTime(r.completedAt) }}</span>
                </div>
                <div class="timeline-card-body">
                  <span class="timeline-duration">{{ formatMinutes(r.duration) }}</span>
                </div>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </aside>
  </Transition>

  <!-- 背景遮罩 -->
  <Transition name="fade">
    <div v-if="open" class="drawer-overlay" @click="close" />
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import ProjectChip from './ProjectChip.vue'
import PomodoroDetailPanel from './PomodoroDetailPanel.vue'
import { usePomodoroStore } from '../../../stores/pomodoro'
import { exportTaskRecordsAsCSV, exportTaskRecordsAsMarkdown } from '../utils/exportTaskRecords'

interface Props {
  open: boolean
  taskId: string | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const store = usePomodoroStore()

const detail = computed(() => store.taskDetail)
const summary = computed(() => store.taskDetail?.summary ?? null)
const records = computed(() => store.taskDetail?.records ?? [])
const freeRecords = computed(() => store.freeRecords)
const taskDetailLoading = computed(() => store.taskDetailLoading)
const selectedRecordId = computed(() => store.selectedRecordId)

// 本地 state 留作子组件 emit 关闭使用
const selectedRecordIdLocal = ref<string | null>(null)

const lastExportMessage = ref<string | null>(null)
const lastExportOk = ref(false)

watch(
  () => [props.open, props.taskId] as const,
  async ([isOpen, id]) => {
    if (isOpen && id) {
      await store.openTaskDetail(id)
    } else if (!isOpen) {
      store.closeTaskDetail()
    }
  },
  { immediate: true }
)

function close(): void {
  emit('close')
  selectedRecordIdLocal.value = null
}

/**
 * 真的开始一次截图。以前这里是 `window.location.hash = '#/screenshot'`，
 * 而截图模块 2026-09-17 已下线、路由表里没有这条 → 主内容区整块空白。
 */
function startScreenshot(): void {
  void window.api.screenshot.startCapture()
}

function goRecordingView(): void {
  // 路由表中录屏模块是 /screenRecorder（#/recording 不存在 → 主内容区空白）
  window.location.hash = '#/screenRecorder'
}

function selectRecord(id: string): void {
  selectedRecordIdLocal.value = id
  store.loadRecordDetail(id)
}

function modeLabel(type: 'work' | 'shortBreak' | 'longBreak'): string {
  if (type === 'shortBreak') return '短休息'
  return '长休息'
}

function formatMinutes(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '0'
  const totalMin = Math.round(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}时`
  return `${h}时${m}分`
}

function formatDeviation(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const abs = Math.abs(Math.round(ms / 60_000))
  if (abs === 0) return '精准'
  return `${ms > 0 ? '+' : '-'}${abs}分`
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

const overEstimate = computed(() => {
  const dev = summary.value?.estimateDeviationMs
  return typeof dev === 'number' && dev > 60_000
})
const underEstimate = computed(() => {
  const dev = summary.value?.estimateDeviationMs
  return typeof dev === 'number' && dev < -60_000
})

async function exportCSV(): Promise<void> {
  if (!detail.value) return
  const res = await exportTaskRecordsAsCSV({
    task: detail.value.task,
    project: detail.value.project,
    records: records.value
  })
  showExportResult(res.ok, res.path ?? res.error ?? '未知错误')
}

async function exportMarkdown(): Promise<void> {
  if (!detail.value) return
  const res = await exportTaskRecordsAsMarkdown({
    task: detail.value.task,
    project: detail.value.project,
    records: records.value
  })
  showExportResult(res.ok, res.path ?? res.error ?? '未知错误')
}

function showExportResult(ok: boolean, msg: string): void {
  lastExportOk.value = ok
  lastExportMessage.value = msg
  setTimeout(() => {
    lastExportMessage.value = null
  }, 3500)
}
</script>

<style scoped>
.task-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(480px, 92vw);
  background: var(--pomodoro-drawer-bg);
  color: var(--pomodoro-drawer-text);
  box-shadow: var(--pomo-shadow-sidebar);
  display: flex;
  flex-direction: column;
  z-index: 1001;
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 1000;
}

.drawer-header {
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--pomodoro-drawer-border, rgba(0, 0, 0, 0.06));
}

.drawer-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pomo-text-muted);
  margin-bottom: 8px;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-title h2 {
  flex: 1;
}
</style>
