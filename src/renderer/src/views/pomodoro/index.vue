<template>
  <div class="zf-root">
    <!-- Ambient Background -->
    <div class="zf-bg-blob zf-bg-blob--a" aria-hidden="true" />
    <div class="zf-bg-blob zf-bg-blob--b" aria-hidden="true" />

    <!-- Glass Header -->
    <header class="zf-header">
      <div class="zf-brand">
        <span class="zf-brand-dot" aria-hidden="true" />
        <span class="zf-brand-name">ZenFocus</span>
      </div>
      <ModeSelector
        :current-mode="currentMode"
        settings-title="番茄钟设置"
        @switch="switchMode"
        @open-settings="showSettings = true"
      />
    </header>

    <!-- Body: 70/30 Split -->
    <div class="zf-body">
      <!-- ═══ Main Stage ═══ -->
      <main class="zf-main">
        <!-- Background Projects (only show when other projects have active timers) -->
        <div v-if="backgroundProjects.length" class="zf-project-row">
          <div class="zf-bg-chips">
            <span
              v-for="bg in backgroundProjects"
              :key="bg.projectId"
              class="zf-bg-chip"
              :title="`${bg.name} · ${bg.timeLeftFormatted}`"
            >
              <span class="zf-dot zf-dot--sm" :style="{ background: bg.color }" />
              {{ bg.name }} · {{ bg.timeLeftFormatted }}
            </span>
            <button
              v-if="hasAnyActiveBackground"
              type="button"
              class="zf-stop-all"
              title="停止所有项目中的计时器"
              @click="stopAllTimers"
            >
              全部停止
            </button>
          </div>
        </div>

        <!-- Focus Card -->
        <section class="zf-focus-card" :class="{ 'is-empty': !currentTask }">
          <template v-if="currentTask">
            <div class="zf-focus-indicator" :class="{ live: isRunning }">
              <span class="zf-blink-dot" />
              <span class="zf-focus-tag">{{
                isRunning ? '专注中' : isPaused ? '已暂停' : '待开始'
              }}</span>
            </div>
            <h2 class="zf-focus-title" :title="currentTask.title">{{ currentTask.title }}</h2>
            <div class="zf-focus-actions">
              <button
                v-if="!isRunning"
                type="button"
                class="zf-btn zf-btn--filled"
                @click="startTimer"
              >
                <AppIcon icon="ri-play-fill" />开始
              </button>
              <button
                v-else
                type="button"
                class="zf-btn zf-btn--filled"
                :disabled="strictPauseBlocked"
                :title="strictPauseBlocked ? '严格模式：不允许暂停' : ''"
                @click="pauseTimer"
              >
                <AppIcon :icon="strictPauseBlocked ? 'ri-lock-line' : 'ri-pause-fill'" />{{
                  strictPauseBlocked ? '严格中' : '暂停'
                }}
              </button>
              <button
                v-if="flowtimeWork && (isRunning || isPaused) && elapsed >= 10"
                type="button"
                class="zf-btn"
                title="结束并记录本次正计时"
                @click="handleFinishFlowtime"
              >
                <AppIcon icon="ri-stop-circle-line" />完成
              </button>
              <button
                type="button"
                class="zf-btn zf-btn--icon"
                title="清除当前任务"
                @click="handleClearCurrentTask"
              >
                <AppIcon icon="ri-close-line" />
              </button>
            </div>
          </template>
          <div v-else class="zf-focus-empty">
            <AppIcon icon="ri-lightbulb-flash-line" />
            <span v-if="showProjectSelector">从右侧任务列表选一个开始专注</span>
            <span v-else>创建项目并添加任务，即可开始专注</span>
          </div>
        </section>

        <!-- Timer Ring -->
        <TimerRing
          :time-left="timeLeft"
          :duration="duration"
          :mode="currentMode"
          :is-running="isRunning"
          :is-paused="isPaused"
          :label="currentTask?.title ?? ''"
          :hint="currentModeLabel"
          :flowtime="flowtimeWork"
        />

        <!-- Long Break Resume Banner -->
        <div v-if="showLongBreakResumeBanner" class="zf-resume-banner">
          <div class="zf-resume-text">
            <strong>长休息结束</strong>
            <span>准备好下一轮专注吗？</span>
          </div>
          <button class="zf-btn zf-btn--filled" type="button" @click="startTimer">
            开始下一轮
          </button>
        </div>

        <!-- Mode Switch Confirm -->
        <div v-if="showModeConfirm" class="zf-resume-banner">
          <div class="zf-resume-text">
            <strong>切换模式</strong>
            <span>计时器正在运行，切换将重置当前计时，确定吗？</span>
          </div>
          <div class="zf-resume-actions">
            <button class="zf-btn zf-btn--icon" type="button" @click="showModeConfirm = false">
              <AppIcon icon="ri-close-line" />
            </button>
            <button class="zf-btn zf-btn--filled" type="button" @click="confirmModeSwitch">
              确定切换
            </button>
          </div>
        </div>

        <!-- 严格模式：失焦作废提示 -->
        <div v-if="strictFailHint" class="zf-resume-banner">
          <div class="zf-resume-text">
            <strong>严格模式</strong>
            <span>检测到离开窗口，本番茄已作废</span>
          </div>
        </div>

        <!-- Bottom Toolbar -->
        <div class="zf-toolbar">
          <button type="button" class="zf-tool-btn" title="全屏" @click="toggleFullscreen">
            <AppIcon icon="ri-fullscreen-line" />
          </button>
          <button
            type="button"
            class="zf-tool-btn"
            :class="{ active: isSpecialBreak }"
            title="特殊休息（午休 / 晚饭，不占番茄循环）"
            @click="specialBreakOpen = !specialBreakOpen"
          >
            <AppIcon icon="ri-restaurant-line" />
          </button>
          <button
            type="button"
            class="zf-tool-btn"
            :class="{ active: soundscape.current.value !== 'none' }"
            title="声景白噪音"
            @click="soundscapeOpen = !soundscapeOpen"
          >
            <AppIcon
              :icon="soundscape.current.value !== 'none' ? 'ri-music-2-fill' : 'ri-music-line'"
            />
          </button>
          <button
            type="button"
            class="zf-tool-btn"
            :class="{ active: isFlowtime }"
            :title="isFlowtime ? '切换为倒计时番茄' : '切换为正计时（Flowtime）'"
            @click="toggleTimerStyle"
          >
            <AppIcon :icon="isFlowtime ? 'ri-timer-flash-line' : 'ri-timer-line'" />
          </button>
          <button type="button" class="zf-tool-btn" title="迷你窗口" @click="toggleMiniWindow">
            <AppIcon icon="ri-picture-in-picture-line" />
          </button>
          <button
            type="button"
            class="zf-tool-btn"
            :class="{ active: focusModeEnabled }"
            :title="focusModeEnabled ? '退出专注模式' : '专注模式'"
            @click="toggleFocusMode"
          >
            <AppIcon :icon="focusModeEnabled ? 'ri-moon-fill' : 'ri-moon-line'" />
          </button>
          <span class="zf-tool-divider" />
          <span class="zf-tool-label">{{ settings.workDuration }} 分钟</span>
        </div>

        <!-- 特殊休息时长浮层 -->
        <div v-if="specialBreakOpen" class="zf-sound-pop">
          <div class="zf-sound-grid">
            <button
              v-for="m in SPECIAL_BREAK_OPTIONS"
              :key="m"
              type="button"
              class="zf-sound-chip"
              @click="handleSpecialBreak(m)"
            >
              <AppIcon icon="ri-time-line" />
              <span>{{ m }} 分钟</span>
            </button>
          </div>
        </div>

        <!-- 声景选择浮层 -->
        <div v-if="soundscapeOpen" class="zf-sound-pop">
          <div class="zf-sound-grid">
            <button
              v-for="sc in SOUNDSCAPES"
              :key="sc.id"
              type="button"
              class="zf-sound-chip"
              :class="{ active: soundscape.current.value === sc.id }"
              @click="pickSoundscape(sc.id)"
            >
              <AppIcon :icon="sc.icon" />
              <span>{{ sc.label }}</span>
            </button>
          </div>
          <div class="zf-sound-volume">
            <AppIcon icon="ri-volume-down-line" />
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round(soundscapeVolume * 100)"
              @input="onSoundscapeVolume"
            />
            <AppIcon icon="ri-volume-up-line" />
          </div>
        </div>
      </main>

      <!-- ═══ Glass Sidebar ═══ -->
      <aside class="zf-sidebar">
        <!-- Sidebar Header -->
        <div class="zf-sidebar-head">
          <div class="zf-avatar">
            <AppIcon icon="ri-user-smile-line" />
          </div>
          <div class="zf-greeting">
            <span class="zf-greeting-title">今天也要加油</span>
            <span class="zf-greeting-sub">已完成 {{ statistics.today.work }} 个番茄钟</span>
          </div>
          <!-- 新建任务按钮移至右上角 -->
          <button
            type="button"
            class="zf-new-task-compact"
            title="新建任务"
            @click="openCreateDialog"
          >
            <AppIcon icon="ri-add-line" />
            <span>新建任务</span>
          </button>
        </div>

        <!-- Nav Tabs -->
        <nav class="zf-nav">
          <div class="zf-nav-indicator" :style="navIndicatorStyle" />
          <button
            type="button"
            :class="['zf-nav-item', { active: sidePanelTab === 'main' }]"
            @click="sidePanelTab = 'main'"
          >
            <AppIcon icon="ri-time-line" />
            <span>今日</span>
          </button>
          <button
            type="button"
            :class="['zf-nav-item', { active: sidePanelTab === 'stats' }]"
            @click="switchToStats"
          >
            <AppIcon icon="ri-bar-chart-box-line" />
            <span>统计</span>
          </button>
        </nav>

        <!-- Panel Content -->
        <div class="zf-panel-scroll">
          <template v-if="sidePanelTab === 'main'">
            <TodayStatsBar
              :work-count="statistics.today.work"
              :work-duration="settings.workDuration"
              :streak="store.streak"
            />
            <FocusAssets class="zf-streak" />
            <TaskListPanel
              :tasks="focusedTasks"
              :projects="projects"
              :current-task-id="currentTaskId"
              :work-duration="settings.workDuration"
              @select="handleSelectTask"
              @start="handleStartTask"
              @complete="handleCompleteTask"
              @edit="handleEditTask"
              @open-detail="handleOpenTaskDetail"
              @delete="handleDeleteTask"
            />
            <FocusRecordPanel :records="todayRecords" />
          </template>
          <StatisticsPanel v-else />
        </div>

        <!-- Daily Progress -->
        <div class="zf-progress">
          <div class="zf-progress-meta">
            <span>今日进度</span>
            <span class="zf-progress-num"
              >{{ Math.min(100, Math.round((statistics.today.work / 8) * 100)) }}%</span
            >
          </div>
          <div class="zf-progress-track">
            <div
              class="zf-progress-fill"
              :style="{ width: Math.min(100, (statistics.today.work / 8) * 100) + '%' }"
            />
          </div>
        </div>
      </aside>
    </div>

    <!-- ═══ Dialogs & Drawers ═══ -->
    <TaskEditDialog
      v-if="selectedTaskForEdit"
      :task="selectedTaskForEdit"
      :projects="projects"
      :work-duration="settings.workDuration"
      @close="editingTaskId = null"
      @save="handleSaveTask"
      @create-project="handleCreateProject"
    />

    <TaskEditDialog
      v-if="creatingTask"
      mode="create"
      :task="null"
      :projects="projects"
      :work-duration="settings.workDuration"
      :default-project-id="focusedProjectId"
      @close="creatingTask = false"
      @create="handleCreateTask"
      @create-project="handleCreateProject"
    />

    <SettingsDialog
      v-if="showSettings"
      :show="showSettings"
      @close="showSettings = false"
      @save="handleSaveSettings"
    />

    <TaskDetailDrawer
      :open="!!taskDetailId"
      :task-id="taskDetailId"
      @close="handleCloseTaskDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePomodoroStore, type TimerMode } from '../../stores/pomodoro'
