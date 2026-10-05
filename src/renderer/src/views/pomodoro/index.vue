<template>
  <div class="zf-root" :data-mode="currentMode">
    <div class="zf-bg-blob zf-bg-blob--a" aria-hidden="true" />
    <div class="zf-bg-blob zf-bg-blob--b" aria-hidden="true" />

    <!-- ═══ 顶栏：（空侧 · 模式页签 · 后台项目+工具图标排） ═══ -->
    <header class="zf-topbar">
      <div class="zf-topbar-side" />

      <!-- 模式页签（顶栏中段，用户指定） -->
      <ModeSelector
        :current-mode="currentMode"
        :switch-locked="strictPauseBlocked"
        settings-title="番茄钟设置"
        @switch="switchMode"
        @open-settings="showSettings = true"
      />

      <div class="zf-topbar-side zf-topbar-side--right">
        <div v-if="backgroundProjects.length" class="zf-bg-chips">
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

        <div class="zf-toolrow">
          <button
            ref="specialBreakToggleRef"
            type="button"
            class="zf-tool-ic"
            :class="{ active: isSpecialBreak }"
            title="特殊休息（午休 / 晚饭，不占番茄循环）"
            @click="toggleSpecialBreakPop"
          >
            <AppIcon icon="ri-restaurant-line" />
          </button>
          <button
            ref="soundscapeToggleRef"
            type="button"
            class="zf-tool-ic"
            :class="{ active: soundscape.current.value !== 'none' }"
            title="声景白噪音"
            @click="toggleSoundscapePop"
          >
            <AppIcon
              :icon="soundscape.current.value !== 'none' ? 'ri-music-2-fill' : 'ri-music-line'"
            />
          </button>
          <button
            type="button"
            class="zf-tool-ic"
            :class="{ active: isFlowtime }"
            :title="isFlowtime ? '切换为倒计时番茄' : '切换为正计时（Flowtime）'"
            @click="toggleTimerStyle"
          >
            <AppIcon :icon="isFlowtime ? 'ri-timer-flash-line' : 'ri-timer-line'" />
          </button>
          <button type="button" class="zf-tool-ic" title="迷你窗口" @click="toggleMiniWindow">
            <AppIcon icon="ri-picture-in-picture-line" />
          </button>
          <button
            type="button"
            class="zf-tool-ic"
            :class="{ active: focusModeEnabled }"
            :title="focusModeEnabled ? '退出专注模式' : '专注模式'"
            @click="toggleFocusMode"
          >
            <AppIcon :icon="focusModeEnabled ? 'ri-moon-fill' : 'ri-moon-line'" />
          </button>
          <button type="button" class="zf-tool-ic" title="全屏" @click="toggleFullscreen">
            <AppIcon icon="ri-fullscreen-line" />
          </button>
          <span class="zf-toolrow-divider" />
          <button type="button" class="zf-tool-ic" title="专注统计" @click="openStats">
            <AppIcon icon="ri-bar-chart-box-line" />
          </button>
        </div>
      </div>
    </header>

    <!-- ═══ 单列主内容（Pomofocus 范式：页签→计时器→主按钮→任务） ═══ -->
    <main class="zf-stage">
      <div class="zf-column">
      <!-- 2. 会话进度：🍅 + 圆点（本组第 N 个番茄，每 M 个进长休；纯信息非控件） -->
      <div
        class="zf-session"
        :title="`本组循环 ${sessionDots.completed}/${sessionDots.total}——每 ${sessionDots.total} 个番茄进入一次长休息`"
      >
        <span class="zf-session-ico" aria-hidden="true">🍅</span>
        <span class="zf-session-dots">
          <span
            v-for="i in sessionDots.total"
            :key="i"
            class="zf-session-dot"
            :class="{ done: i <= sessionDots.completed, next: i === sessionDots.completed + 1 }"
          />
        </span>
      </div>

      <!-- 浮动提示堆栈（恢复 / 切模式确认 / 严格作废） -->
      <transition name="zf-pop">
        <div v-if="showLongBreakResumeBanner" class="zf-banner">
          <div class="zf-banner-text">
            <strong>长休息结束</strong>
            <span>准备好下一轮专注吗？</span>
          </div>
          <button class="zf-btn zf-btn--filled" type="button" @click="startTimer">
            开始下一轮
          </button>
        </div>
      </transition>
      <transition name="zf-pop">
        <div v-if="showModeConfirm" class="zf-banner">
          <div class="zf-banner-text">
            <strong>切换模式</strong>
            <span>计时器正在运行，切换将重置当前计时，确定吗？</span>
          </div>
          <div class="zf-banner-actions">
            <button class="zf-btn zf-btn--icon" type="button" @click="showModeConfirm = false">
              <AppIcon icon="ri-close-line" />
            </button>
            <button class="zf-btn zf-btn--filled" type="button" @click="confirmModeSwitch">
              确定切换
            </button>
          </div>
        </div>
      </transition>
      <transition name="zf-pop">
        <div v-if="strictFailHint" class="zf-banner zf-banner--warn">
          <div class="zf-banner-text">
            <strong>严格模式</strong>
            <span>检测到离开窗口，本番茄已作废</span>
          </div>
        </div>
      </transition>

      <!-- 3. 计时器 -->
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

      <!-- 4. 大号主按钮（页面的唯一主动作） -->
      <div class="zf-cta-row">
        <button
          v-if="!isRunning"
          type="button"
          class="zf-cta"
          @click="startTimer"
        >
          <AppIcon icon="ri-play-fill" />开始专注
        </button>
        <button
          v-else
          type="button"
          class="zf-cta zf-cta--pause"
          :disabled="strictPauseBlocked"
          :title="strictPauseBlocked ? '严格模式：不允许暂停' : ''"
          @click="pauseTimer"
        >
          <AppIcon :icon="strictPauseBlocked ? 'ri-lock-line' : 'ri-pause-fill'" />{{
            strictPauseBlocked ? '严格模式中' : '暂停'
          }}
        </button>
        <button
          v-if="flowtimeWork && (isRunning || isPaused) && elapsed >= 10"
          type="button"
          class="zf-cta zf-cta--ghost"
          title="结束并记录本次正计时"
          @click="handleFinishFlowtime"
        >
          <AppIcon icon="ri-stop-circle-line" />完成
        </button>
      </div>

      <!-- 5. 当前任务卡 -->
      <section v-if="currentTask" class="zf-current">
        <span class="zf-current-tag" :class="{ live: isRunning }">
          <span class="zf-blink-dot" />
          {{ isRunning ? '正在专注' : isPaused ? '已暂停' : '待开始' }}
        </span>
        <span class="zf-current-title" :title="currentTask.title">{{ currentTask.title }}</span>
        <span class="zf-current-pomos" title="今日已完成 / 预估番茄">
          🍅 {{ currentTaskEstimate > 0 ? `${currentTaskPomos}/${currentTaskEstimate}` : currentTaskPomos }}
        </span>
        <button
          type="button"
          class="zf-btn zf-btn--icon"
          title="清除当前任务"
          @click="handleClearCurrentTask"
        >
          <AppIcon icon="ri-close-line" />
        </button>
      </section>
      <div v-else class="zf-current zf-current--empty">
        <span v-if="showProjectSelector">在下方任务清单点选一个任务开始</span>
        <span v-else>创建项目并添加任务，即可开始专注</span>
      </div>

      <!-- 6. 任务清单（同列下方，Pomofocus 式） -->
      <section class="zf-tasks">
        <header class="zf-tasks-head">
          <h4 class="zf-tasks-title">任务清单</h4>
          <span class="zf-tasks-meta">{{ focusedTasks.length }} 个</span>
          <button
            type="button"
            class="zf-new-task-compact"
            title="新建任务"
            @click="openCreateDialog"
          >
            <AppIcon icon="ri-add-line" />
            <span>新建任务</span>
          </button>
        </header>
        <TaskListPanel
          :tasks="focusedTasks"
          :projects="projects"
          :current-task-id="currentTaskId"
          :work-duration="effective.workDuration"
          @select="handleSelectTask"
          @start="handleStartTask"
          @complete="handleCompleteTask"
          @edit="handleEditTask"
          @open-detail="handleOpenTaskDetail"
          @delete="handleDeleteTask"
        />
      </section>
      </div>
    </main>

    <!-- Dock 弹层改挂顶栏工具（特殊休息 / 声景） -->
    <transition name="zf-pop">
      <div
        v-if="specialBreakOpen"
        ref="specialBreakPopRef"
        role="menu"
        aria-label="特殊休息时长"
        class="zf-tool-pop"
      >
        <div class="zf-sound-grid">
          <button
            v-for="m in SPECIAL_BREAK_OPTIONS"
            :key="m"
            type="button"
            class="zf-sound-chip"
            role="menuitem"
            @click="handleSpecialBreak(m)"
          >
            <AppIcon icon="ri-time-line" />
            <span>{{ m }} 分钟</span>
          </button>
        </div>
      </div>
    </transition>
    <transition name="zf-pop">
      <div
        v-if="soundscapeOpen"
        ref="soundscapePopRef"
        role="menu"
        aria-label="声景白噪音"
        class="zf-tool-pop"
      >
        <div class="zf-sound-grid">
          <button
            v-for="sc in SOUNDSCAPES"
            :key="sc.id"
            type="button"
            class="zf-sound-chip"
            :class="{ active: soundscape.current.value === sc.id }"
            role="menuitem"
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
    </transition>

    <!-- ═══ 统计全屏报告层（今日速览 + 图表 + 记录） ═══ -->
    <transition name="zf-fade">
      <div v-if="statsOverlay" class="zf-stats-overlay">
        <header class="zf-stats-head">
          <h3 class="zf-stats-title">专注统计</h3>
          <button type="button" class="zf-btn zf-btn--icon" title="关闭" @click="statsOverlay = false">
            <AppIcon icon="ri-close-line" />
          </button>
        </header>
        <div class="zf-stats-body">
          <TodayStatsBar
            :work-count="statistics.today.work"
            :work-duration="effective.workDuration"
            :streak="store.streak"
          />
          <FocusAssets class="zf-streak" />
          <StatisticsPanel />
          <FocusRecordPanel :records="todayRecords" />
        </div>
      </div>
    </transition>

    <!-- ═══ Dialogs & Drawers ═══ -->
    <TaskEditDialog
      v-if="selectedTaskForEdit"
      :task="selectedTaskForEdit"
      :projects="projects"
      :work-duration="effective.workDuration"
      @close="editingTaskId = null"
      @save="handleSaveTask"
      @create-project="handleCreateProject"
    />

    <TaskEditDialog
      v-if="creatingTask"
      mode="create"
      :task="null"
      :projects="projects"
      :work-duration="effective.workDuration"
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
import { useDismissablePopup } from '@composables/useDismissablePopup'
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
  void store.openTaskDetail(taskId)
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
// B61v3：单列布局——任务清单内联主列，统计全屏报告层
const statsOverlay = ref(false)

