/**
 * Leaf · Pomodoro Pinia store (P0-1 骨架)
 *
 * 设计目标：
 * - 单一事实源：番茄钟模块所有数据走 store + IPC
 * - 渐进式迁移：本 PR 暂不强制所有调用方走 store，仍保留 props/emits
 *   兼容旧 index.vue 行为，P0-2 / P0-3 时再把所有组件切到 store
 *
 * 当前范围（P0-1）：
 * - tasks / records / settings / statistics 四个集合的 state + actions
 * - 派生 getter：todayFocusMinutes、completedTasks、pendingTasks
 * - 不持有计时器状态（timeLeft / isRunning / currentMode 仍由 index.vue 持有）
 *
 * 后续 P0-2 会迁入：
 * - currentMode / isRunning / timeLeft / completedCount
 * - usePomodoroTimer composable
 * - 自动持久化当前任务 ID 与迷你窗位置
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// ─────────── 类型（与 PomodoroRepository 业务接口对齐） ───────────

export type TimerMode = 'work' | 'shortBreak' | 'longBreak'

export interface PomodoroTask {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: number
  estimateMs: number | null
  projectId: string | null
  createdAt: number
  completedAt?: number
}

export interface PomodoroProject {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface PomodoroRecord {
  id: string
  taskId?: string
  taskTitle?: string
  projectId?: string
  type: TimerMode
  duration: number
  completedAt: number
  date: string
}

/** P1-2：项目级时长覆盖（在 renderer 侧自己定义，跨进程边界干净）
 *  - number：使用此值
 *  - null：显式清空（恢复全局默认）
 *  - undefined：保留现有值（不修改）
 */
export interface ProjectTimerOverrides {
  workDuration?: number | null
  shortBreakDuration?: number | null
  longBreakDuration?: number | null
  longBreakInterval?: number | null
}

/** M14/M15：每个项目最近持久化的 timer state 快照 */
export interface PersistedTimerState {
  mode: TimerMode
  status: 'idle' | 'paused'
  timeLeft: number
  currentTaskId: string | null
  consecutiveCount: number
  updatedAt: number
  /** Flowtime：本次专注累计秒数（向后兼容，旧快照无此字段） */
  elapsed?: number
}

export interface PomodoroSettings {
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  soundEnabled: boolean
  notificationEnabled: boolean
  autoStartBreak: boolean
  autoStartWork: boolean
  /** M12：铃声预设 id */
  ringtone?: string
  /** 计时风格：倒计时番茄 / Flowtime 正计时（仅作用于 work 阶段） */
  timerStyle?: 'pomodoro' | 'flowtime'
  /** 严格模式：work 计时中禁 暂停/跳过/重置/切模式 */
  strictMode?: boolean
  /** 严格模式子项：计时中离开窗口 → 作废本番茄 */
  strictBlurFails?: boolean
  /** 完成与预警的语音播报（speechSynthesis） */
  voiceEnabled?: boolean
  /** P0-3：声景白噪音（none/rain/waves/forest/cafe/fireplace） */
  soundscape?: string
  /** P0-3：声景音量 0..1 */
  soundscapeVolume?: number
  /** P2-9：休息阶段自动全屏 */
  fullscreenBreak?: boolean
}

export type PomodoroRingtoneId = 'bell' | 'chime' | 'ding' | 'silent'

export interface PomodoroStatistics {
  today: { total: number; work: number; shortBreak: number; longBreak: number }
  week: { total: number; work: number; shortBreak: number; longBreak: number }
  month: { total: number; work: number; shortBreak: number; longBreak: number }
}

export type StatsRange = 'today' | 'week' | 'month' | 'custom'

export interface DailyTrendPoint {
  date: string
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  completedPomodoros: number
  completedTasks: number
}

export interface ProjectDistributionPoint {
  projectId: string | null
  projectName: string
  color: string
  workMinutes: number
  completedPomodoros: number
}

