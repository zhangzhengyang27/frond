<template>
  <div class="zf-root" :data-mode="currentMode">
    <!-- 氛围光斑（模式驱动，随 data-mode 缓变） -->
    <div class="zf-bg-blob zf-bg-blob--a" aria-hidden="true" />
    <div class="zf-bg-blob zf-bg-blob--b" aria-hidden="true" />

    <!-- ═══ 顶栏：brand · 番茄循环 · 后台项目（一条发丝线） ═══ -->
    <header class="zf-topbar">
      <div class="zf-topbar-side">
        <span class="zf-brand-dot" aria-hidden="true" />
        <span class="zf-brand-name">ZenFocus</span>
      </div>

      <!-- 模式切换（顶栏中央：唯一的状态控制） -->
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
      </div>
    </header>

    <!-- ═══ 舞台：巨环即页面 ═══ -->
    <main class="zf-stage">
      <!-- 浮动提示堆栈 -->
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

      <!-- 会话语境：循环圆点贴着环（本组第 N 个 / 每 N 个进长休息） -->
      <div
        class="zf-session"
        :title="`本组循环 ${sessionDots.completed}/${sessionDots.total}（每 ${sessionDots.total} 个番茄进入长休息）`"
      >
        <span
          v-for="i in sessionDots.total"
          :key="i"
          class="zf-session-dot"
          :class="{ done: i <= sessionDots.completed, next: i === sessionDots.completed + 1 }"
        />
      </div>

      <!-- 巨环 -->
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

      <!-- 当下一行：状态 · 任务 · 主控（舞台上的唯一操作行） -->
      <div v-if="currentTask" class="zf-nowline">
        <span class="zf-nowline-status" :class="{ live: isRunning }">
          <span class="zf-blink-dot" />
          {{ isRunning ? '专注中' : isPaused ? '已暂停' : '待开始' }}
        </span>
        <h2 class="zf-nowline-title" :title="currentTask.title">{{ currentTask.title }}</h2>
        <div class="zf-nowline-actions">
          <button
            v-if="!isRunning"
            type="button"
            class="zf-btn zf-btn--filled zf-btn--hero"
            @click="startTimer"
          >
            <AppIcon icon="ri-play-fill" />开始专注
          </button>
          <button
            v-else
            type="button"
            class="zf-btn zf-btn--filled zf-btn--hero"
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
            class="zf-btn zf-btn--ghost"
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
      </div>
      <div v-else class="zf-nowline zf-nowline--empty">
        <AppIcon icon="ri-lightbulb-flash-line" />
        <span v-if="showProjectSelector">从右侧任务列表选一个开始专注</span>
        <span v-else>创建项目并添加任务，即可开始专注</span>
        <button v-if="showProjectSelector" type="button" class="zf-btn zf-btn--filled" @click="panelOpen = true">
          选择任务
        </button>
      </div>
    </main>

    <!-- ═══ Dock：底部悬浮工具排 ═══ -->
    <div class="zf-dock-wrap">
      <!-- 特殊休息时长浮层 -->
      <transition name="zf-pop">
        <div
          v-if="specialBreakOpen"
          ref="specialBreakPopRef"
          role="menu"
          aria-label="特殊休息时长"
          class="zf-dock-pop"
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

      <!-- 声景选择浮层 -->
      <transition name="zf-pop">
        <div
          v-if="soundscapeOpen"
          ref="soundscapePopRef"
          role="menu"
          aria-label="声景白噪音"
          class="zf-dock-pop"
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

      <nav class="zf-dock">
        <button
          type="button"
          class="zf-dock-btn"
          :class="{ active: panelOpen }"
          title="任务面板"
          @click="panelOpen = !panelOpen"
        >
          <AppIcon icon="ri-layout-right-2-line" />
        </button>
        <button type="button" class="zf-dock-btn" title="专注统计" @click="openStats">
          <AppIcon icon="ri-bar-chart-box-line" />
        </button>
        <span class="zf-dock-divider" />
        <button type="button" class="zf-dock-btn" title="全屏" @click="toggleFullscreen">
          <AppIcon icon="ri-fullscreen-line" />
        </button>
        <button
          ref="specialBreakToggleRef"
          type="button"
          class="zf-dock-btn"
          :class="{ active: isSpecialBreak }"
          title="特殊休息（午休 / 晚饭，不占番茄循环）"
          @click="toggleSpecialBreakPop"
        >
          <AppIcon icon="ri-restaurant-line" />
        </button>
        <button
          ref="soundscapeToggleRef"
          type="button"
          class="zf-dock-btn"
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
          class="zf-dock-btn"
          :class="{ active: isFlowtime }"
          :title="isFlowtime ? '切换为倒计时番茄' : '切换为正计时（Flowtime）'"
          @click="toggleTimerStyle"
        >
          <AppIcon :icon="isFlowtime ? 'ri-timer-flash-line' : 'ri-timer-line'" />
        </button>
        <button type="button" class="zf-dock-btn" title="迷你窗口" @click="toggleMiniWindow">
          <AppIcon icon="ri-picture-in-picture-line" />
        </button>
        <button
          type="button"
          class="zf-dock-btn"
          :class="{ active: focusModeEnabled }"
          :title="focusModeEnabled ? '退出专注模式' : '专注模式'"
          @click="toggleFocusMode"
        >
          <AppIcon :icon="focusModeEnabled ? 'ri-moon-fill' : 'ri-moon-line'" />
        </button>
      </nav>
    </div>

    <!-- ═══ 任务面板：右侧滑出（按需） ═══ -->
    <transition name="zf-flyout">
      <aside v-if="panelOpen" class="zf-flyout">
        <div class="zf-flyout-head">
          <div class="zf-avatar">
            <AppIcon icon="ri-user-smile-line" />
          </div>
          <div class="zf-greeting">
            <span class="zf-greeting-title">今天也要加油</span>
            <span class="zf-greeting-sub">已完成 {{ statistics.today.work }} 个番茄钟</span>
          </div>
          <button
            type="button"
            class="zf-new-task-compact"
            title="新建任务"
            @click="openCreateDialog"
          >
            <AppIcon icon="ri-add-line" />
            <span>新建</span>
          </button>
          <button type="button" class="zf-btn zf-btn--icon" title="关闭面板" @click="panelOpen = false">
            <AppIcon icon="ri-close-line" />
          </button>
        </div>

        <div class="zf-flyout-scroll">
          <TodayStatsBar
            :work-count="statistics.today.work"
            :work-duration="effective.workDuration"
            :streak="store.streak"
          />
          <FocusAssets class="zf-streak" />
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
          <FocusRecordPanel :records="todayRecords" />
        </div>

        <div class="zf-flyout-foot">
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
        </div>
      </aside>
    </transition>

    <!-- ═══ 统计：全屏报告层 ═══ -->
    <transition name="zf-fade">
      <div v-if="statsOverlay" class="zf-stats-overlay">
        <header class="zf-stats-head">
          <h3 class="zf-stats-title">专注统计</h3>
          <button type="button" class="zf-btn zf-btn--icon" title="关闭" @click="statsOverlay = false">
            <AppIcon icon="ri-close-line" />
          </button>
        </header>
        <div class="zf-stats-body">
          <StatisticsPanel />
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
// B61 结构重构：拆掉常驻侧栏——任务面板按需滑出，统计升级为全屏报告层
const panelOpen = ref(false)
const statsOverlay = ref(false)