// 番茄循环进度：本组已完成 N / 每 interval 个进长休息
const sessionDots = computed(() => {
  const interval = Math.max(2, effective.value.longBreakInterval)
  const completed = focusedTimerState.value?.consecutiveCount ?? 0
  return { total: interval, completed: completed % interval }
})

// 当前任务今日完成的番茄数（当前任务卡的 🍅 N/M）
const currentTaskPomos = computed(() => {
  if (!currentTaskId.value) return 0
  return todayRecords.value.filter((r) => r.type === 'work' && r.taskId === currentTaskId.value)
    .length
})

// 预估番茄数（Pomofocus 口径：🍅 已完成/预估）——estimateMs 按建任务时的
// 全局时长折算，用有效时长还原个数
const currentTaskEstimate = computed(() => {
  const est = currentTask.value?.estimateMs ?? 0
  const unit = Math.max(1, effective.value.workDuration) * 60_000
  return est > 0 ? Math.max(1, Math.round(est / unit)) : 0
})

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
// 无焦点项目（一个项目都没建）时兜底显示专注时长，避免新装用户看到 00:00
const timeLeft = computed(
  () => focusedTimerState.value?.timeLeft ?? effective.value.workDuration * 60
)
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
        color: project?.color ?? 'var(--palette-project-6)',
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