import {
  ensurePomodoroBridgeSync,
  subscribeStrictFail
} from '../../composables/usePomodoroAppBridge'
import { SOUNDSCAPES, useSoundscapes, type SoundscapeId } from './composables/useSoundscapes'
import AppIcon from '@components/AppIcon.vue'
import SettingsDialog from '@views/pomodoro/components/SettingsDialog.vue'
import TimerRing from '@views/pomodoro/components/TimerRing.vue'
import ModeSelector from '@views/pomodoro/components/ModeSelector.vue'
import TaskListPanel from '@views/pomodoro/components/TaskListPanel.vue'
import TaskEditDialog from '@views/pomodoro/components/TaskEditDialog.vue'
import TaskDetailDrawer from '@views/pomodoro/components/TaskDetailDrawer.vue'
import FocusRecordPanel from '@views/pomodoro/components/FocusRecordPanel.vue'
import StatisticsPanel from '@views/pomodoro/components/StatisticsPanel.vue'
import TodayStatsBar from '@views/pomodoro/components/TodayStatsBar.vue'
import FocusAssets from '@views/pomodoro/components/FocusAssets.vue'

type TimerStatus = 'idle' | 'running' | 'paused'

// ─── Store ───
const store = usePomodoroStore()

const tasks = computed(() => store.tasks)
const projects = computed(() => store.projects)
const settings = computed(
  () =>
    store.settings ?? {
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      soundEnabled: true,
      notificationEnabled: true,
      autoStartBreak: false,
      autoStartWork: false
    }
)
const statistics = computed(
  () =>
    store.statistics ?? {
      today: { total: 0, work: 0, shortBreak: 0, longBreak: 0 },
      week: { total: 0, work: 0, shortBreak: 0, longBreak: 0 },
      month: { total: 0, work: 0, shortBreak: 0, longBreak: 0 }
    }
)
const todayRecords = computed(() => store.todayRecords)