// 番茄循环进度（顶栏圆点）：本组已完成 N / 每 interval 个进长休息
const sessionDots = computed(() => {
  const interval = Math.max(2, effective.value.longBreakInterval)
  const completed = focusedTimerState.value?.consecutiveCount ?? 0
  return { total: interval, completed: completed % interval }
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
  panelOpen.value = false
  await store.loadStats('week')
}

// Esc：统计层 → 关层；任务面板 → 收起（统计层优先）
function onGlobalKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (statsOverlay.value) {
    statsOverlay.value = false
  } else if (panelOpen.value) {
    panelOpen.value = false
  }
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
/* ═══ B61 结构重构 · 「舞台式」═══
   巨环独占全屏 = 唯一主角；工具收进底部 Dock；任务面板按需滑出；
   统计全屏报告层。层级：氛围光斑(0) < 舞台(1) < 顶栏/Dock(20/30)
   < 面板(40) < 统计层(50) < 弹窗(1000, UModal teleport)。 */
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

/* ─── 氛围光斑（收在画布内） ─── */
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

/* ─── 顶栏：一条发丝线 ─── */
.zf-topbar {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
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
}

.zf-brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pomo-mode);
  box-shadow: 0 0 10px var(--pomo-mode-glow);
  transition: background 0.8s ease, box-shadow 0.8s ease;
}

.zf-brand-name {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--pomo-text-muted);
}

/* 后台项目 chips（顶栏右侧，只有活跃时出现） */
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

/* ─── 舞台：巨环即页面 ─── */
.zf-stage {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  gap: 26px;
  padding: 24px 32px 96px; /* 底部给 Dock 留位 */
  min-width: 0;
  overflow-y: auto;
}

/* 会话圆点：环的正上方，本组循环进度 */
.zf-session {
  display: flex;
  align-items: center;
  gap: 8px;
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

/* ─── 浮动提示堆栈（横幅） ─── */
.zf-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(440px, 90%);
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

/* ─── 当下一行：状态 · 任务 · 主控 ─── */
.zf-nowline {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(560px, 92%);
}

.zf-nowline-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  background: var(--pomo-surface-container);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--pomo-text-muted);
  flex-shrink: 0;
  transition: background 0.8s ease, color 0.8s ease;
}