// B61：统计全屏层——进入时预载周数据
async function openStats(): Promise<void> {
  statsOverlay.value = true
  await store.loadStats('week')
}

// Esc：关闭统计层
function onGlobalKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (statsOverlay.value) statsOverlay.value = false
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen()
  } else {
    void document.exitFullscreen()
  }
}

// 同步全屏状态（用户可能通过 Esc 退出全屏）。B60-25：isFullscreen 死变量删除
function onFullscreenChange(): void {
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

// B54：两个浮层接 Esc + 外点关闭；ignore 各自的开关按钮——否则「外点关掉 →
// 按钮的 click 又把浮层打开」永远关不上（pointerdown 捕获先于 click 触发）
const specialBreakPopRef = ref<HTMLElement | null>(null)
const specialBreakToggleRef = ref<HTMLElement | null>(null)
const soundscapePopRef = ref<HTMLElement | null>(null)
const soundscapeToggleRef = ref<HTMLElement | null>(null)
useDismissablePopup(specialBreakPopRef, specialBreakOpen, () => (specialBreakOpen.value = false), {
  ignore: [specialBreakToggleRef]
})
useDismissablePopup(soundscapePopRef, soundscapeOpen, () => (soundscapeOpen.value = false), {
  ignore: [soundscapeToggleRef]
})
const isSpecialBreak = computed(() => focusedTimerState.value?.specialBreak === true)

// B60-14：两个浮层互斥——此前可同时打开，绝对定位下同坐标叠置
function toggleSpecialBreakPop(): void {
  specialBreakOpen.value = !specialBreakOpen.value
  if (specialBreakOpen.value) soundscapeOpen.value = false
}
function toggleSoundscapePop(): void {
  soundscapeOpen.value = !soundscapeOpen.value
  if (soundscapeOpen.value) specialBreakOpen.value = false
}

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
async function onWindowBlur(): Promise<void> {
  if (!isStrict.value || !strictBlurFails.value) return
  if (!isRunning.value || currentMode.value !== 'work') return
  // B60-22：焦点可能只是去了自家迷你悬浮窗/托盘/通知中心——等焦点落定后
  // 查前台是否 Frond 窗口，是则不算离开（此前点自家窗也会作废本番茄）
  await new Promise((resolve) => setTimeout(resolve, 120))
  try {
    if (await window.api.pomodoro.isFrondFrontmost()) return
  } catch {
    /* IPC 失败按原语义作废（宁可误杀不放过摸鱼） */
  }
  // await 窗口内状态可能已变（用户暂停/切模式）
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
  // B60-15：只负责建项目——挂到任务是弹窗内 pendingProjectName 回填 + 保存时
  // 提交的事。此前这里直写 updateTask(projectId)，弹窗点「取消」也无法回滚
  await store.addProject(payload.name, payload.color)
}

async function handleSaveSettings(newSettings: Partial<typeof settings.value>): Promise<void> {
  await store.saveSettings(newSettings)
  // focusedTimerState 通过 effective 派生自动更新
}

// B60-22：handler 是 async（blur 后要异步查前台窗口），包一层 void 满足
// no-misused-promises；具名引用保证 add/remove 配对
const onWindowBlurVoid = (): void => void onWindowBlur()

onMounted(() => {
  // 数据加载 / 快捷键绑定 / tray 快照推送已上移 usePomodoroAppBridge（app 级单例）
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('blur', onWindowBlurVoid)
  window.addEventListener('keydown', onGlobalKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('blur', onWindowBlurVoid)
  window.removeEventListener('keydown', onGlobalKey)
  soundscape.stop()
  unsubStrictFail()
})

</script>

<style scoped>
/* ═══ B61v3 · 单列范式（Pomofocus 验证过的布局语言）═══
   模式页签 → 会话进度 → 巨环 → 大号主按钮 → 当前任务卡 → 任务清单，
   全部在一条 max-width 560 的居中列里。工具收顶栏，统计全屏。 */
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
  --pomo-mode: var(--pomo-work);
  --pomo-mode-soft: var(--pomo-work-soft);
  --pomo-mode-glow: var(--pomo-work-glow);
  transition: background 0.8s ease;
}

.zf-root[data-mode='shortBreak'] {
  --pomo-mode: var(--pomo-short);
  --pomo-mode-soft: var(--pomo-short-soft);
  --pomo-mode-glow: var(--pomo-short-glow);
}

.zf-root[data-mode='longBreak'] {
  --pomo-mode: var(--pomo-long);
  --pomo-mode-soft: var(--pomo-long-soft);
  --pomo-mode-glow: var(--pomo-long-glow);
}

/* ─── 氛围光斑 ─── */
.zf-bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.5;
  transition: background 0.8s ease;
}

