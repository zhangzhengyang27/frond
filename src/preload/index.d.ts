import type { UpdateEvent, UpdateStatus } from '../renderer/src/types/update'
import type { ArchiveInfo } from '../main/db/legacyArchive'
import type { FirstPartyPage } from '../shared/commands'
import type { McpToolArg } from '../shared/mcp'
import type { McpToolCommand } from '../shared/mcp'
import type { McpCallResult } from '../main/services/mcp/client'
import type { PopToRootMode } from '../shared/popToRoot'
import type { WindowInfo as ScreenshotWindowInfo } from '../main/services/windowSources'
import type { Density } from '../shared/density'
import type { CapsuleGlass } from '../shared/capsuleGlass'
import type { BrowserTab } from '../main/services/BrowserTabsService'
import type { AIConfig, AIChatMessage, AIChatSession, AIModelPreset } from '../shared/ai'
import type { ThemeDefinition } from '../shared/themeSchema'
import type {
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
import type { PomodoroProject } from '../main/db/repos/ProjectRepository'
import type { PersistedTimerState } from '../main/db/repos/PomodoroTimerStateRepository'
import type { SyncConfig } from '../main/launcher/sync'
import type { Reminder, ReminderFilter } from '../main/db/repos/ReminderRepository'
import type { HotkeyConfig, HotkeyConflicts, CommandHotkeySpec } from '../main/launcher/hotkeys'
import type { FolderWithChildren } from '../main/db/repos/FolderRepository'
import type { ExportOptions as ClipExportOptions } from '../main/services/ClipService'
import type { SnippetImportResult } from '../main/services/SnippetTransferService'
import type { NotificationType, NotificationOptions } from '../main/services/NotificationService'
import type { ClipboardHistoryItem } from '../main/services/ClipboardHistoryService'
import type {
  notesRepository,
  Note,
  NoteFilter,
  NoteFolder
} from '../main/db/repos/NotesRepository'
import type { focusShield } from '../main/modules/focusShield'
import type { MainAction } from '../main/launcher/actionHandlers'
import type { SystemInfo as FrondSystemInfo } from '../main/ipc/system'
import type { SystemInfo as HardwareInfoType } from '../main/services/SystemInfoService'

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
  contentType?: 'text' | 'rich'
}