.zf-nowline-status.live {
  background: var(--pomo-mode-soft);
  color: var(--pomo-mode);
}

.zf-blink-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pomo-text-muted);
}

.zf-nowline-status.live .zf-blink-dot {
  background: var(--pomo-mode);
  animation: zf-blink 1.6s infinite both;
}

.zf-nowline-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 14.5px;
  font-weight: 550;
  color: var(--pomo-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zf-nowline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.zf-nowline--empty {
  justify-content: center;
  gap: 10px;
  padding: 12px 20px;
  border: 1px dashed var(--pomo-outline-variant);
  border-radius: 999px;
  font-size: 13px;
  color: var(--pomo-text-muted);
}

.zf-nowline--empty i {
  font-size: 17px;
  color: var(--pomo-mode);
}

/* ─── Buttons ─── */
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

.zf-btn--hero {
  padding: 10px 24px;
  font-size: 14px;
}

.zf-btn--filled:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--pomo-mode-glow);
  opacity: 0.94;
}

.zf-btn--filled:active {
  transform: translateY(0) scale(0.98);
}

.zf-btn--filled:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.zf-btn--ghost {
  padding: 8px 16px;
  background: transparent;
  color: var(--pomo-text-soft);
  border: 1px solid var(--pomo-outline-variant);
  border-radius: 999px;
  font-size: 13px;
}

.zf-btn--ghost:hover {
  background: var(--pomo-surface-container);
  color: var(--pomo-text-strong);
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

/* ─── Dock：底部悬浮工具排（真悬浮层，吃 surface 卡质感） ─── */
.zf-dock-wrap {
  position: absolute;
  left: 50%;
  bottom: 20px;
  z-index: 30;
  transform: translateX(-50%);
}

.zf-dock {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: var(--pomo-glass-bg-elevated);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--pomo-glass-border-elevated);
  border-radius: 16px;
  box-shadow: var(--pomo-shadow-elevated);
}

.zf-dock-btn {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 17px;
  color: var(--pomo-text-muted);
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
}

.zf-dock-btn:hover {
  background: var(--pomo-surface-container);
  color: var(--pomo-text-strong);
  transform: translateY(-2px);
}

.zf-dock-btn.active {
  background: var(--pomo-mode-soft);
  color: var(--pomo-mode);
}

.zf-dock-divider {
  width: 1px;
  height: 20px;
  background: var(--pomo-outline-variant);
  margin: 0 5px;
}

/* Dock 弹层（特殊休息 / 声景）：锚在 Dock 正上方 */
.zf-dock-pop {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  z-index: 35;
  transform: translateX(-50%);
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

/* 新建任务紧凑按钮（面板头部） */
.zf-new-task-compact {
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

/* ─── 任务面板：右侧滑出（按需） ─── */
.zf-flyout {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(380px, 92vw);
  padding: 18px 18px 14px;
  background: var(--pomo-surface);
  border-left: 1px solid var(--pomo-surface-border);
  box-shadow: var(--pomo-shadow-elevated);
}

.zf-flyout-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.zf-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--pomo-mode-soft);
  color: var(--pomo-mode);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: background 0.8s ease, color 0.8s ease;
  flex-shrink: 0;
}

.zf-greeting {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.zf-greeting-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--pomo-text-strong);
}

.zf-greeting-sub {
  font-size: 11.5px;
  color: var(--pomo-text-muted);
}

.zf-flyout-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding-right: 4px;
}

.zf-flyout-scroll::-webkit-scrollbar {
  width: 5px;
}

.zf-flyout-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.zf-flyout-scroll::-webkit-scrollbar-thumb {
  background: var(--pomo-outline-variant);
  border-radius: 3px;
}

.zf-flyout-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--pomo-outline);
}

.zf-streak {
  margin-bottom: -4px;
}

.zf-flyout-foot {
  flex-shrink: 0;
}

/* ─── 今日进度（面板底） ─── */
.zf-progress {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 12px;
  border-top: 1px solid var(--pomo-surface-border);
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
  color: var(--pomo-mode);
  font-weight: 650;
  transition: color 0.8s ease;
}

.zf-progress-track {
  height: 4px;
  border-radius: 2px;
  background: var(--pomo-surface-container);
  overflow: hidden;
}

.zf-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--pomo-mode);
  transition:
    width 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.8s ease;
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
  padding-top: 16px;
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

.zf-flyout-enter-active,
.zf-flyout-leave-active {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}

.zf-flyout-enter-from,
.zf-flyout-leave-to {
  transform: translateX(100%);
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
