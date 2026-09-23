/**
 * Leaf · useMultiPomodoroTimer
 *
 * P1-2：多项目并行 timer 状态机
 *
 * 数据结构：
 * - timers: reactive Map<projectId, TimerState>
 * - focusedProjectId: 当前「焦点项目」（主视图显示）
 *
 * 设计原则：
 * - 同一时间可多个项目 active；每个项目独立计时
 * - 切换焦点不会暂停后台项目
 * - 全局快捷键 + 主 UI 都作用在 focusedProjectId 上
 * - 所有 timer 在 setInterval 中并行 tick
 *
 * v2 新增（番茄钟 P0/P1 执行轮）：
 * - Flowtime 正计时：timerStyle='flowtime' 时 work 模式从 0 开始正向计数，
 *   不自动结束；由 finishFlowtime() 显式完成并按「时长/5」推导休息时长
 * - 严格模式：isStrict() 为 true 时，work 计时中禁止 暂停/跳过/重置/切模式；
 *   离开窗口作废由 failStrict() 显式触发（index.vue 监听 window blur）
 * - 阶段临近预警：倒计时越过 60s / 30s 阈值时回调 onWarning（每轮每阈值至多一次）
 */

import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  reactive,
  readonly,
  ref,
  type Ref,
  type ComputedRef,
  type DeepReadonly
} from 'vue'

export interface ProjectTimerOverrides {
  workDuration?: number | null
  shortBreakDuration?: number | null
  longBreakDuration?: number | null
  /** 项目级「每完成几个 work 进一次 longBreak」覆盖；fallback 全局 longBreakInterval */
  longBreakInterval?: number | null
}

export type TimerMode = 'work' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerState {
  projectId: string
  mode: TimerMode
  status: TimerStatus
  timeLeft: number
  currentTaskId: string | null
  consecutiveCount: number
  lastTickAt: number
  startedAt: number | null
  /** 长休息刚结束标志（用于 UI 显示 resume banner） */
  justFinishedLongBreak: boolean
  /** Flowtime：本次专注已累计秒数（work 正计时时 = timeLeft） */
  elapsed: number
  /** 预警：本轮开始时的剩余秒数（用于判断阈值是否在本轮内越过） */
  warnBase: number
  /** 预警：本轮已触发过的阈值 */
  warned: number[]
  /** P2-8：一次性特殊休息（午休等），完成/切模式后自动清除 */
  specialBreak: boolean
  /** P2-8：特殊休息总秒数（用于按实际时长写记录，而非配置的短休息时长） */
  specialBreakTotalSec: number | null
}

interface UseMultiPomodoroTimerOptions {
  globalSettings: () => {
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    longBreakInterval?: number
  }
  getProjectOverrides: (projectId: string) => ProjectTimerOverrides | null
  onComplete: (payload: {
    projectId: string
    type: TimerMode
    /** 毫秒（内部秒 ×1000，对齐 pom_pomodoros.duration_ms 列语义） */
    duration: number
    taskId: string | null
    taskTitle: string | null
    taskById: (id: string) => { title: string } | undefined
  }) => void | Promise<void>
  notify: (
    projectId: string,
    event: 'start' | 'pause' | 'complete' | 'break',
    message?: string
  ) => void | Promise<void>
  taskById: (id: string) => { title: string } | undefined
  defaultProjectId: string
  shouldAutoStart?: () => { break: boolean; work: boolean }
  persist?: (projectId: string, state: PersistedTimerState) => void
  /** 全局是否为 Flowtime 正计时风格 */
  isFlowtime?: () => boolean
  /** 全局严格模式（work 计时中禁 暂停/跳过/重置/切模式） */
  isStrict?: () => boolean
  /** 阶段临近预警（越过 60s / 30s 时触发） */
  onWarning?: (projectId: string, secondsLeft: number) => void | Promise<void>
  /** 严格模式失败（离开窗口等）回调，用于 UI 提示 */
  onStrictFail?: (projectId: string) => void
}

