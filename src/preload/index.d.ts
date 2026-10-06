export type { UpdateEvent, UpdateStatus } from '../renderer/src/types/update'
export type { ArchiveInfo } from '../main/db/legacyArchive'
export type { FirstPartyPage } from '../shared/commands'
export type { McpToolArg } from '../shared/mcp'
export type { McpToolCommand } from '../shared/mcp'
export type { McpCallResult } from '../main/services/mcp/client'
export type { PopToRootMode } from '../shared/popToRoot'
export type { WindowInfo as ScreenshotWindowInfo } from '../main/services/windowSources'
export type { Density } from '../shared/density'
export type { CapsuleGlass } from '../shared/capsuleGlass'
export type { BrowserTab } from '../main/services/BrowserTabsService'
export type { AIConfig, AIChatMessage, AIChatSession, AIModelPreset } from '../shared/ai'
export type { ThemeDefinition } from '../shared/themeSchema'
export type {
  DailyTrendPoint,
  HeatmapCell,
  PomodoroAddTaskOptions,
  PomodoroRecord,
  PomodoroSettings,
  PomodoroTask,
  PomodoroUpdateTaskPayload,
  ProjectDistributionPoint,
  ProjectTimerOverrides,
  TaskCompletionStats
} from '../main/stores/PomodoroDataStore'
export type { PomodoroProject } from '../main/db/repos/ProjectRepository'
export type { PersistedTimerState } from '../main/db/repos/PomodoroTimerStateRepository'
export type { Reminder, ReminderFilter } from '../main/db/repos/ReminderRepository'
export type { FolderWithChildren } from '../main/db/repos/FolderRepository'
export type { SnippetImportResult } from '../main/services/SnippetTransferService'
export type { NotificationType, NotificationOptions } from '../main/services/NotificationService'
export type { ClipboardHistoryItem } from '../main/services/ClipboardHistoryService'
export type { Note, NoteFilter, NoteFolder } from '../main/db/repos/NotesRepository'
export type { MainAction } from '../main/launcher/actionHandlers'
export type { SystemInfo as FrondSystemInfo } from '../main/ipc/system'
export type { SystemInfo as HardwareInfoType } from '../main/services/SystemInfoService'

// 渲染端经由 '@preload/index.d' 取用主进程类型（既有惯例），这里转发而不是再抄一份：
// 手抄副本此前已经把 hotkey spec 的 kind 抄成了 string（见 views/launcher/index.vue）
export type { CommandHotkeySpec, HotkeyConfig, HotkeyConflicts } from '../main/launcher/hotkeys'
export type { SyncConfig } from '../main/launcher/sync'

/**
 * 托盘快照（结构镜像 src/main/services/PomodoroIntegrationService.ts 的
 * PomodoroTraySnapshot；不直接 import 该文件，避免把主进程 Electron 侧依赖
 * 拉进 web tsconfig 编译程序）
 */
export interface PomodoroTraySnapshot {
  isRunning: boolean
  currentMode: 'work' | 'shortBreak' | 'longBreak' | null
  taskTitle: string
  timeLeftSeconds: number
  /** 当前模式总时长（秒），供 MiniTimer 计算进度环 */
  totalSeconds?: number
  todayCompleted: number
  projectId: string | null
  projectName: string
  /** M7：专注模式开关（抑制通知 + tray 标记） */
  focusMode?: boolean
  backgroundProjects: Array<{
    id: string
    name: string
    timeLeftSeconds: number
    mode: 'work' | 'shortBreak' | 'longBreak'
  }>
  updatedAt: number
}

export interface Application {
  name: string
  path: string
  icon?: string
  /** 搜索别名（包名 + 本地化显示名，如「谷歌浏览器 / 终端」） */
  aliases?: string[]
}

export interface SnippetContent {
  id: string
  label: string
  value: string
  language: string
  /** 'rich' 时 value 为 HTML 源，全局扩展走剪贴板 text/html 粘贴保留排版 */
  contentType?: 'text' | 'rich' | undefined
}

export interface Snippet {
  id: string
  name: string
  description?: string | undefined
  contents: SnippetContent[]
  /** 文本扩展触发词（M5.1，如 ";brb"）；空 = 不参与全局扩展 */
  trigger?: string | undefined
  folderId?: string | null | undefined
  tagIds: string[]
  isDeleted: boolean
  isFavorites: boolean
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: string
  name: string
  color?: string | null
  /** 六期标签分组：父标签 id（null=顶层） */
  parentId?: string | null
  usageCount?: number
  createdAt: number
}