// P1-1：详情抽屉状态
const taskDetailId = computed(() => store.taskDetailId)
function handleOpenTaskDetail(taskId: string): void {
  store.openTaskDetail(taskId)
}
function handleCloseTaskDetail(): void {
  store.closeTaskDetail()
}
const editingTaskId = ref<string | null>(null)
const selectedTaskForEdit = computed(
  () => tasks.value.find((task) => task.id === editingTaskId.value) ?? null
)

// ─── P1-2：多项目焦点 ───
const focusedProjectId = computed(() => store.focusedProjectId)

// 仅当有项目时才显示项目选择器
const showProjectSelector = computed(() => projects.value.length > 0)

// 计算属性：当前项目的有效时长（全局 + 项目覆盖）
const effective = computed(() => store.effectiveSettings(focusedProjectId.value))

// 过滤后的任务列表：显示当前焦点项目 + 无项目归属的任务；项目空时显示全部
const focusedTasks = computed(() => {
  if (!focusedProjectId.value) return tasks.value
  return tasks.value.filter((t) => t.projectId === focusedProjectId.value || !t.projectId)
})

// ─── 多项目 timer 状态机 ───
// 当前项目模式 / 计时显示 / 状态 / currentTaskId 都是「焦点项目 timer」的镜像
const showSettings = ref(false)
// 新建任务弹窗开关（true 时显示创建弹窗）
const creatingTask = ref(false)
const isFullscreen = ref(false)
const sidePanelTab = ref<'main' | 'stats'>('main')