export interface HeatmapCell {
  day: number
  hour: number
  date: string
  workMinutes: number
}

export interface TaskCompletionStats {
  total: number
  completed: number
  completionRate: number
  completedPomodoros: number
  avgPomodorosPerTask: number
  avgEstimateDeviationMs: number
  estimateOverCount: number
  estimateUnderCount: number
}

export type PomodoroNotificationMode = 'normal' | 'strong' | 'silent'

export type PomodoroShortcutAction = 'toggle' | 'skip' | 'reset'

export interface PomodoroShortcuts {
  toggle: string
  skip: string
  reset: string
}

export interface PomodoroTraySnapshot {
  isRunning: boolean
  currentMode: 'work' | 'shortBreak' | 'longBreak' | null
  taskTitle: string
  timeLeftSeconds: number
  /** 当前模式总时长（秒），供 MiniTimer 计算进度环 */
  totalSeconds?: number
  todayCompleted: number
  projectId?: string | null
  projectName?: string
  /** M7：专注模式开关 */
  focusMode?: boolean
  backgroundProjects?: Array<{
    id: string
    name: string
    timeLeftSeconds: number
    mode: 'work' | 'shortBreak' | 'longBreak'
  }>
  updatedAt: number
}

export interface PomodoroTaskDetail {
  task: PomodoroTask
  project: PomodoroProject | null
  records: PomodoroRecord[]
  summary: PomodoroTaskSummary | null
}

export interface PomodoroTaskSummary {
  taskId: string
  pomodoroCount: number
  workMs: number
  firstStartedAt: number | null
  lastCompletedAt: number | null
  estimateMs: number | null
  estimateDeviationMs: number | null
}

export interface PomodoroRecordDetail {
  record: PomodoroRecord
  task: PomodoroTask | null
}

// ─────────── Store ───────────