/** pomodoro.getStatistics 返回的单周期统计（today / week / month 共用结构） */
export interface PomodoroPeriodStats {
  total: number
  work: number
  shortBreak: number
  longBreak: number
}

/** pomodoro.task.detail 返回的任务汇总（main getTaskSummary） */
export interface PomodoroTaskSummary {
  taskId: string
  pomodoroCount: number
  workMs: number
  firstStartedAt: number | null
  lastCompletedAt: number | null
  estimateMs: number | null
  estimateDeviationMs: number | null
}

/** pomodoro.task.detail 返回：任务 + 所属项目 + 记录 + 汇总 */
export interface PomodoroTaskDetail {
  task: PomodoroTask
  project: PomodoroProject | null
  records: PomodoroRecord[]
  summary: PomodoroTaskSummary | null
}

/** pomodoro.task.export 的单条记录载荷 */
export interface PomodoroTaskExportRecord {
  startedAt: number
  endedAt: number
  durationMs: number
  type: 'work' | 'shortBreak' | 'longBreak'
  note: string | null
}

/** pomodoro.task.export 的载荷 */
export interface PomodoroTaskExportPayload {
  title: string
  projectName: string | null
  records: PomodoroTaskExportRecord[]
}

/** pomodoro.record.get 返回：记录 + 关联任务 */
export interface PomodoroRecordDetail {
  record: PomodoroRecord
  task: PomodoroTask | null
}

/**
 * 胶囊侧看到的插件快照。`getPluginState` 的返回值与 `onPluginChanged` 的载荷是**同一份数据**，
 * 之前各写一遍就漂了（一边 headless/attached 必填、一边可选，赋值直接红）。
 * 声明一次，两处引用。
 */
export interface LauncherPluginState {
  open: boolean
  pluginId: string | null
  pluginName: string | null
  subInputPlaceholder: string | null
  declaredList?: unknown
  declaredForm?: unknown
  /** P-2.6：列表加载态 / 空态文案 */
  declaredLoading?: boolean
  declaredEmptyMessage?: string | null
  /** P-2.2：Action 命令 = headless；attached = 视图是否已挂到胶囊窗 */
  headless?: boolean
  attached?: boolean
  /** P-2④ 第二半：插件自己的视图栈（含当前层）与「还有得退吗」 */
  viewDepth?: number
  canGoBack?: boolean
}

/**
 * 截图相关返回信封。
 *
 * `ShotListRes` / `ShotItemRes` / `ShotItemsRes` / `ShotDeleteManyRes` /
 * `ShotUsageRes` / `ShotDirRes` 已删除：它们只服务于 `screenshot.history.*`，
 * 而那组方法指向的通道主进程从未注册过。
 */
export interface ShotWindowListRes {
  success: boolean
  windows: ScreenshotWindowInfo[]
  error?: string
}
export interface ShotWindowCaptureRes {
  success: boolean
  imageUrl?: string
  bounds?: { x: number; y: number; width: number; height: number }
  scaleFactor?: number
  error?: string
}
export interface ShotOkRes {
  success: boolean
  error?: string
}

export interface EditorSettings {
  fontSize: number
  fontFamily: string
  wrap: boolean
  tabSize: number
  matchBrackets: boolean
  highlightLine: boolean
  // Prettier 格式化设置
  semi: boolean
  singleQuote: boolean
  trailingComma: 'none' | 'es5' | 'all'
}

export interface Preferences {
  editor: EditorSettings
  theme: 'light' | 'dark' | 'auto'
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  icon: string | null
  defaultLanguage: string
  isOpen: boolean
  orderIndex: number
  createdAt: number
  updatedAt: number
}

// 两个同名 SystemInfo（系统路径信息 vs 硬件信息）分别来自 system.ts 与
// SystemInfoService.ts：手抄副本已经漂过一次，这里只转发不做第二份定义
export type { BrowserTab } from '../main/services/BrowserTabsService'
export type { SystemInfo } from '../main/ipc/system'
export type { SystemInfo as HardwareInfo } from '../main/services/SystemInfoService'

export interface WindowInfo {
  id: string
  appName: string
  title: string
  pid: number
  icon?: string
}

export interface TrashItem {
  name: string
  path: string
  size: number
  deletedAt?: number
  type: 'file' | 'folder'
}

export interface DictionaryDefinition {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
    }>
  }>
}

export type TelemetryMode = 'off' | 'local' | 'remote'

declare global {
  interface Window {
    // 2026-09-25 起实现为源：API 形状由 preload/index.ts 的 api 对象推导（typeof），
    // 手写 1500 行 API 接口已删 —— 三方手工同步就此消失，parity 测试照常守实现↔调用面
    api: import('./index').FrondPreloadApi
  }
}