// Tab 指示器位置：跟随当前 tab 滑动
const navIndicatorStyle = computed(() => ({
  transform: sidePanelTab.value === 'main' ? 'translateX(0)' : 'translateX(100%)'
}))

// 模式切换确认弹窗
const showModeConfirm = ref(false)
const pendingMode = ref<TimerMode | null>(null)

// IA v2 阶段A：计时器实例已下沉为 app 级单例（usePomodoroAppBridge），
// 视图只消费；数据加载 / 快捷键绑定 / tray 快照推送也随之上移
const timer = ensurePomodoroBridgeSync()

// 严格模式失败（离开窗口）提示——桥广播，视图负责 UI 呈现
const unsubStrictFail = subscribeStrictFail(() => {
  strictFailHint.value = true
  if (strictFailTimer) clearTimeout(strictFailTimer)
  strictFailTimer = setTimeout(() => {
    strictFailHint.value = false
  }, 4000)
})

// 同步焦点项目：watch store.focusedProjectId → 通知 timer 切换
watch(
  () => store.focusedProjectId,
  (id) => {
    if (id) timer.focus(id)
  }
)

// 所有 timer 状态都从 focusedTimer 派生，避免手抄引发不一致
const focusedTimerState = computed(() => timer.focusedTimer.value)
const currentMode = computed<TimerMode>(() => focusedTimerState.value?.mode ?? 'work')
const status = computed<TimerStatus>(() => focusedTimerState.value?.status ?? 'idle')
const isRunning = computed(() => status.value === 'running')
const isPaused = computed(() => status.value === 'paused')
const timeLeft = computed(() => focusedTimerState.value?.timeLeft ?? 0)
const currentTaskId = computed(() => focusedTimerState.value?.currentTaskId ?? null)

// ─── P0-2 / P1-4：计时风格与严格模式 ───
const isFlowtime = computed(() => (store.settings?.timerStyle ?? 'pomodoro') === 'flowtime')
const isStrict = computed(() => store.settings?.strictMode === true)
const strictBlurFails = computed(() => store.settings?.strictBlurFails !== false)
const flowtimeWork = computed(() => isFlowtime.value && currentMode.value === 'work')
const strictPauseBlocked = computed(
  () => isStrict.value && isRunning.value && currentMode.value === 'work'
)
const elapsed = computed(() => focusedTimerState.value?.elapsed ?? 0)
const strictFailHint = ref(false)
let strictFailTimer: ReturnType<typeof setTimeout> | null = null