export const usePomodoroStore = defineStore('pomodoro', () => {
  // ─── state ───
  const tasks = ref<PomodoroTask[]>([])
  const projects = ref<PomodoroProject[]>([])
  const records = ref<PomodoroRecord[]>([])
  const todayRecords = ref<PomodoroRecord[]>([])
  const freeRecords = ref<PomodoroRecord[]>([])
  const statistics = ref<PomodoroStatistics | null>(null)
  const settings = ref<PomodoroSettings | null>(null)

  // ─── P1-2：多项目并行 ───
  const focusedProjectId = ref<string | null>(null)
  const projectSettings = ref<Record<string, ProjectTimerOverrides>>({})

  // M14/M15：每项目 timer state 持久化（启动恢复）
  const timerStates = ref<Record<string, PersistedTimerState>>({})

  // ─── 扩展统计（P0-3）───
  const statsRange = ref<StatsRange>('week')
  const dailyTrend = ref<DailyTrendPoint[]>([])
  const projectDistribution = ref<ProjectDistributionPoint[]>([])
  const focusHeatmap = ref<HeatmapCell[]>([])
  const taskStats = ref<TaskCompletionStats | null>(null)
  const statsLoading = ref(false)

  // M8：连续专注天数（streak）
  const streak = ref<{
    current: number
    longest: number
    activeToday: boolean
  }>({ current: 0, longest: 0, activeToday: false })

  const loading = ref(false)
  // ─── 集成（P0-4）───
  const integrationMode = ref<PomodoroNotificationMode>('normal')
  const integrationShortcuts = ref<PomodoroShortcuts>({
    toggle: 'CommandOrControl+Shift+P',
    skip: 'CommandOrControl+Shift+S',
    reset: 'CommandOrControl+Shift+R'
  })
  // M7：专注模式开关
  const focusMode = ref<boolean>(false)
  const traySnapshot = ref<PomodoroTraySnapshot>({
    isRunning: false,
    currentMode: null,
    taskTitle: '',
    timeLeftSeconds: 0,
    todayCompleted: 0,
    updatedAt: 0
  })
  // ─── 详情页（P1-1）───
  const taskDetailId = ref<string | null>(null)
  const taskDetail = ref<PomodoroTaskDetail | null>(null)
  const taskDetailLoading = ref(false)
  const selectedRecordId = ref<string | null>(null)
  const recordDetail = ref<PomodoroRecordDetail | null>(null)
  const integrationFailedShortcuts = ref<PomodoroShortcutAction[]>([])
  const lastError = ref<string | null>(null)

  // ─── getters ───
  const todayFocusMinutes = computed(() => {
    if (!statistics.value || !settings.value) return 0
    return statistics.value.today.work * settings.value.workDuration
  })

  const completedTasks = computed(() => tasks.value.filter((t) => t.completed))
  const pendingTasks = computed(() => tasks.value.filter((t) => !t.completed))

  // ─── actions ───

  /** 初始加载：拉取任务/设置/统计/今日记录 / 项目时长覆盖 / timer state */
  async function load(): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const [t, p, s, st, tr, allSettings, allTimerStates] = await Promise.all([
        window.api.pomodoro.getTasks(),
        window.api.pomodoro.projects.getAll(),
        window.api.pomodoro.getSettings(),
        window.api.pomodoro.getStatistics(),
        window.api.pomodoro.getTodayRecords(),
        window.api.pomodoro.projects.settings.all(),
        window.api.pomodoro.timerState.getAll()
      ])
      tasks.value = t as PomodoroTask[]
      projects.value = p as PomodoroProject[]
      settings.value = s as PomodoroSettings
      statistics.value = st as PomodoroStatistics
      todayRecords.value = (tr as PomodoroRecord[]) || []
      projectSettings.value = (allSettings as Record<string, ProjectTimerOverrides>) || {}
      timerStates.value = (allTimerStates as Record<string, PersistedTimerState>) || {}
      // M4：自由番茄记录
      void loadFreeRecords().catch(() => {})
      // 焦点项目：仅当用户之前显式选择过且仍有效时才恢复
      if (focusedProjectId.value && !projects.value.some((p) => p.id === focusedProjectId.value)) {
        focusedProjectId.value = null
      }
      // 推送项目列表到主进程（tray / dock 菜单）
      void pushProjectsToMain()
      // M7：加载专注模式
      void loadFocusMode()
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err)
      console.error('[pomodoro store] load failed:', err)
    } finally {
      loading.value = false
    }
  }

  async function addTask(
    title: string,
    options?: {
      description?: string
      priority?: number
      estimateMs?: number | null
      projectId?: string | null
    }
  ): Promise<PomodoroTask | null> {
    const task = (await window.api.pomodoro.addTask(title, options)) as PomodoroTask
    tasks.value.unshift(task)
    return task
  }

  async function updateTask(id: string, updates: Partial<PomodoroTask>): Promise<void> {
    const updated = (await window.api.pomodoro.updateTask(id, updates)) as PomodoroTask | null
    if (updated) {
      const idx = tasks.value.findIndex((t) => t.id === id)
      if (idx >= 0) tasks.value[idx] = updated
    }
  }

  async function deleteTask(id: string): Promise<void> {
    await window.api.pomodoro.deleteTask(id)
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }

  async function completeTask(id: string): Promise<void> {
    const updated = (await window.api.pomodoro.completeTask(id)) as PomodoroTask | null
    if (updated) {
      const idx = tasks.value.findIndex((t) => t.id === id)
      if (idx >= 0) tasks.value[idx] = updated
    }
  }

  async function addProject(name: string, color?: string): Promise<PomodoroProject> {
    const project = (await window.api.pomodoro.projects.add(name, color)) as PomodoroProject
    projects.value.push(project)
    return project
  }

  async function updateProject(
    id: string,
    updates: { name?: string; color?: string; sortOrder?: number }
  ): Promise<void> {
    const updated = (await window.api.pomodoro.projects.update(
      id,
      updates
    )) as PomodoroProject | null
    if (updated) {
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx >= 0) projects.value[idx] = updated
    }
  }

  async function deleteProject(id: string): Promise<void> {
    await window.api.pomodoro.projects.delete(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    // 焦点项目被删则切到第一个剩余项目
    if (focusedProjectId.value === id) {
      focusedProjectId.value = projects.value[0]?.id ?? null
    }
    // 清理本地项目覆盖缓存
    delete projectSettings.value[id]
  }

  // ─── P1-2：项目级时长覆盖 / 焦点项目 ───

  function setFocusedProject(id: string | null): void {
    focusedProjectId.value = id
  }

  // ─── M14/M15：每项目 timer state 持久化 ───

  function getTimerState(projectId: string): PersistedTimerState | null {
    return timerStates.value[projectId] ?? null
  }

  /** 由 composable 调用，把每次 state 变更写到 pref_preferences */
  async function persistTimerState(
    projectId: string,
    snapshot: PersistedTimerState
  ): Promise<void> {
    try {
      // 先把 running 也降为 paused 再存（避免时间漂移）
      const toStore: PersistedTimerState = {
        ...snapshot,
        status: snapshot.status === 'paused' ? 'paused' : 'idle',
        updatedAt: Date.now()
      }
      timerStates.value = { ...timerStates.value, [projectId]: toStore }
      await window.api.pomodoro.timerState.save(projectId, toStore)
    } catch (err) {
      console.error('[pomodoro store] persistTimerState failed:', err)
    }
  }

  function projectSettingsById(id: string | null): ProjectTimerOverrides | null {
    if (!id) return null
    return projectSettings.value[id] ?? null
  }

  /**
   * 计算一个项目的「有效时长」：全局 + 项目覆盖 合并。
   * 返回值单位：分钟。
   * - number → 使用
   * - null / undefined → 回退到 base（null 视为已显式清空）
   */
  function effectiveSettings(
    id: string | null,
    fallback?: {
      workDuration: number
      shortBreakDuration: number
      longBreakDuration: number
      longBreakInterval?: number
    }
  ): {
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    longBreakInterval: number
  } {
    const base =
      fallback ??
      (settings.value
        ? {
            workDuration: settings.value.workDuration,
            shortBreakDuration: settings.value.shortBreakDuration,
            longBreakDuration: settings.value.longBreakDuration,
            longBreakInterval: settings.value.longBreakInterval
          }
        : { workDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, longBreakInterval: 4 })
    if (!id) return { ...base, longBreakInterval: base.longBreakInterval ?? 4 }
    const ov = projectSettings.value[id]
    if (!ov) return { ...base, longBreakInterval: base.longBreakInterval ?? 4 }
    return {
      workDuration: ov.workDuration ?? base.workDuration,
      shortBreakDuration: ov.shortBreakDuration ?? base.shortBreakDuration,
      longBreakDuration: ov.longBreakDuration ?? base.longBreakDuration,
      longBreakInterval: ov.longBreakInterval ?? base.longBreakInterval ?? 4
    }
  }

  async function saveProjectOverride(
    projectId: string,
    overrides: ProjectTimerOverrides
  ): Promise<ProjectTimerOverrides> {
    const next = (await window.api.pomodoro.projects.settings.save(
      projectId,
      overrides
    )) as ProjectTimerOverrides
    projectSettings.value = { ...projectSettings.value, [projectId]: next }
    return next
  }

  async function clearProjectOverride(projectId: string): Promise<boolean> {
    const ok = (await window.api.pomodoro.projects.settings.delete(projectId)) as boolean
    if (projectSettings.value[projectId]) {
      const next = { ...projectSettings.value }
      delete next[projectId]
      projectSettings.value = next
    }
    return ok
  }

  async function refreshProjectSettings(): Promise<void> {
    const all = (await window.api.pomodoro.projects.settings.all()) as Record<
      string,
      ProjectTimerOverrides
    >
    projectSettings.value = all || {}
  }

  async function addRecord(
    record: Omit<PomodoroRecord, 'id' | 'date'> & { projectId?: string | null }
  ): Promise<PomodoroRecord | null> {
    const r = (await window.api.pomodoro.addRecord(record)) as PomodoroRecord
    // 刷新今日记录 + 统计（简化策略：完成后整体刷新一次）
    await refreshStats()
    // M8：刷新 streak（依赖 dailyTrend，整体拉一遍 stats）
    void loadStats(statsRange.value).catch(() => {})
    void loadFreeRecords().catch(() => {})
    return r
  }

  async function refreshStats(): Promise<void> {
    const [st, tr] = await Promise.all([
      window.api.pomodoro.getStatistics(),
      window.api.pomodoro.getTodayRecords()
    ])
    statistics.value = st as PomodoroStatistics
    todayRecords.value = (tr as PomodoroRecord[]) || []
  }

  async function saveSettings(partial: Partial<PomodoroSettings>): Promise<void> {
    const next = (await window.api.pomodoro.saveSettings(partial)) as PomodoroSettings | undefined
    // 旧版主进程 saveSettings 返回 void：回退到本地合并，避免 settings 被置空
    settings.value = next ?? ({ ...(settings.value ?? {}), ...partial } as PomodoroSettings)
  }

  function rangeBounds(
    range: StatsRange,
    custom?: { from: number; to: number }
  ): {
    from: number
    to: number
    days: number
  } {
    const now = new Date()
    if (range === 'today') {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { from: start.getTime(), to: now.getTime(), days: 1 }
    }
    if (range === 'week') {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      return { from: start.getTime(), to: now.getTime(), days: 7 }
    }
    if (range === 'month') {
      const start = new Date(now)
      start.setDate(now.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      return { from: start.getTime(), to: now.getTime(), days: 30 }
    }
    if (range === 'custom' && custom) {
      return { from: custom.from, to: custom.to, days: 1 }
    }
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { from: start.getTime(), to: now.getTime(), days: 7 }
  }

  /** M8：从 daily trend 算出 streak。 */
  function computeStreakFromTrend(trend: DailyTrendPoint[]): {
    current: number
    longest: number
    activeToday: boolean
  } {
    if (!Array.isArray(trend) || trend.length === 0) {
      return { current: 0, longest: 0, activeToday: false }
    }
    // DailyTrendPoint.date 是本地时区的 yyyy-mm-dd（主进程 dateOf 同约定）
    const dayKey = (s: string | number): string => {
      if (typeof s === 'number') {
        return localDayKey(new Date(s))
      }
      return (s || '').slice(0, 10)
    }
    // 本地日期部分格式化；不能用 toISOString()（UTC 日期在 UTC+ 时区会差一天）
    const localDayKey = (d: Date): string =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
    const today = new Date()
    const todayKey = localDayKey(today)
    const map = new Map<string, number>()
    for (const t of trend) {
      map.set(dayKey(t.date), (map.get(dayKey(t.date)) ?? 0) + (t.completedPomodoros ?? 0))
    }
    // 当前 streak：从今天往前数，遇到 0 即停（允许"今天还没开始"不算断）
    let current = 0
    // cursor 本身不重新赋值（只调用方法修改内部时间），用 const
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    let firstSkipped = false
    for (let i = 0; i < 365; i += 1) {
      const k = localDayKey(cursor)
      const count = map.get(k) ?? 0
      if (count > 0) {
        current += 1
      } else if (k === todayKey && !firstSkipped) {
        firstSkipped = true
      } else {
        break
      }
      cursor.setDate(cursor.getDate() - 1)
    }
    // 最长 streak：在每日序列里扫描
    let longest = 0
    let run = 0
    const sortedKeys = Array.from(map.keys()).sort()
    for (const k of sortedKeys) {
      if ((map.get(k) ?? 0) > 0) {
        run += 1
        if (run > longest) longest = run
      } else {
        run = 0
      }
    }
    return {
      current,
      longest: Math.max(longest, current),
      activeToday: (map.get(todayKey) ?? 0) > 0
    }
  }

  // 请求序号：快速切换统计区间时丢弃慢到的旧响应，防止旧区间数据覆盖新选中区间
  let loadStatsSeq = 0

  async function loadStats(
    range: StatsRange = statsRange.value,
    custom?: { from: number; to: number }
  ): Promise<void> {
    const seq = ++loadStatsSeq
    statsLoading.value = true
    lastError.value = null
    try {
      statsRange.value = range
      const { from, to, days } = rangeBounds(range, custom)
      const [trend, distribution, heatmap, taskCompletion] = await Promise.all([
        window.api.pomodoro.stats.getDailyTrend(days),
        window.api.pomodoro.stats.getProjectDistribution(from, to),
        window.api.pomodoro.stats.getFocusHeatmap(days),
        window.api.pomodoro.stats.getTaskCompletionStats(from, to)
      ])
      if (seq !== loadStatsSeq) return // 已有更新的请求，丢弃本次结果
      dailyTrend.value = trend as DailyTrendPoint[]
      projectDistribution.value = distribution as ProjectDistributionPoint[]
      focusHeatmap.value = heatmap as HeatmapCell[]
      taskStats.value = taskCompletion as TaskCompletionStats
      // M8：算出 streak 与最佳 streak
      const streakInfo = computeStreakFromTrend(dailyTrend.value)
      streak.value = streakInfo
    } catch (err) {
      if (seq === loadStatsSeq) {
        lastError.value = err instanceof Error ? err.message : String(err)
      }
      console.error('[pomodoro store] loadStats failed:', err)
    } finally {
      if (seq === loadStatsSeq) {
        statsLoading.value = false
      }
    }
  }

  // ─── 集成 actions（P0-4）───

  async function loadFreeRecords(): Promise<void> {
    try {
      freeRecords.value = (await window.api.pomodoro.getFreeRecords()) as PomodoroRecord[]
    } catch (err) {
      console.error('[pomodoro store] loadFreeRecords failed:', err)
    }
  }

  /** M6：按时间范围 / 项目 ID 取 records */
  async function fetchRecordsByRange(
    from: number,
    to: number,
    projectId: string | null = null
  ): Promise<PomodoroRecord[]> {
    return (await window.api.pomodoro.getRecordsByRange({
      from,
      to,
      projectId
    })) as PomodoroRecord[]
  }

  async function loadIntegration(): Promise<void> {
    try {
      const [mode, shortcuts] = await Promise.all([
        window.api.pomodoro.integration.getMode(),
        window.api.pomodoro.integration.getShortcuts()
      ])
      integrationMode.value = mode
      integrationShortcuts.value = shortcuts
    } catch (err) {
      console.error('[pomodoro store] loadIntegration failed:', err)
    }
  }

  async function setIntegrationMode(mode: PomodoroNotificationMode): Promise<void> {
    await window.api.pomodoro.integration.setMode(mode)
    integrationMode.value = mode
  }

  async function testIntegrationNotification(): Promise<void> {
    await window.api.pomodoro.integration.testNotification()
  }

  // M7：专注模式
  async function setFocusMode(enabled: boolean): Promise<void> {
    focusMode.value = enabled
    try {
      await window.api.pomodoro.integration.setFocusMode(enabled)
      // 立即推送一份 snapshot，让 tray / dock 同步标题
      if (traySnapshot.value) {
        await pushTraySnapshot({ focusMode: enabled })
      }
    } catch (err) {
      console.error('[pomodoro store] setFocusMode failed:', err)
    }
  }

  async function loadFocusMode(): Promise<void> {
    try {
      const enabled = await window.api.pomodoro.integration.getFocusMode()
      focusMode.value = !!enabled
    } catch (err) {
      console.error('[pomodoro store] loadFocusMode failed:', err)
    }
  }

  // ─── P2-7：Todoist 任务集成 ───
  const TODOIST_MAP_KEY = 'leaf.todoist-map'
  const todoistMap = ref<Record<string, string>>(loadTodoistMap())

  function loadTodoistMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(TODOIST_MAP_KEY)
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      return {}
    }
  }

  function persistTodoistMap(): void {
    try {
      localStorage.setItem(TODOIST_MAP_KEY, JSON.stringify(todoistMap.value))
    } catch {
      /* 隐私模式等场景忽略 */
    }
  }

  /** 导入 Todoist 活动任务（按标题去重，记录 localTaskId → todoistId 映射） */
  async function importTodoistTasks(): Promise<{ imported: number; error?: string }> {
    const res = await window.api.pomodoro.todoist.importTasks()
    if (!res.ok || !res.tasks) {
      return { imported: 0, error: res.error ?? '导入失败' }
    }
    const existing = new Set(tasks.value.map((t) => t.title))
    let imported = 0
    for (const t of res.tasks) {
      if (existing.has(t.title)) continue
      const task = await addTask(t.title)
      if (task) {
        todoistMap.value[task.id] = t.externalId
        imported += 1
      }
    }
    persistTodoistMap()
    return { imported }
  }

  /** 本地任务完成后回写 Todoist（有映射才同步） */
  async function syncTaskCompleteToTodoist(taskId: string): Promise<void> {
    const externalId = todoistMap.value[taskId]
    if (!externalId) return
    try {
      const res = await window.api.pomodoro.todoist.complete(externalId)
      if (res.ok) {
        delete todoistMap.value[taskId]
        persistTodoistMap()
      } else {
        console.warn('[pomodoro store] todoist complete failed:', res.error)
      }
    } catch (err) {
      console.error('[pomodoro store] todoist complete error:', err)
    }
  }

  async function notifyIntegration(
    event: 'start' | 'break' | 'complete' | 'pause' | 'remind',
    message?: string
  ): Promise<void> {
    try {
      await window.api.pomodoro.integration.notify(event, message)
    } catch (err) {
      console.error('[pomodoro store] notifyIntegration failed:', err)
    }
  }

  async function setIntegrationShortcut(
    action: PomodoroShortcutAction,
    accelerator: string
  ): Promise<{ failed: PomodoroShortcutAction[] }> {
    const result = (await window.api.pomodoro.integration.setShortcut(action, accelerator)) as {
      shortcuts: PomodoroShortcuts
      failed: PomodoroShortcutAction[]
    }
    integrationShortcuts.value = result.shortcuts
    integrationFailedShortcuts.value = result.failed
    return { failed: result.failed }
  }

  async function resetIntegrationShortcuts(): Promise<void> {
    const result = (await window.api.pomodoro.integration.resetShortcuts()) as {
      shortcuts: PomodoroShortcuts
      failed: PomodoroShortcutAction[]
    }
    integrationShortcuts.value = result.shortcuts
    integrationFailedShortcuts.value = result.failed
  }

  async function pushTraySnapshot(patch: Partial<PomodoroTraySnapshot>): Promise<void> {
    const next = (await window.api.pomodoro.integration.updateTraySnapshot(
      patch
    )) as PomodoroTraySnapshot
    traySnapshot.value = next
  }

  /** 监听主进程推送的快捷键事件；返回 unsubscribe 函数。调用方负责在 unmount 时清理 */
  function bindShortcutListener(
    handler: (event: { action: PomodoroShortcutAction }) => void
  ): () => void {
    return window.api.pomodoro.integration.onShortcut(handler)
  }

  /** 监听主进程推送的「切换焦点项目」事件（来自 tray / dock 菜单） */
  function bindFocusProjectListener(handler: (event: { projectId: string }) => void): () => void {
    return window.api.pomodoro.integration.onFocusProject(handler)
  }

  /** 推送项目列表到主进程（用于 tray / dock 菜单渲染切换项） */
  async function pushProjectsToMain(): Promise<void> {
    const list = projects.value.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: false
    }))
    await window.api.pomodoro.integration.updateProjects(list, focusedProjectId.value)
  }

  // ─── P1-1：详情页 ───

  async function openTaskDetail(taskId: string): Promise<void> {
    taskDetailId.value = taskId
    taskDetail.value = null
    selectedRecordId.value = null
    recordDetail.value = null
    taskDetailLoading.value = true
    lastError.value = null
    try {
      const detail = (await window.api.pomodoro.task.detail(taskId)) as PomodoroTaskDetail | null
      if (taskDetailId.value === taskId) {
        taskDetail.value = detail
      }
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err)
      console.error('[pomodoro store] openTaskDetail failed:', err)
    } finally {
      if (taskDetailId.value === taskId) {
        taskDetailLoading.value = false
      }
    }
  }

  function closeTaskDetail(): void {
    taskDetailId.value = null
    taskDetail.value = null
    selectedRecordId.value = null
    recordDetail.value = null
    taskDetailLoading.value = false
  }

  async function loadRecordDetail(recordId: string): Promise<void> {
    selectedRecordId.value = recordId
    recordDetail.value = null
    try {
      const detail = (await window.api.pomodoro.record.get(recordId)) as PomodoroRecordDetail | null
      if (selectedRecordId.value === recordId) {
        recordDetail.value = detail
      }
    } catch (err) {
      console.error('[pomodoro store] loadRecordDetail failed:', err)
    }
  }

  async function saveRecordNote(recordId: string, note: string): Promise<void> {
    try {
      const updated = (await window.api.pomodoro.record.updateNote(
        recordId,
        note
      )) as PomodoroRecord | null
      if (updated && taskDetail.value) {
        taskDetail.value = {
          ...taskDetail.value,
          records: taskDetail.value.records.map((r) => (r.id === recordId ? updated : r))
        }
      }
      if (updated && recordDetail.value?.record.id === recordId) {
        recordDetail.value = { ...recordDetail.value, record: updated }
      }
    } catch (err) {
      console.error('[pomodoro store] saveRecordNote failed:', err)
      throw err
    }
  }

  return {
    // state
    tasks,
    projects,
    records,
    todayRecords,
    statistics,
    settings,
    statsRange,
    dailyTrend,
    projectDistribution,
    focusHeatmap,
    taskStats,
    statsLoading,
    integrationMode,
    integrationShortcuts,
    integrationFailedShortcuts,
    traySnapshot,
    taskDetailId,
    taskDetail,
    taskDetailLoading,
    selectedRecordId,
    recordDetail,
    focusedProjectId,
    projectSettings,
    loading,
    lastError,
    // getters
    todayFocusMinutes,
    completedTasks,
    pendingTasks,
    // actions
    load,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    addProject,
    updateProject,
    deleteProject,
    addRecord,
    refreshStats,
    saveSettings,
    loadStats,
    loadIntegration,
    setIntegrationMode,
    testIntegrationNotification,
    notifyIntegration,
    setIntegrationShortcut,
    resetIntegrationShortcuts,
    pushTraySnapshot,
    bindShortcutListener,
    bindFocusProjectListener,
    pushProjectsToMain,
    openTaskDetail,
    closeTaskDetail,
    loadRecordDetail,
    saveRecordNote,
    // P1-2：多项目并行
    setFocusedProject,
    projectSettingsById,
    effectiveSettings,
    saveProjectOverride,
    clearProjectOverride,
    refreshProjectSettings,
    // M14/M15
    getTimerState,
    persistTimerState,
    timerStates,
    // M8
    streak,
    // M4
    freeRecords,
    loadFreeRecords,
    // M6
    fetchRecordsByRange,
    // M7
    focusMode,
    setFocusMode,
    loadFocusMode,
    // P2-7：Todoist
    todoistMap,
    importTodoistTasks,
    syncTaskCompleteToTodoist
  }
})