export interface Snippet {
  id: string
  name: string
  description?: string
  contents: SnippetContent[]
  /** 文本扩展触发词（M5.1，如 ";brb"）；空 = 不参与全局扩展 */
  trigger?: string
  folderId?: string | null
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

export interface RecordingHistory {
  id: string
  filename: string
  filePath: string
  duration: number
  fileSize: number
  createdAt: number
  thumbnail?: string
}

export interface RecordingSettings {
  encoder: 'vp9' | 'vp8' | 'h264'
  quality: 'low' | 'medium' | 'high' | 'custom'
  bitrate?: number
  fps: 30 | 60
  resolution: {
    width: number
    height: number
  }
  format: 'webm' | 'mp4'
  audioEnabled: boolean
  audioCodec?: 'aac' | 'opus'
  audioBitrate?: number
  /** 系统音频 loopback（设置对话框写入，录制启动时读取） */
  systemAudio?: {
    enabled: boolean
    deviceId?: string
    keepMicrophone?: boolean
  }
  /** 录制全局快捷键开关（落 rec_settings.shortcuts） */
  shortcuts?: {
    enabled: boolean
    start: string
    togglePause: string
  }
  /** 录制前倒计时秒数 */
  countdownSeconds?: 0 | 3 | 5 | 7
  countdownBeep?: boolean
}

export interface Marker {
  id: string
  timestamp: number // 秒
  label: string
  color?: string
  recordingId?: string
}

export interface Clip {
  id: string
  startTime: number
  endTime: number
  label?: string
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

/** 与 IpcContract['recording.list'] 的 req 对齐（枚举漂移时 preload 编译会报） */
type RecordingStatusLiteral = 'recording' | 'paused' | 'completed' | 'failed' | 'recovered'

/** 1.0 录制通道完整类型（独立 interface 让 RecordingHistory.vue 等可单独 import） */
export interface RecordingAPI {
  list: (req?: {
    filter?: {
      status?: RecordingStatusLiteral | Array<RecordingStatusLiteral>
      search?: string
      sinceMs?: number
      untilMs?: number
    }
    limit?: number
    offset?: number
  }) => Promise<{
    items: Array<{
      id: string
      filePath: string
      fileName: string
      durationMs: number
      fileSize: number
      width: number | null
      height: number | null
      fps: number
      hasCamera: boolean
      hasMic: boolean
      hasSystemAudio: boolean
      status: 'recording' | 'paused' | 'completed' | 'failed' | 'recovered'
      quality: 'low' | 'medium' | 'high' | 'source'
      cursorStyle: 'halo' | 'highlight' | 'click-ring' | null
      startedAt: number
      endedAt: number | null
      recoveredAt: number | null
      thumbnailPath: string | null
      description: string | null
    }>
    total: number
  }>
  get: (req: { id: string }) => Promise<{
    recording: {
      id: string
      filePath: string
      fileName: string
      durationMs: number
      fileSize: number
      width: number | null
      height: number | null
      fps: number
      hasCamera: boolean
      hasMic: boolean
      hasSystemAudio: boolean
      status: 'recording' | 'paused' | 'completed' | 'failed' | 'recovered'
      quality: 'low' | 'medium' | 'high' | 'source'
      cursorStyle: 'halo' | 'highlight' | 'click-ring' | null
      startedAt: number
      endedAt: number | null
      recoveredAt: number | null
      thumbnailPath: string | null
      description: string | null
    } | null
  }>
  /** @deprecated 别名：用 list + 过滤 status 替代 */
  deleteOne: (req: { id: string; hard?: boolean; deleteFile?: boolean }) => Promise<{ ok: boolean }>
  remove: (req: { id: string; hard?: boolean; deleteFile?: boolean }) => Promise<{ ok: boolean }>
  settings: {
    get: () => Promise<{
      fps: 30 | 60
      quality: 'low' | 'medium' | 'high' | 'source'
      cursor: 'halo' | 'highlight' | 'click-ring'
      defaultSavePath: string | null
      micDefault: string | null
      systemDefault: string | null
      hasCamera: boolean
      hasMic: boolean
      hasSystemAudio: boolean
    }>
    patch: (req: {
      fps?: 30 | 60
      quality?: 'low' | 'medium' | 'high' | 'source'
      cursor?: 'halo' | 'highlight' | 'click-ring'
      defaultSavePath?: string | null
      micDefault?: string | null
      systemDefault?: string | null
      hasCamera?: boolean
      hasMic?: boolean
      hasSystemAudio?: boolean
    }) => Promise<{
      fps: 30 | 60
      quality: 'low' | 'medium' | 'high' | 'source'
      cursor: 'halo' | 'highlight' | 'click-ring'
      defaultSavePath: string | null
      micDefault: string | null
      systemDefault: string | null
      hasCamera: boolean
      hasMic: boolean
      hasSystemAudio: boolean
    }>
    reset: () => Promise<{
      fps: 30 | 60
      quality: 'low' | 'medium' | 'high' | 'source'
      cursor: 'halo' | 'highlight' | 'click-ring'
      defaultSavePath: string | null
      micDefault: string | null
      systemDefault: string | null
      hasCamera: boolean
      hasMic: boolean
      hasSystemAudio: boolean
    }>
  }
  recovery: {
    scan: () => Promise<{
      orphans: Array<{
        recordingId: string | null
        filePath: string
        fileSize: number
        mtimeMs: number
      }>
    }>
    recover: (req: { filePath: string }) => Promise<{ recordingId: string }>
    discard: (req: { filePath: string }) => Promise<{ ok: boolean }>
  }
  // PR-3: 暂停/恢复分片管理
  start: (req: { fileName: string; defaultSavePath?: string | null }) => Promise<{
    recordingId: string
  }>
  finalize: (req: {
    recordingId: string
    finalFilePath: string
    fileSize: number
    durationMs: number
  }) => Promise<{ ok: boolean }>
  segments: {
    open: (req: { recordingId: string }) => Promise<{
      segmentId: number
      segIndex: number
      startedAt: number
    }>
    close: (req: { recordingId: string; segmentId?: number }) => Promise<{
      ok: boolean
      reason?: 'no open segment'
    }>
    list: (req: { recordingId: string }) => Promise<{
      items: Array<{
        id: number
        segIndex: number
        startedAt: number
        endedAt: number | null
        state: 'committed' | 'discarded'
      }>
    }>
    totalDuration: (req: { recordingId: string; asOf?: number }) => Promise<{
      totalMs: number
    }>
  }
  // PR-4: 区域选择 / 系统音频探测
  region: {
    open: () => Promise<{
      region: { x: number; y: number; width: number; height: number }
    }>
    openForDisplay: (req: { displayId: number }) => Promise<{
      region: { x: number; y: number; width: number; height: number }
      displayId: number
      crossDisplay: boolean
    }>
    openCrossDisplay: () => Promise<{
      region: { x: number; y: number; width: number; height: number }
      displayId: number
      crossDisplay: boolean
    }>
    listDisplays: () => Promise<
      Array<{
        id: number
        bounds: { x: number; y: number; width: number; height: number }
        workArea: { x: number; y: number; width: number; height: number }
        scaleFactor: number
        isPrimary: boolean
      }>
    >
    cancel: () => Promise<{ ok: boolean }>
  }
  systemAudio: {
    probe: (req: { devices: Array<{ kind: string; deviceId: string; label: string }> }) => Promise<{
      available: boolean
      matches: string[]
      recommendedDeviceId?: string
    }>
  }
  cursor: {
    start: () => Promise<{ ok: boolean }>
    stop: () => Promise<{ ok: boolean }>
  }
  // PR-5b + PR-6 + PR-7c: 单录制导出
  export: {
    start: (req: {
      recordingId: string
      sourcePath: string
      outputPath: string
      format: 'mp4' | 'webm' | 'gif'
      resolution: 720 | 1080 | 1440 | 2160
      fps: 30 | 60
      videoBitrateKbps?: number
      audioBitrateKbps?: number
      introPath?: string
      outroPath?: string
      backgroundMusic?: { path: string; volume?: number }
      transition?: 'fade' | 'cut' | 'slide'
      fadeDurationSec?: number
      gifPreset?: 'compact' | 'standard' | 'high'
    }) => Promise<{ jobId: string }>
    cancel: (req: { jobId: string }) => Promise<{ ok: boolean }>
    getInfo: (req: { filePath: string }) => Promise<{
      ok: boolean
      durationSec?: number
      error?: string
    }>
  }
  // PR-7a: pause/resume
  togglePause: () => Promise<{ ok: boolean; paused?: boolean }>
  // PR-7a: 全局快捷键
  shortcut: {
    getConfig: () => Promise<{
      enabled: boolean
      start: string
      togglePause: string
    }>
    setConfig: (req: { enabled?: boolean; start?: string; togglePause?: string }) => Promise<{
      enabled: boolean
      start: string
      togglePause: string
    }>
    registered: () => Promise<{ accels: string[] }>
    attach: () => Promise<{ ok: boolean }>
    detach: () => Promise<{ ok: boolean }>
  }
  // PR-7b: 倒计时
  countdown: {
    start: (req: {
      seconds: number
      reason: 'recording'
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    cancel: () => Promise<{ ok: true }>
  }
}