// 后台运行项目（不含焦点项目）；mode 来自 timer 真实状态而非硬编码 'work'
const backgroundProjects = computed(() => {
  return timer
    .activeProjects()
    .filter((s) => s.projectId !== timer.focusedProjectId.value)
    .map((s) => {
      const project = projects.value.find((p) => p.id === s.projectId)
      return {
        projectId: s.projectId,
        name: project?.name ?? '项目',
        color: project?.color ?? '#888',
        mode: s.mode,
        timeLeft: s.timeLeft,
        timeLeftFormatted: formatSeconds(s.timeLeft)
      }
    })
})

function formatSeconds(s: number): string {
  const sec = Math.max(0, Math.round(s))
  const m = Math.floor(sec / 60)
  const r = sec % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

// ─── 计算属性 ───
const duration = computed(() => {
  if (flowtimeWork.value) return 0
  // P2-8：特殊休息显示实际选择的时长，而非配置的短休息时长
  if (isSpecialBreak.value) return focusedTimerState.value?.specialBreakTotalSec ?? 0
  if (currentMode.value === 'work') return effective.value.workDuration * 60
  if (currentMode.value === 'shortBreak') return effective.value.shortBreakDuration * 60
  return effective.value.longBreakDuration * 60
})

// 当前任务：从 store.tasks 里查 currentTaskId 拿到完整对象
const currentTask = computed(() => {
  const id = currentTaskId.value
  if (!id) return null
  return tasks.value.find((t) => t.id === id) ?? null
})

// 计时器模式的中文标签
const currentModeLabel = computed(() => {
  if (isSpecialBreak.value) return '特殊休息'
  if (currentMode.value === 'work') return '专注中'
  if (currentMode.value === 'shortBreak') return '短休息'
  return '长休息'
})

// 长休息刚结束，通过 composable 的 justFinishedLongBreak 标志判断
const showLongBreakResumeBanner = computed(() => {
  const t = focusedTimerState.value
  if (!t) return false
  return t.justFinishedLongBreak && t.status !== 'running'
})

// M13：是否存在任何后台活跃 timer
const hasAnyActiveBackground = computed(() => {
  return backgroundProjects.value.length > 0
})

function stopAllTimers(): void {
  timer?.stopAll?.()
}

async function switchToStats(): Promise<void> {
  sidePanelTab.value = 'stats'
  await store.loadStats('week')
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

// 同步全屏状态（用户可能通过 Esc 退出全屏）
function onFullscreenChange(): void {
  isFullscreen.value = !!document.fullscreenElement
  if (!document.fullscreenElement) breakFullscreenActive.value = false
}

// ─── P2-9：休息阶段自动全屏（强制休息的最后手段） ───
const breakFullscreenActive = ref(false)
watch(
  [isRunning, currentMode, () => settings.value.fullscreenBreak],
  () => {
    const want =
      settings.value.fullscreenBreak === true && isRunning.value && currentMode.value !== 'work'
    if (want && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      breakFullscreenActive.value = true
    } else if (!want && breakFullscreenActive.value && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      breakFullscreenActive.value = false
    }
  },
  { immediate: true }
)

// ─── P0-3：声景白噪音（WebAudio 合成，零资源依赖） ───
const soundscape = useSoundscapes()
const soundscapeOpen = ref(false)

// ─── P2-8：特殊休息 ───
const SPECIAL_BREAK_OPTIONS = [15, 30, 45, 60]
const specialBreakOpen = ref(false)
const isSpecialBreak = computed(() => focusedTimerState.value?.specialBreak === true)

function handleSpecialBreak(minutes: number): void {
  specialBreakOpen.value = false
  timer.startSpecialBreak(minutes)
}
const soundscapeVolume = computed(() =>
  Math.min(1, Math.max(0, settings.value.soundscapeVolume ?? 0.6))
)

function pickSoundscape(id: SoundscapeId): void {
  soundscape.start(id, soundscapeVolume.value)
  void store.saveSettings({ soundscape: id })
}

function onSoundscapeVolume(e: Event): void {
  const raw = Number((e.target as HTMLInputElement).value) / 100
  const v = Math.min(1, Math.max(0, raw))
  soundscape.setVolume(v)
  void store.saveSettings({ soundscapeVolume: v })
}

// P0-2：计时风格切换（番茄倒计时 / Flowtime 正计时）
function toggleTimerStyle(): void {
  const next = isFlowtime.value ? 'pomodoro' : 'flowtime'
  if (next === 'pomodoro' && flowtimeWork.value && (isRunning.value || isPaused.value)) {
    // 正计时切回倒计时：以设定时长重置当前 work
    timer.reset()
  }
  void store.saveSettings({ timerStyle: next })
}

function handleFinishFlowtime(): void {
  void timer.finishFlowtime()
}

// ─── P1-4：严格模式 · 离开窗口作废 ───
function onWindowBlur(): void {
  if (!isStrict.value || !strictBlurFails.value) return
  if (!isRunning.value || currentMode.value !== 'work') return
  timer.failStrict()
  void store.notifyIntegration('pause', '严格模式：检测到离开窗口，本番茄已作废')
}

// M5：切换迷你悬浮窗
async function toggleMiniWindow(): Promise<void> {
  try {
    await window.api.pomodoro.mini.toggle()
  } catch (err) {
    console.warn('[pomodoro] toggle mini failed:', err)
  }
}

// M7：专注模式
const focusModeEnabled = computed(() => store.focusMode)
async function toggleFocusMode(): Promise<void> {
  await store.setFocusMode(!store.focusMode)
}

function switchMode(mode: TimerMode): void {
  if (mode === currentMode.value) return
  if (strictPauseBlocked.value) return
  if (isRunning.value) {
    // 运行中切换需要确认
    pendingMode.value = mode
    showModeConfirm.value = true
    return
  }
  timer.setMode(mode)
}

function confirmModeSwitch(): void {
  if (pendingMode.value) {
    timer.setMode(pendingMode.value)
  }
  showModeConfirm.value = false
  pendingMode.value = null
}

function startTimer(): void {
  timer.start()
}

function pauseTimer(): void {
  timer.pause()
}

function openCreateDialog(): void {
  creatingTask.value = true
}

async function handleCreateTask(payload: {
  title: string
  description: string
  priority: number
  projectId: string | null
  estimateMs: number | null
  startAfter: boolean
}): Promise<void> {
  try {
    const task = await store.addTask(payload.title, {
      description: payload.description,
      priority: payload.priority,
      projectId: payload.projectId,
      estimateMs: payload.estimateMs
    })
    creatingTask.value = false
    if (task) {
      // 创建后自动设为当前任务
      timer.setCurrentTask(task.id)
      // 如果点击的是"创建并开始",则立即启动计时器
      if (payload.startAfter) {
        if (currentMode.value !== 'work') {
          timer.setMode('work')
        }
        timer.start()
      }
    }
  } catch (err) {
    console.error('[pomodoro] 创建任务失败:', err)
  }
}

function handleClearCurrentTask(): void {
  timer.setCurrentTask(null)
}

function handleSelectTask(taskId: string): void {
  // 切换当前任务（toggle：再点同一个则取消）
  const next = currentTaskId.value === taskId ? null : taskId
  timer.setCurrentTask(next)
}

function handleStartTask(taskId: string): void {
  // 一键开始：选中任务并立即启动计时器
  timer.setCurrentTask(taskId)
  // 若当前是休息模式，先切回 work
  if (currentMode.value !== 'work') {
    timer.setMode('work')
  }
  timer.start()
}

async function handleCompleteTask(taskId: string): Promise<void> {
  await store.completeTask(taskId)
  // P2-7：Todoist 集成任务完成后回写勾选
  void store.syncTaskCompleteToTodoist(taskId)
}

function handleEditTask(taskId: string): void {
  editingTaskId.value = taskId
}

async function handleDeleteTask(taskId: string): Promise<void> {
  // 如果删的是当前任务,先清空 timer 的 currentTask
  if (currentTaskId.value === taskId) {
    timer.setCurrentTask(null)
  }
  try {
    await store.deleteTask(taskId)
  } catch (err) {
    console.error('[pomodoro] 删除任务失败:', err)
  }
}

async function handleSaveTask(updates: Partial<(typeof store.tasks)[number]>): Promise<void> {
  if (!editingTaskId.value) return
  await store.updateTask(editingTaskId.value, updates)
  editingTaskId.value = null
}

async function handleCreateProject(payload: { name: string; color: string }): Promise<void> {
  const project = await store.addProject(payload.name, payload.color)
  if (editingTaskId.value) {
    await store.updateTask(editingTaskId.value, { projectId: project.id })
  }
}

async function handleSaveSettings(newSettings: Partial<typeof settings.value>): Promise<void> {
  await store.saveSettings(newSettings)
  // focusedTimerState 通过 effective 派生自动更新
}

onMounted(() => {
  // 数据加载 / 快捷键绑定 / tray 快照推送已上移 usePomodoroAppBridge（app 级单例）
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('blur', onWindowBlur)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('blur', onWindowBlur)
  soundscape.stop()
  unsubStrictFail()
})

// 点击空白关闭项目选择器（已移除 picker UI，保留空函数避免引用报错）
function onDocumentClick(_e: MouseEvent): void {
  // no-op
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true)
})
</script>