.zf-bg-blob--a {
  width: 440px;
  height: 440px;
  top: -6%;
  left: -4%;
  background: var(--pomo-mode-soft);
}

.zf-bg-blob--b {
  width: 360px;
  height: 360px;
  bottom: -5%;
  right: -3%;
  background: var(--pomo-mode-soft);
  opacity: 0.32;
}

/* ─── 顶栏 ─── */
.zf-topbar {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--pomo-surface-border);
}

.zf-topbar-side {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.zf-topbar-side--right {
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* 后台项目 chips */
.zf-bg-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.zf-bg-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  background: var(--pomo-surface);
  border: 1px solid var(--pomo-surface-border);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--pomo-text-soft);
  box-shadow: var(--pomo-shadow-card);
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

.zf-stop-all {
  padding: 4px 11px;
  background: transparent;
  border: 1px solid var(--pomo-outline-variant);
  border-radius: 999px;
  font-size: 11.5px;
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

/* 顶栏工具图标排 */
.zf-toolrow {
  display: flex;
  align-items: center;
  gap: 2px;
}

.zf-tool-ic {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  color: var(--pomo-text-muted);
  transition:
    background 0.2s,
    color 0.2s;
}

.zf-tool-ic:hover {
  background: var(--pomo-surface-container);
  color: var(--pomo-text-strong);
}

.zf-tool-ic.active {
  background: var(--pomo-mode-soft);
  color: var(--pomo-mode);
}

.zf-toolrow-divider {
  width: 1px;
  height: 18px;
  background: var(--pomo-outline-variant);
  margin: 0 6px;
}

/* 顶栏弹层（特殊休息 / 声景）：挂顶栏右缘下方 */
.zf-tool-pop {
  position: fixed;
  top: 52px;
  right: 20px;
  z-index: 45;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--pomo-glass-bg-elevated);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--pomo-glass-border-elevated);
  border-radius: 14px;
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

/* ─── 单列主内容 ─── */
/* B61v3：滚动容器 = 全宽 stage（滚动条贴窗右缘），column 只负责居中 */
.zf-stage {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.zf-stage::-webkit-scrollbar {
  width: 5px;
}

.zf-stage::-webkit-scrollbar-track {
  background: transparent;
}

.zf-stage::-webkit-scrollbar-thumb {
  background: var(--pomo-outline-variant);
  border-radius: 3px;
}

.zf-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}

/* 会话进度：第 N 个 · 圆点 · 共 M 个 */
.zf-session {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zf-session-ico {
  font-size: 13px;
  line-height: 1;
}

.zf-session-dots {
  display: flex;
  align-items: center;
  gap: 7px;
}

.zf-session-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pomo-outline-variant);
  transition: background 0.4s, box-shadow 0.4s, transform 0.4s;
}