export interface PersistedTimerState {
  mode: TimerMode
  status: 'idle' | 'paused'
  timeLeft: number
  currentTaskId: string | null
  consecutiveCount: number
  updatedAt: number
  /** Flowtime 累计秒数（可选，向后兼容旧快照） */
  elapsed?: number
}

const WARN_THRESHOLDS = [60, 30]

const DEFAULT_STATE = (projectId: string, mode: TimerMode = 'work'): TimerState => ({
  projectId,
  mode,
  status: 'idle',
  timeLeft: 0,
  currentTaskId: null,
  consecutiveCount: 0,
  lastTickAt: 0,
  startedAt: null,
  justFinishedLongBreak: false,
  elapsed: 0,
  warnBase: 0,
  warned: [],
  specialBreak: false,
  specialBreakTotalSec: null
})

function durationFor(
  mode: TimerMode,
  global: { workDuration: number; shortBreakDuration: number; longBreakDuration: number },
  overrides: ProjectTimerOverrides | null
): number {
  const m =
    mode === 'work'
      ? (overrides?.workDuration ?? global.workDuration)
      : mode === 'shortBreak'
        ? (overrides?.shortBreakDuration ?? global.shortBreakDuration)
        : (overrides?.longBreakDuration ?? global.longBreakDuration)
  return Math.max(1, Math.floor(m * 60))
}

/** Flowtime 休息推导：专注时长 / 5，下限 1 分钟、上限 20 分钟 */
function flowtimeBreakSeconds(elapsedSec: number): number {
  return Math.min(20 * 60, Math.max(60, Math.floor(elapsedSec / 5)))
}

/** useMultiPomodoroTimer 返回结构 */
export interface MultiPomodoroTimerComposable {
  focusedProjectId: Ref<string>
  timers: DeepReadonly<Map<string, TimerState>>
  focusedTimer: ComputedRef<TimerState | null>
  focus: (projectId: string) => void
  start: (projectId?: string) => void
  pause: (projectId?: string) => void
  toggle: (projectId?: string) => void
  skip: (projectId?: string) => Promise<void>
  reset: (projectId?: string) => void
  finishFlowtime: (projectId?: string) => Promise<void>
  failStrict: (projectId?: string) => void
  startSpecialBreak: (minutes: number, projectId?: string) => void
  setMode: (mode: TimerMode, projectId?: string) => void
  setCurrentTask: (taskId: string | null, projectId?: string) => void
  restorePersisted: (
    projectId: string,
    snapshot: Pick<
      PersistedTimerState,
      'mode' | 'status' | 'timeLeft' | 'currentTaskId' | 'consecutiveCount'
    > & { elapsed?: number }
  ) => void
  getTimer: (projectId: string) => TimerState
  isActive: (projectId: string) => boolean
  activeProjects: () => TimerState[]
  effectiveDuration: (state: TimerState) => number
  startAll: () => void
  stopAll: () => void
}