<style scoped>
/* ═══ ZenFocus · Stitch Design System ═══ */
.zf-root {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--pomo-bg-base);
  color: var(--pomo-text-strong);
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

/* ─── Ambient Background ─── */
.zf-bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
}

.zf-bg-blob--a {
  width: 640px;
  height: 640px;
  top: -200px;
  left: -120px;
  background: var(--pomo-work-soft);
}

.zf-bg-blob--b {
  width: 520px;
  height: 520px;
  bottom: -180px;
  right: -80px;
  background: var(--pomo-long-soft);
}

/* ─── Glass Header ─── */
.zf-header {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: var(--pomo-glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--pomo-glass-border);
}

.zf-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zf-brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pomo-work);
  box-shadow: 0 0 12px var(--pomo-work-glow);
}

.zf-brand-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--pomo-text-strong);
}

/* ─── Body Layout ─── */
.zf-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ─── Main Stage ─── */
.zf-main {
  position: relative;
  flex: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px 40px;
  min-width: 0;
  overflow-y: auto;
}

/* Project Row */
.zf-project-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.zf-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.zf-dot--sm {
  width: 6px;
  height: 6px;
}

.zf-bg-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.zf-bg-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--pomo-surface-container);
  border: 1px solid var(--pomo-outline-variant);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--pomo-text-soft);
}