.zf-session-dot.done {
  background: var(--pomo-mode);
}

.zf-session-dot.next {
  background: var(--pomo-mode-soft);
  box-shadow: inset 0 0 0 1.5px var(--pomo-mode);
  transform: scale(1.15);
}

/* ─── 浮动提示横幅 ─── */
.zf-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 12px 18px;
  background: var(--pomo-surface);
  border: 1px solid var(--pomo-surface-border);
  border-radius: 14px;
  box-shadow: var(--pomo-shadow-elevated);
}

.zf-banner--warn {
  border-color: rgba(255, 159, 10, 0.35);
  background: rgba(255, 159, 10, 0.07);
}

.zf-banner-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zf-banner-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.zf-banner-text strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--pomo-text-strong);
}

.zf-banner-text span {
  font-size: 12px;
  color: var(--pomo-text-muted);
}

/* ─── 大号主按钮：页面的唯一主动作 ─── */
.zf-cta-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zf-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 200px;
  padding: 13px 34px;
  border: none;
  border-radius: 999px;
  background: var(--pomo-mode);
  color: var(--pomo-on-accent);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 6px 22px var(--pomo-mode-glow);
  transition:
    transform 0.15s,
    box-shadow 0.2s,
    opacity 0.15s,
    background 0.3s;
}

.zf-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px var(--pomo-mode-glow);
  opacity: 0.96;
}

.zf-cta:active {
  transform: translateY(0) scale(0.98);
}

/* 暂停态：中性灰——与运行态的模式色形成状态对比 */
.zf-cta--pause {
  background: var(--pomo-paused);
  box-shadow: none;
}