export function useMultiPomodoroTimer(
  options: UseMultiPomodoroTimerOptions
): MultiPomodoroTimerComposable {
  const focusedProjectId = ref<string>(options.defaultProjectId)
  const timers = reactive<Map<string, TimerState>>(new Map())
  let tickHandle: ReturnType<typeof setInterval> | null = null

  function ensureTimer(projectId: string): TimerState {
    let t = timers.get(projectId)
    if (!t) {
      t = reactive(DEFAULT_STATE(projectId)) as TimerState
      // 初始化 timeLeft 为当前模式的有效时长（避免显示 00:00）
      t.timeLeft = durationFor(
        t.mode,
        options.globalSettings(),
        options.getProjectOverrides(projectId)
      )
      timers.set(projectId, t)
    }
    return t
  }

  function snapshotPersist(state: TimerState): void {
    if (!options.persist) return
    if (state.status === 'running') return
    options.persist(state.projectId, {
      mode: state.mode,
      status: state.status === 'paused' ? 'paused' : 'idle',
      timeLeft: state.timeLeft,
      currentTaskId: state.currentTaskId,
      consecutiveCount: state.consecutiveCount,
      elapsed: state.elapsed,
      updatedAt: Date.now()
    })
  }

  function effectiveDuration(state: TimerState): number {
    return durationFor(
      state.mode,
      options.globalSettings(),
      options.getProjectOverrides(state.projectId)
    )
  }

  function setTimerToDuration(state: TimerState): void {
    state.timeLeft = effectiveDuration(state)
  }

  function isFlowtimeWork(state: TimerState): boolean {
    return state.mode === 'work' && (options.isFlowtime?.() ?? false)
  }

  /** 严格模式守卫：work 计时中是否禁止该操作 */
  function strictBlocked(state: TimerState): boolean {
    return state.mode === 'work' && state.status === 'running' && (options.isStrict?.() ?? false)
  }

  function startAll(): void {
    if (tickHandle) return
    tickHandle = setInterval(tickAll, 1000)
  }

  function tickAll(): void {
    const now = Date.now()
    for (const state of timers.values()) {
      if (state.status !== 'running') continue
      let elapsedSec = 1
      if (state.lastTickAt > 0) {
        elapsedSec = Math.max(1, Math.floor((now - state.lastTickAt) / 1000))
      }
      state.lastTickAt = now

      // Flowtime 正计时：只累加，永不因计时结束
      if (isFlowtimeWork(state)) {
        state.elapsed += elapsedSec
        state.timeLeft = state.elapsed
        continue
      }

      if (state.timeLeft > 0) {
        state.timeLeft = Math.max(0, state.timeLeft - elapsedSec)
      }

      // 临近预警：本轮从阈值上方越过时触发一次
      for (const threshold of WARN_THRESHOLDS) {
        if (
          state.warnBase > threshold &&
          state.timeLeft <= threshold &&
          !state.warned.includes(threshold)
        ) {
          state.warned.push(threshold)
          void options.onWarning?.(state.projectId, threshold)
        }
      }

      if (state.timeLeft <= 0) {
        void completeInternal(state, true)
      }
    }
  }

  async function completeInternal(
    state: TimerState,
    byTimer: boolean,
    override?: { durationSec?: number; nextBreakSec?: number }
  ): Promise<void> {
    const wasRunning = state.status === 'running'
    const specialTotalSec = state.specialBreakTotalSec
    state.status = 'paused'
    state.timeLeft = 0

    const task = state.currentTaskId ? options.taskById(state.currentTaskId) : null
    await options.onComplete({
      projectId: state.projectId,
      type: state.mode,
      // 内部计时均为秒；×1000 对齐 pom_pomodoros.duration_ms 列（毫秒）语义
      duration:
        (override?.durationSec ??
          (specialTotalSec != null ? specialTotalSec : effectiveDuration(state))) * 1000,
      taskId: state.currentTaskId,
      taskTitle: task?.title ?? null,
      taskById: options.taskById
    })

    const prevConsecutive = state.consecutiveCount
    const prevMode = state.mode
    if (prevMode === 'work') {
      state.consecutiveCount = prevConsecutive + 1
    }
    // 长休息结束标志：供 UI 显示 resume banner
    state.justFinishedLongBreak = prevMode === 'longBreak'

    const nextMode: TimerMode = (() => {
      if (prevMode !== 'work') return 'work'
      const projOverrides = options.getProjectOverrides(state.projectId)
      const globalRaw = options.globalSettings() as { longBreakInterval?: number }
      const fallbackInterval = globalRaw.longBreakInterval ?? 4
      const longBreakInterval = Math.max(2, projOverrides?.longBreakInterval ?? fallbackInterval)
      const completed = prevConsecutive + 1
      return completed > 0 && completed % longBreakInterval === 0 ? 'longBreak' : 'shortBreak'
    })()

    state.mode = nextMode
    state.startedAt = null
    state.lastTickAt = 0
    state.status = byTimer ? 'paused' : 'idle'
    setTimerToDuration(state)
    if (override?.nextBreakSec && nextMode !== 'work') {
      state.timeLeft = Math.max(60, Math.floor(override.nextBreakSec))
    }
    state.elapsed = 0
    state.warned = []
    state.specialBreak = false
    state.specialBreakTotalSec = null
    state.warnBase = state.timeLeft

    if (byTimer) {
      await options.notify(
        state.projectId,
        state.mode === 'work' ? 'break' : 'start',
        state.mode === 'work' ? '休息结束，下一轮开始' : '专注结束，进入休息'
      )
    }

    const auto = options.shouldAutoStart?.() ?? { break: false, work: false }
    const shouldAuto = prevMode === 'work' ? auto.break : auto.work
    if (shouldAuto) {
      state.status = 'running'
      state.startedAt = Date.now()
      state.lastTickAt = Date.now()
      startAll()
      await options.notify(state.projectId, 'start')
    } else if (wasRunning) {
      state.status = 'paused'
    }

    snapshotPersist(state)
  }

  function focus(projectId: string): void {
    ensureTimer(projectId)
    focusedProjectId.value = projectId
  }

  function start(projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (state.status === 'running') return
    if (isFlowtimeWork(state)) {
      // Flowtime：idle 时从 0 开始；暂停后继续则保留累计
      if (state.status === 'idle') {
        state.elapsed = 0
        state.timeLeft = 0
      }
    } else if (state.timeLeft <= 0) {
      setTimerToDuration(state)
    }
    state.justFinishedLongBreak = false
    state.warned = []
    state.warnBase = isFlowtimeWork(state) ? 0 : state.timeLeft
    state.status = 'running'
    state.startedAt = Date.now()
    state.lastTickAt = Date.now()
    startAll()
    void options.notify(id, 'start')
  }

  function pause(projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (state.status !== 'running') return
    if (strictBlocked(state)) return
    state.status = 'paused'
    state.lastTickAt = 0
    state.startedAt = null
    void options.notify(id, 'pause')
    snapshotPersist(state)
  }

  function toggle(projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (state.status === 'running') pause(id)
    else start(id)
  }

  async function skip(projectId?: string): Promise<void> {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (strictBlocked(state)) return
    // Flowtime 的 work：skip 语义 = 结束本次专注（按累计时长记录）
    if (isFlowtimeWork(state)) {
      await finishFlowtime(id)
      return
    }
    await completeInternal(state, false)
  }

  function reset(projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (strictBlocked(state)) return
    state.status = 'idle'
    state.lastTickAt = 0
    state.startedAt = null
    state.warned = []
    state.specialBreak = false
    state.specialBreakTotalSec = null
    if (isFlowtimeWork(state)) {
      state.elapsed = 0
      state.timeLeft = 0
    } else {
      state.timeLeft = effectiveDuration(state)
      state.warnBase = state.timeLeft
    }
    snapshotPersist(state)
  }

  /** Flowtime：显式结束本次正计时专注，按累计时长记录并推导休息 */
  async function finishFlowtime(projectId?: string): Promise<void> {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (!isFlowtimeWork(state)) {
      await completeInternal(state, false)
      return
    }
    if (state.elapsed < 10) {
      // 专注不足 10 秒不记录，直接归零
      reset(id)
      return
    }
    await completeInternal(state, false, {
      durationSec: state.elapsed,
      nextBreakSec: flowtimeBreakSeconds(state.elapsed)
    })
  }

  /** 严格模式：作废当前番茄（离开窗口等场景），不写入记录 */
  function failStrict(projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (state.status !== 'running') return
    state.status = 'idle'
    state.lastTickAt = 0
    state.startedAt = null
    state.warned = []
    if (isFlowtimeWork(state)) {
      state.elapsed = 0
      state.timeLeft = 0
    } else {
      state.timeLeft = effectiveDuration(state)
      state.warnBase = state.timeLeft
    }
    snapshotPersist(state)
    options.onStrictFail?.(id)
  }

  /**
   * P2-8：一次性特殊休息（午餐 / 晚饭等），不占用番茄循环——
   * 直接进入指定时长的短休息并自动开始；完成后回到正常 work 节奏。
   */
  function startSpecialBreak(minutes: number, projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (strictBlocked(state)) return
    if (state.status === 'running') {
      state.status = 'paused'
    }
    state.mode = 'shortBreak'
    state.specialBreak = true
    state.specialBreakTotalSec = Math.max(60, Math.floor(minutes * 60))
    state.timeLeft = state.specialBreakTotalSec
    state.warned = []
    state.warnBase = state.timeLeft
    state.status = 'running'
    state.startedAt = Date.now()
    state.lastTickAt = Date.now()
    startAll()
    void options.notify(id, 'start', '特殊休息开始')
  }

  function setMode(mode: TimerMode, projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    if (strictBlocked(state)) return
    if (state.status === 'running') {
      state.status = 'paused'
    }
    state.mode = mode
    state.warned = []
    state.specialBreak = false
    state.specialBreakTotalSec = null
    if (isFlowtimeWork(state)) {
      state.elapsed = 0
      state.timeLeft = 0
      state.warnBase = 0
    } else {
      setTimerToDuration(state)
      state.warnBase = state.timeLeft
    }
    snapshotPersist(state)
  }

  function setCurrentTask(taskId: string | null, projectId?: string): void {
    const id = projectId ?? focusedProjectId.value
    const state = ensureTimer(id)
    state.currentTaskId = taskId
    snapshotPersist(state)
  }

  function getTimer(projectId: string): TimerState {
    return ensureTimer(projectId)
  }

  function isActive(projectId: string): boolean {
    const t = timers.get(projectId)
    return !!t && t.status === 'running'
  }

  function activeProjects(): TimerState[] {
    return Array.from(timers.values()).filter((t) => t.status === 'running')
  }

  function restorePersisted(
    projectId: string,
    snapshot: Pick<
      PersistedTimerState,
      'mode' | 'status' | 'timeLeft' | 'currentTaskId' | 'consecutiveCount'
    > & { elapsed?: number }
  ): void {
    const state = ensureTimer(projectId)
    state.mode = snapshot.mode
    state.status = snapshot.status === 'paused' ? 'paused' : 'idle'
    state.elapsed = Math.max(0, snapshot.elapsed ?? 0)
    state.timeLeft =
      typeof snapshot.timeLeft === 'number' && snapshot.timeLeft > 0
        ? snapshot.timeLeft
        : isFlowtimeWork(state)
          ? state.elapsed
          : effectiveDuration(state)
    state.currentTaskId = snapshot.currentTaskId ?? null
    state.consecutiveCount = Math.max(0, snapshot.consecutiveCount ?? 0)
    state.lastTickAt = 0
    state.startedAt = null
    state.warnBase = isFlowtimeWork(state) ? 0 : state.timeLeft
    state.warned = []
  }

  function stopAll(): void {
    if (tickHandle) {
      clearInterval(tickHandle)
      tickHandle = null
    }
    for (const state of timers.values()) {
      if (state.status !== 'running') {
        snapshotPersist(state)
      } else {
        state.status = 'paused'
        state.startedAt = null
        state.lastTickAt = 0
        snapshotPersist(state)
      }
    }
  }

  const focusedTimer = computed(() => timers.get(focusedProjectId.value) ?? null)

  // 全局单例的 stopAll 只应挂在创建时的合法生命周期上：App.vue 在 isPrimaryWindow
  // IPC 返回后创建（无活跃实例，onBeforeUnmount 本就失效）；但若 IPC 未返回时
  // 用户已进入番茄钟页，单例会绑到路由视图 —— 导航离开会误停所有计时器。
  // 这里只在确有组件实例时注册（与 App.vue 正常路径行为一致，同时消除竞态）
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      stopAll()
    })
  }

  return {
    focusedProjectId,
    timers: readonly(timers),
    focusedTimer,
    focus,
    start,
    pause,
    toggle,
    skip,
    reset,
    finishFlowtime,
    failStrict,
    startSpecialBreak,
    setMode,
    setCurrentTask,
    restorePersisted,
    getTimer,
    isActive,
    activeProjects,
    effectiveDuration,
    startAll,
    stopAll
  }
}

export type UseMultiPomodoroTimerReturn = MultiPomodoroTimerComposable