.zf-stop-all {
  padding: 5px 12px;
  background: transparent;
  border: 1px solid var(--pomo-outline-variant);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--pomo-text-muted);
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s,
    background 0.2s;
}

.zf-stop-all:hover {
  color: var(--pomo-priority-high);
  border-color: var(--pomo-priority-high);
  background: rgba(255, 59, 48, 0.06);
}

/* Focus Card */
.zf-focus-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 560px;
  padding: 16px 22px;
  background: var(--pomo-glass-bg-elevated);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--pomo-glass-border-elevated);
  border-radius: 20px;
  box-shadow: var(--pomo-shadow-card);
  transition:
    box-shadow 0.3s,
    transform 0.3s;
}

.zf-focus-card:hover {
  box-shadow: var(--pomo-shadow-elevated);
  transform: translateY(-1px);
}

.zf-focus-card.is-empty {
  justify-content: center;
  background: var(--pomo-glass-bg);
}

.zf-focus-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--pomo-surface-container);
  border-radius: 999px;
  flex-shrink: 0;
}

.zf-focus-indicator.live {
  background: var(--pomo-work-soft);
}

.zf-blink-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pomo-work);
}

.zf-focus-indicator.live .zf-blink-dot {
  animation: zf-blink 1.4s infinite both;
}

.zf-focus-tag {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--pomo-text-muted);
}

.zf-focus-indicator.live .zf-focus-tag {
  color: var(--pomo-work);
}

.zf-focus-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--pomo-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zf-focus-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.zf-focus-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--pomo-text-muted);
  padding: 4px 0;
}

.zf-focus-empty i {
  font-size: 18px;
  color: var(--pomo-work);
}

/* Buttons */
.zf-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition:
    transform 0.15s,
    box-shadow 0.2s,
    opacity 0.15s,
    background 0.2s;
}

.zf-btn--filled {
  padding: 9px 20px;
  background: var(--pomo-work);
  color: var(--pomo-on-accent);
  border-radius: 999px;
  font-size: 13px;
  box-shadow: 0 4px 14px var(--pomo-work-glow);
}

.zf-btn--filled:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--pomo-work-glow);
  opacity: 0.92;
}

.zf-btn--filled:active {
  transform: translateY(0) scale(0.98);
}

.zf-btn--icon {
  width: 34px;
  height: 34px;
  padding: 0;
  justify-content: center;
  background: var(--pomo-surface-container);
  color: var(--pomo-text-muted);
  border-radius: 50%;
  font-size: 15px;
}

.zf-btn--icon:hover {
  background: var(--pomo-surface-variant);
  color: var(--pomo-text-strong);
}

/* Session Dots - removed */

/* Resume Banner */
.zf-resume-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  max-width: 480px;
  padding: 14px 20px;
  background: var(--pomo-glass-bg-elevated);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--pomo-outline-variant);
  border-radius: 16px;
  box-shadow: var(--pomo-shadow-card);
  animation: zf-fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.zf-resume-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zf-resume-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.zf-resume-text strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--pomo-text-strong);
}

.zf-resume-text span {
  font-size: 12px;
  color: var(--pomo-text-muted);
}