.zf-cta--pause:hover {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

.zf-cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.zf-cta--ghost {
  min-width: 0;
  background: transparent;
  color: var(--pomo-text-soft);
  border: 1px solid var(--pomo-outline-variant);
  box-shadow: none;
  font-size: 13px;
  font-weight: 600;
  padding: 12px 22px;
}

.zf-cta--ghost:hover {
  background: var(--pomo-surface-container);
  color: var(--pomo-text-strong);
  box-shadow: none;
}

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
    background 0.3s;
}

.zf-btn--filled {
  padding: 8px 18px;
  background: var(--pomo-mode);
  color: var(--pomo-on-accent);
  border-radius: 999px;
  font-size: 13px;
  box-shadow: 0 4px 14px var(--pomo-mode-glow);
}

.zf-btn--filled:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--pomo-mode-glow);
  opacity: 0.94;
}

.zf-btn--filled:active {
  transform: translateY(0) scale(0.98);
}

.zf-btn--icon {
  width: 32px;
  height: 32px;
  padding: 0;
  justify-content: center;
  background: transparent;
  color: var(--pomo-text-muted);
  border-radius: 50%;
  font-size: 15px;
}

.zf-btn--icon:hover {
  background: var(--pomo-surface-container);
  color: var(--pomo-text-strong);
}

/* ─── 当前任务卡 ─── */
.zf-current {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: var(--pomo-surface);
  border: 1px solid var(--pomo-surface-border);
  border-left: 3px solid var(--pomo-mode);
  border-radius: 12px;
  box-shadow: var(--pomo-shadow-card);
  transition: border-color 0.8s ease;
}

.zf-current--empty {
  justify-content: center;
  border-left: 1px solid var(--pomo-surface-border);
  border-style: dashed;
  box-shadow: none;
  font-size: 13px;
  color: var(--pomo-text-muted);
}

.zf-current-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: var(--pomo-surface-container);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--pomo-text-muted);
  flex-shrink: 0;
  transition: background 0.8s ease, color 0.8s ease;
}

.zf-current-tag.live {
  background: var(--pomo-mode-soft);
  color: var(--pomo-mode);
}

.zf-blink-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--pomo-text-muted);
}

.zf-current-tag.live .zf-blink-dot {
  background: var(--pomo-mode);
  animation: zf-blink 1.6s infinite both;
}

.zf-current-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 550;
  color: var(--pomo-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zf-current-pomos {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--pomo-text-muted);
  flex-shrink: 0;
}

/* ─── 任务清单（同列下方） ─── */
.zf-tasks {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.zf-tasks-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zf-tasks-title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: var(--pomo-text-strong);
}

.zf-tasks-meta {
  font-size: 12px;
  color: var(--pomo-text-faint);
}

.zf-new-task-compact {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 13px;
  background: var(--pomo-mode);
  color: var(--pomo-on-accent);
  border: none;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 3px 10px var(--pomo-mode-glow);
  transition:
    transform 0.15s,
    box-shadow 0.2s,
    opacity 0.15s,
    background 0.3s;
  flex-shrink: 0;
  white-space: nowrap;
}

.zf-new-task-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px var(--pomo-mode-glow);
  opacity: 0.94;
}

.zf-new-task-compact:active {
  transform: translateY(0) scale(0.97);
}

/* ─── 统计全屏报告层 ─── */
.zf-stats-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 20px 28px 24px;
  background: var(--pomo-bg-base);
  overflow: hidden;
}

.zf-stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--pomo-surface-border);
}

.zf-stats-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--pomo-text-strong);
}

.zf-stats-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 16px;
}

.zf-stats-body::-webkit-scrollbar {
  width: 5px;
}

.zf-stats-body::-webkit-scrollbar-thumb {
  background: var(--pomo-outline-variant);
  border-radius: 3px;
}

.zf-streak {
  margin-bottom: -4px;
}

/* ─── Keyframes & Transitions ─── */
@keyframes zf-blink {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

.zf-pop-enter-active,
.zf-pop-leave-active {
  transition:
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.zf-pop-enter-from,
.zf-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.zf-fade-enter-active,
.zf-fade-leave-active {
  transition: opacity 0.24s ease;
}

.zf-fade-enter-from,
.zf-fade-leave-to {
  opacity: 0;
}
</style>