/* Toolbar */
.zf-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--pomo-glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--pomo-glass-border);
  border-radius: 999px;
  box-shadow: var(--pomo-shadow-card);
}

.zf-tool-btn {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  font-size: 17px;
  color: var(--pomo-text-muted);
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
}

.zf-tool-btn:hover {
  background: var(--pomo-surface-container);
  color: var(--pomo-text-strong);
  transform: translateY(-1px);
}

.zf-tool-btn.active {
  background: var(--pomo-work-soft);
  color: var(--pomo-work);
}

.zf-tool-divider {
  width: 1px;
  height: 20px;
  background: var(--pomo-outline-variant);
  margin: 0 6px;
}

.zf-tool-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--pomo-text-muted);
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}

/* ─── Sidebar ─── */
.zf-sidebar {
  flex: 4;
  min-width: 360px;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px;
  background: var(--pomo-glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-left: 1px solid var(--pomo-glass-border);
  box-shadow: var(--pomo-shadow-sidebar);
  overflow: hidden;
}

.zf-sidebar-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zf-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--pomo-work-soft), var(--pomo-long-soft));
  border: 2px solid var(--pomo-glass-border-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--pomo-work);
  flex-shrink: 0;
}

.zf-greeting {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.zf-greeting-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--pomo-text-strong);
}

.zf-greeting-sub {
  font-size: 12px;
  color: var(--pomo-text-muted);
}

/* 新建任务紧凑按钮（header 右侧） */
.zf-new-task-compact {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  background: var(--pomo-work);
  color: var(--pomo-on-accent);
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 3px 10px var(--pomo-work-glow);
  transition:
    transform 0.15s,
    box-shadow 0.2s,
    opacity 0.15s;
  flex-shrink: 0;
  white-space: nowrap;
}

.zf-new-task-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px var(--pomo-work-glow);
  opacity: 0.92;
}

.zf-new-task-compact:active {
  transform: translateY(0) scale(0.97);
}

/* Nav — 滑动指示器设计 */
.zf-nav {
  position: relative;
  display: flex;
  border-bottom: 1.5px solid var(--pomo-outline-variant);
}

/* 滑动背景块 */
.zf-nav-indicator {
  position: absolute;
  bottom: -1.5px;
  left: 0;
  width: 50%;
  height: 2.5px;
  background: var(--pomo-work);
  border-radius: 2px 2px 0 0;
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.zf-nav-item {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px 9px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--pomo-text-muted);
  transition: color 0.2s;
  position: relative;
}

.zf-nav-item:hover:not(.active) {
  color: var(--pomo-text-soft);
}

.zf-nav-item.active {
  color: var(--pomo-work);
  font-weight: 600;
}

/* Panel Scroll */
.zf-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.zf-panel-scroll::-webkit-scrollbar {
  width: 5px;
}

.zf-panel-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.zf-panel-scroll::-webkit-scrollbar-thumb {
  background: var(--pomo-outline-variant);
  border-radius: 3px;
}

.zf-panel-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--pomo-outline);
}

.zf-streak {
  margin-bottom: -4px;
}

/* Progress */
.zf-progress {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--pomo-glass-border);
}

.zf-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 500;
  color: var(--pomo-text-muted);
}

.zf-progress-num {
  font-variant-numeric: tabular-nums;
  color: var(--pomo-work);
  font-weight: 600;
}

.zf-progress-track {
  height: 6px;
  border-radius: 3px;
  background: var(--pomo-surface-container);
  overflow: hidden;
}

.zf-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--pomo-work), var(--pomo-long));
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ─── Keyframes ─── */
@keyframes zf-blink {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

@keyframes zf-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ═══ P0-3 · 声景选择浮层 ═══ */
.zf-sound-pop {
  position: absolute;
  bottom: 84px;
  left: 50%;
  z-index: 30;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: var(--pomo-glass-bg-elevated);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--pomo-glass-border-elevated);
  border-radius: var(--radius-lg, 14px);
  box-shadow: var(--pomo-shadow-elevated);
}

.zf-sound-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.zf-sound-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--pomo-outline-variant);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--pomo-text-soft);
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.zf-sound-chip:hover {
  background: var(--pomo-surface-container-low);
  color: var(--pomo-text-strong);
}

.zf-sound-chip.active {
  background: var(--pomo-work-soft);
  border-color: var(--pomo-work);
  color: var(--pomo-work);
}

.zf-sound-volume {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  color: var(--pomo-text-muted);
}

.zf-sound-volume input[type='range'] {
  flex: 1;
  accent-color: var(--pomo-work);
}
</style>
