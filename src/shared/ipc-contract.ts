/**
 * Leaf · IPC 登记册（typed subset，已接线的部分参与编译期约束）
 *
 * - **key 就是通道原文**（既有 `recording.list` 这种点号命名，也有 `marker:addMarker`、
 *   `update:check` 这种冒号命名 —— 反映真实通道，不做统一改写）
 * - 约定：一个通道一个 `req` 对象（无入参写 void），返回类型即 `res`
 * - 已登记通道的强制接线点：主进程 `src/main/ipc/typedIpc.ts` 的 typedHandle、
 *   preload 的 typedInvoke —— 没登记或形状不符，编译期就红
 * - 覆盖面：391 条 / preload 实际使用的 415 个通道，按家族推进；
 *   src/main/__tests__/ipcContract.test.ts 断言每条 key 都是真实通道、
 *   已登记通道不得再被裸 ipcRenderer.invoke 调用、条目数只增不减
 * - 类型来源：res 尽量用 `ReturnType<typeof 真实函数>` 或仓库层导出的类型派生，
 *   而不是在这里手抄一份——手抄副本此前已经把 hotkey spec 的 kind 抄成了 string
 * - 引用主进程类型时的一个坑：只能引「不带 electron/资源依赖」的模块。
 *   `import type` 同样会把被引模块编进 web 程序（typecheck:web），曾因此报
 *   `resources/icon.png?asset` 找不到（已在 src/renderer/src/env.d.ts 补声明兜住）
 */
import type { Marker } from '../main/services/MarkerService'
import type { EditorSettings, Preferences } from '../main/stores/PreferencesDataStore'
import type { PopToRootMode } from './popToRoot'
import type { Density } from './density'
import type { CapsuleGlass } from './capsuleGlass'
import type { TelemetryMode } from './types'
import type { RecordingStatus as RepoRecordingStatus } from '../main/db/repos/RecordingRepository'
import type { ThemeDefinition } from './themeSchema'
import type { UserThemeRejection } from '../main/modules/userThemes'
import type { UpdateStatus } from '../renderer/src/types/update'
import type {
  PomodoroAddTaskOptions,
  PomodoroUpdateTaskPayload,
  PomodoroRecord,
  PomodoroSettings,
  PomodoroTask,
  DailyTrendPoint,
  ProjectDistributionPoint,
  HeatmapCell,
  TaskCompletionStats,
  ProjectTimerOverrides,
  PomodoroDataStore
} from '../main/stores/PomodoroDataStore'
import type { PomodoroStatistics } from '../main/db/repos/PomodoroRepository'
import type { PomodoroProject } from '../main/db/repos/ProjectRepository'
import type { PersistedTimerState } from '../main/db/repos/PomodoroTimerStateRepository'
import type {
  PomodoroNotificationMode,
  PomodoroShortcutAction,
  PomodoroShortcuts,
  PomodoroTraySnapshot
} from './pomodoroIntegration'
import type { InstalledPlugin } from '../main/launcher/pluginStore'
import type { PermissionId, PermissionState, PermissionStatus } from '../main/ipc/permissions'
import type { AutomationTaskView } from '../shared/automation'
import type { McpCallResult, McpServerView } from '../main/services/mcp/client'
import type { FrontmostContext } from '../main/utils/screenAwareness'
import type { McpToolCommand } from './mcp'
import type { McpOverview, McpServerPublic } from '../main/services/mcp/store'
import type {
  MarketItem,
  installFromMarket,
  marketIndexInfo,
  refreshRemoteIndex
} from '../main/launcher/market'
import type {
  DevPluginInfo,
  addDevPlugin,
  setDevAutoReload,
  reloadDevPlugin
} from '../main/launcher/devPlugins'
import type { HyperKeyConfig } from '../main/modules/hyperKey'
import type { HotkeyConfig, HotkeyConflicts, CommandHotkeySpec } from '../main/launcher/hotkeys'
import type { ExpansionConfig } from '../main/modules/textExpansion'
import type { probeGlobalKeys } from '../main/modules/globalKeys'
import type { PluginListItem, ParsedPluginForm } from './plugin-protocol'
import type { PluginSearchItemStored } from '../main/launcher/pluginSearchIndex'
import type { dispatchMainAction, MainAction } from '../main/launcher/actionHandlers'
import type {
  getPluginPreference,
  listPluginPreferences,
  setPluginPreference,
  setDeclaredList,
  clearDeclaredList,
  setDeclaredView,
  submitPluginFormValues,
  runPluginCallback,
  proxyPluginFetch,
  getContextBySender
} from '../main/launcher/runtime'
import type { fileIndex } from '../main/modules/fileIndex/service'
import type { SyncConfig, testConnection } from '../main/launcher/sync'
import type { TagDataStore } from '../main/stores/TagDataStore'
import type { reminderService } from '../main/services/ReminderService'
import type { ReminderFilter } from '../main/db/repos/ReminderRepository'
import type { notesRepository, NoteFilter } from '../main/db/repos/NotesRepository'
import type { SnippetFilter } from '../main/db/repos/SnippetRepository'
import type { SnippetDataStore } from '../main/stores/SnippetDataStore'
import type { FolderDataStore } from '../main/stores/FolderDataStore'
import type {
  RecordingHistoryService,
  RecordingHistory
} from '../main/services/RecordingHistoryService'
import type { SystemInfo as LeafSystemInfo } from '../main/ipc/system'
import type { SystemInfo as HardwareInfo } from '../main/services/SystemInfoService'
import type { NotificationType, NotificationOptions } from '../main/services/NotificationService'
import type {
  clipboardHistory,
  ClipboardHistoryItem
} from '../main/services/ClipboardHistoryService'
import type { focusShield } from '../main/modules/focusShield'
import type { screenshotIndexService } from '../main/services/ScreenshotIndexService'
import type {
  RecordingSettingsDataStore,
  QUALITY_PRESETS
} from '../main/stores/RecordingSettingsDataStore'
import type {
  ClipService,
  Clip,
  ExportOptions as ClipExportOptions
} from '../main/services/ClipService'
import type { SnippetImportResult } from '../main/services/SnippetTransferService'
import type { Quicklink } from './commands'
import type { AIConfig, AIChatMessage, AIChatSession, AIModelPreset } from './ai'
import type { ArchiveInfo } from '../main/db/legacyArchive'
import type { listCloudBackups, backupFullDb, restoreFullDb } from '../main/launcher/cloudBackup'
import type { dataSyncStatus, pushDataSync, pullDataSync } from '../main/launcher/dataSync'
import type { calendarService } from '../main/services/CalendarService'
import type { TrashItem } from '../main/services/TrashService'
import type {
  getAliases,
  getAliasesForCommand,
  setAlias,
  removeAlias
} from '../main/services/AliasService'
import type { AppEntry } from '../main/ipc/applications'
import type { FileSearchOptions } from '../main/modules/fileSearch'
import type { BrowserTab } from '../main/services/BrowserTabsService'
import type { DictionaryDefinition } from '../main/services/DictionaryService'
import type { WindowInfo } from '../main/services/WindowSwitcherService'
import type { RegionSelection } from '../main/services/recording/RegionOverlay'

/** 插件运行上下文（plugapi:getContext 的字段从这里派生，避免第二次定义形状） */
type PluginCtx = NonNullable<ReturnType<typeof getContextBySender>>
/** 质量预设的键（'low' | 'medium' | 'high'，取自 QUALITY_PRESETS 本身） */
type QualityKey = keyof typeof QUALITY_PRESETS
/** 同步备份/恢复同形返回 */
type SyncRunResult = { ok: boolean; count?: number; error?: string }

export interface IpcContract {
  // ─────────── 偏好（preferences:*，2026-09-19 起统一单对象入参）───────────
  // 约定：每个通道一个 req 对象；无入参写 void。preload 对渲染端仍暴露原 JS 签名
  // （如 setTheme('dark')），折算发生在那一层，所以渲染端与插件面不受影响。
  'preferences:getTheme': { req: void; res: ThemeChoice }
  'preferences:setTheme': { req: { theme: ThemeChoice }; res: void }
  'preferences:getPreferences': { req: void; res: Preferences }
  'preferences:getEditorSettings': { req: void; res: EditorSettings }
  'preferences:updateEditorSettings': {
    req: Partial<EditorSettings>
    res: EditorSettings
  }
  'preferences:isOnboardingCompleted': { req: void; res: boolean }
  'preferences:setOnboardingCompleted': { req: void; res: void }
  'preferences:resetOnboarding': { req: void; res: void }
  'preferences:getFavoriteModules': { req: void; res: string[] }
  'preferences:setFavoriteModules': { req: { ids: string[] }; res: void }
  'preferences:getFallbackDisabled': { req: void; res: string[] }
  'preferences:setFallbackDisabled': { req: { ids: string[] }; res: void }
  'preferences:getFallbackOrder': { req: void; res: string[] }
  'preferences:setFallbackOrder': { req: { ids: string[] }; res: void }
  'preferences:getPopToRootMode': { req: void; res: PopToRootMode }
  'preferences:setPopToRootMode': { req: { mode: PopToRootMode }; res: void }
  'preferences:getWindowGap': { req: void; res: number }
  'preferences:setWindowGap': { req: { px: number }; res: void }
  /** 列表密度档（P-6 Compact Mode）：主进程只认两个值，非法回落 comfortable */
  'preferences:getDensity': { req: void; res: Density }
  'preferences:setDensity': { req: { density: string }; res: Density }
  /** 胶囊玻璃档（P-6）：opaque 是默认，等于不覆盖任何 token */
  'preferences:getCapsuleGlass': { req: void; res: CapsuleGlass }
  'preferences:setCapsuleGlass': { req: { glass: string }; res: CapsuleGlass }
  'capsule-glass:changed': { req: CapsuleGlass; res: void }
  /** 主进程 → 各窗口：密度档变了（与 theme:changed 同形） */
  'density:changed': { req: Density; res: void }
  /** 紧凑模式（P-6⑤）：空查询时把胶囊收成一条栏，默认关 */
  'preferences:getCompactMode': { req: void; res: boolean }
  'preferences:setCompactMode': { req: { enabled: boolean }; res: boolean }
  'compact-mode:changed': { req: boolean; res: void }
  /** 渲染端 → 主进程：当前该不该收成一条栏（高度由渲染端量来，主进程夹一次） */
  'launcher:setCompact': { req: { compact: boolean; height: number }; res: void }
  'preferences:getAutoJoinEnabled': { req: void; res: boolean }
  'preferences:setAutoJoinEnabled': { req: { enabled: boolean }; res: void }

  // ─────────── 用户主题文件（#12 Phase 2）───────────
  'userTheme:list': {
    req: void
    res: {
      active: string
      themes: ThemeDefinition[]
      rejected: UserThemeRejection[]
      dir: string
    }
  }
  'userTheme:setActive': {
    req: { id: string }
    res: { ok: boolean; active?: string; error?: string }
  }
  'userTheme:install': {
    req: void
    res: { ok: boolean; theme?: ThemeDefinition; canceled?: boolean; error?: string }
  }
  'userTheme:openDir': { req: void; res: { ok: boolean } }

  // Prettier 格式化（req 原本就是 {text, parser} 对象，符合约定）
  'prettier:format': { req: { text: string; parser: string }; res: string }

  // ─────────── 日志（真实通道是 log:export，返回落地路径或 null）───────────
  'log:export': {
    req: void
    res: string | null
  }

  // ─────────── 自动更新（真实通道 update:*，不是 updater.*）───────────
  'update:check': { req: void; res: UpdateStatus }
  'update:download': { req: void; res: void }
  'update:install': { req: void; res: void }

  // ─────────── 录制（1.0 新通道；基于 SQLite repos；旧 recording-history:* / recording-settings:* /
  //                   screen-recorder:* 暂保留 6 个月，见 docs/modules/07-screen-recorder.md）───────────
  'recording.list': {
    req: {
      filter?: {
        status?: RecordingStatus | RecordingStatus[]
        search?: string
        sinceMs?: number
        untilMs?: number
      }
      limit?: number
      offset?: number
    }
    res: { items: RecordingSummary[]; total: number }
  }
  'recording.get': {
    req: { id: string }
    res: { recording: RecordingSummary | null }
  }
  'recording.delete': {
    req: { id: string; hard?: boolean; deleteFile?: boolean }
    res: { ok: boolean }
  }
  // ─────────── 标记（marker:*，2026-09-19 起单对象入参）───────────
  'marker:addMarker': {
    req: { recordingId: string; timestamp: number; label?: string }
    res: Marker
  }
  'marker:getMarkers': { req: { recordingId: string }; res: Marker[] }
  'marker:updateMarker': {
    req: { recordingId: string; markerId: string; updates: Partial<Marker> }
    res: Marker | null
  }
  'marker:removeMarker': { req: { recordingId: string; markerId: string }; res: boolean }
  'marker:clearMarkers': { req: { recordingId: string }; res: void }
  'marker:exportToCSV': { req: { recordingId: string }; res: string }

  // ─────────── 日志与遥测（log:*）───────────
  'log:getMode': { req: void; res: TelemetryMode }
  'log:setMode': { req: { mode: TelemetryMode }; res: TelemetryMode }

  // ─────────── 自动更新其余通道（update:*）───────────
  'update:getStatus': { req: void; res: UpdateStatus }
  'update:getCurrentVersion': { req: void; res: string }
  'recording.settings.get': {
    req: void
    res: RecordingDefaultSettings
  }
  'recording.settings.patch': {
    req: Partial<RecordingDefaultSettings>
    res: RecordingDefaultSettings
  }
  'recording.settings.reset': {
    req: void
    res: RecordingDefaultSettings
  }
  'recording.recovery.scan': {
    req: void
    res: {
      orphans: Array<{
        recordingId: string | null
        filePath: string
        fileSize: number
        mtimeMs: number
      }>
    }
  }
  'recording.recovery.recover': {
    req: { filePath: string }
    res: { recordingId: string }
  }
  'recording.recovery.discard': {
    req: { filePath: string }
    res: { ok: boolean }
  }
  // ── PR-3: 暂停/恢复段管理 ─────────────────────────────────────
  'recording.start': {
    req: { fileName: string; defaultSavePath?: string | null }
    res: { recordingId: string }
  }
  'recording.finalize': {
    req: {
      recordingId: string
      finalFilePath: string
      fileSize: number
      durationMs: number
    }
    res: { ok: boolean }
  }
  'recording.segments.open': {
    req: { recordingId: string }
    res: { segmentId: number; segIndex: number; startedAt: number }
  }
  'recording.segments.close': {
    req: { recordingId: string; segmentId?: number }
    res: { ok: boolean; reason?: 'no open segment' }
  }
  'recording.segments.list': {
    req: { recordingId: string }
    res: {
      items: Array<{
        id: number
        segIndex: number
        startedAt: number
        endedAt: number | null
        state: 'committed' | 'discarded'
      }>
    }
  }
  'recording.segments.totalDuration': {
    req: { recordingId: string; asOf?: number }
    res: { totalMs: number }
  }
  // ── PR-4: 区域选择 / 系统音频探测 ─────────────────────────────
  'recording.region.open': {
    req: void
    res: { region: { x: number; y: number; width: number; height: number } }
  }
  'recording.region.openForDisplay': {
    req: { displayId: number }
    res: {
      region: { x: number; y: number; width: number; height: number }
      displayId: number
      crossDisplay: boolean
    }
  }
  'recording.region.openCrossDisplay': {
    req: void
    res: {
      region: { x: number; y: number; width: number; height: number }
      displayId: number
      crossDisplay: boolean
    }
  }
  'recording.region.listDisplays': {
    req: void
    res: Array<{
      id: number
      bounds: { x: number; y: number; width: number; height: number }
      workArea: { x: number; y: number; width: number; height: number }
      scaleFactor: number
      isPrimary: boolean
    }>
  }
  'recording.region.cancel': {
    req: void
    res: { ok: boolean }
  }
  'recording.systemAudio.probe': {
    req: {
      devices: Array<{ kind: string; deviceId: string; label: string }>
    }
    res: {
      available: boolean
      matches: string[]
      recommendedDeviceId?: string
    }
  }
  // cursor 位置通过 webContents.send 单向推送：
  //   'cursor:position' { x, y }
  //   'cursor:stop' void
  'recording.cursor.start': {
    req: void
    res: { ok: boolean }
  }
  'recording.cursor.stop': {
    req: void
    res: { ok: boolean }
  }
  // PR-5b: 单录制导出（转码）
  'recording.export.start': {
    req: {
      recordingId: string
      sourcePath: string
      outputPath: string
      format: 'mp4' | 'webm' | 'gif'
      resolution: 720 | 1080 | 1440 | 2160
      fps: 30 | 60
      videoBitrateKbps?: number
      audioBitrateKbps?: number
      // PR-6
      introPath?: string
      outroPath?: string
      backgroundMusic?: { path: string; volume?: number }
      transition?: 'fade' | 'cut' | 'slide'
      fadeDurationSec?: number
      // PR-7c
      gifPreset?: 'compact' | 'standard' | 'high'
    }
    res: { jobId: string }
  }
  'recording.export.cancel': {
    req: { jobId: string }
    res: { ok: boolean }
  }
  'recording.export.getInfo': {
    req: { filePath: string }
    res: {
      ok: boolean
      durationSec?: number
      width?: number
      height?: number
      error?: string
    }
  }
  // PR-7a: 全局快捷键
  'recording.shortcut.getConfig': {
    req: void
    res: {
      enabled: boolean
      start: string
      togglePause: string
    }
  }
  'recording.shortcut.setConfig': {
    req: {
      enabled?: boolean
      start?: string
      togglePause?: string
    }
    res: {
      enabled: boolean
      start: string
      togglePause: string
    }
  }
  'recording.shortcut.registered': {
    req: void
    res: { accels: string[] }
  }
  'recording.shortcut.attach': {
    req: void
    res: { ok: boolean }
  }
  'recording.shortcut.detach': {
    req: void
    res: { ok: boolean }
  }
  // PR-7a: pause/resume toggle（由全局快捷键 togglePause 触发）
  'recording.togglePause': {
    req: void
    res: { ok: boolean; paused?: boolean }
  }
  // PR-7b: 倒计时
  'recording.countdown.start': {
    req: { seconds: number; reason: 'recording' }
    res: { ok: true } | { ok: false; error: string }
  }
  'recording.countdown.cancel': {
    req: void
    res: { ok: true }
  }

  // ─────────── 番茄钟（pomodoro:*，2026-09-19 起单对象入参）───────────
  // 原先是位置参数（如 addTask(title, options)）；req 折成对象后，preload 那层仍对
  // 渲染端暴露原 JS 签名，折算在 preload 内完成。res 类型与 d.ts 既有声明一致。
  'pomodoro:getTasks': { req: void; res: PomodoroTask[] }
  'pomodoro:addTask': {
    req: { title: string; options?: PomodoroAddTaskOptions }
    res: PomodoroTask
  }
  'pomodoro:updateTask': {
    req: { id: string; updates: PomodoroUpdateTaskPayload }
    res: PomodoroTask | null
  }
  'pomodoro:deleteTask': { req: { id: string }; res: boolean }
  'pomodoro:completeTask': { req: { id: string }; res: PomodoroTask | null }
  /** summary 从 store 返回类型派生：这里抄一份的话 store 加字段不会报错 */
  'pomodoro:task:detail': {
    req: { taskId: string }
    res: {
      task: PomodoroTask
      project: PomodoroProject | null
      records: PomodoroRecord[]
      summary: ReturnType<PomodoroDataStore['getTaskSummary']>
    } | null
  }
  'pomodoro:task:export': {
    req: {
      format: 'csv' | 'markdown'
      fileBaseName: string
      payload: {
        title: string
        projectName: string | null
        records: Array<{
          startedAt: number
          endedAt: number
          durationMs: number
          type: 'work' | 'shortBreak' | 'longBreak'
          note: string | null
        }>
      }
    }
    res: { ok: boolean; canceled: boolean; path: string | null; error?: string }
  }
  'pomodoro:projects:getAll': { req: void; res: PomodoroProject[] }
  'pomodoro:projects:add': { req: { name: string; color?: string }; res: PomodoroProject }
  'pomodoro:projects:update': {
    req: { id: string; updates: { name?: string; color?: string; sortOrder?: number } }
    res: PomodoroProject | null
  }
  'pomodoro:projects:delete': { req: { id: string }; res: boolean }
  'pomodoro:projects:settings:get': {
    req: { projectId: string }
    res: ProjectTimerOverrides | null
  }
  'pomodoro:projects:settings:all': { req: void; res: Record<string, ProjectTimerOverrides> }
  'pomodoro:projects:settings:save': {
    req: { projectId: string; overrides: ProjectTimerOverrides }
    res: ProjectTimerOverrides
  }
  'pomodoro:projects:settings:delete': { req: { projectId: string }; res: boolean }
  'pomodoro:timerState:getAll': { req: void; res: Record<string, PersistedTimerState> }
  'pomodoro:timerState:get': { req: { projectId: string }; res: PersistedTimerState | null }
  'pomodoro:timerState:save': {
    req: { projectId: string; state: PersistedTimerState }
    res: void
  }
  'pomodoro:timerState:delete': { req: { projectId: string }; res: boolean }
  'pomodoro:addRecord': {
    req: { record: Omit<PomodoroRecord, 'id' | 'date'> }
    res: PomodoroRecord
  }
  'pomodoro:getRecords': { req: void; res: PomodoroRecord[] }
  'pomodoro:getTodayRecords': { req: void; res: PomodoroRecord[] }
  'pomodoro:getFreeRecords': { req: void; res: PomodoroRecord[] }
  'pomodoro:getRecordsByRange': {
    req: { from: number; to: number; projectId?: string | null }
    res: PomodoroRecord[]
  }
  'pomodoro:getThisWeekRecords': { req: void; res: PomodoroRecord[] }
  'pomodoro:getThisMonthRecords': { req: void; res: PomodoroRecord[] }
  'pomodoro:getStatistics': { req: void; res: PomodoroStatistics }
  'pomodoro:getSettings': { req: void; res: PomodoroSettings }
  'pomodoro:saveSettings': {
    req: { settings: Partial<PomodoroSettings> }
    res: PomodoroSettings
  }
  'pomodoro:record:get': {
    req: { id: string }
    res: NonNullable<ReturnType<PomodoroDataStore['getRecordDetail']>> | null
  }
  'pomodoro:record:updateNote': {
    req: { id: string; note: string }
    res: PomodoroRecord | null
  }
  'pomodoro:stats:dailyTrend': {
    req: { days: number; endDate?: number }
    res: DailyTrendPoint[]
  }
  'pomodoro:stats:projectDistribution': {
    req: { from: number; to: number }
    res: ProjectDistributionPoint[]
  }
  'pomodoro:stats:focusHeatmap': {
    req: { days: number; endDate?: number }
    res: HeatmapCell[]
  }
  'pomodoro:stats:taskCompletionStats': {
    req: { from: number; to: number }
    res: TaskCompletionStats
  }
  'pomodoro:todoist:getToken': { req: void; res: string }
  'pomodoro:todoist:setToken': { req: { token: string }; res: { ok: boolean } }
  'pomodoro:todoist:import': {
    req: void
    res: {
      ok: boolean
      error?: string
      tasks?: Array<{ externalId: string; title: string }>
    }
  }
  'pomodoro:todoist:complete': {
    req: { externalId: string }
    res: { ok: boolean; error?: string }
  }
  'pomodoro:integration:getMode': { req: void; res: PomodoroNotificationMode }
  'pomodoro:integration:setMode': {
    req: { mode: PomodoroNotificationMode }
    res: PomodoroNotificationMode
  }
  'pomodoro:integration:testNotification': { req: void; res: void }
  'pomodoro:integration:notify': {
    /** 事件枚举内联：主服务里同样是内联联合类型，不在这里另立同义定义 */
    req: { event: 'start' | 'break' | 'complete' | 'pause' | 'remind'; message?: string }
    res: number | null
  }
  'pomodoro:integration:getShortcuts': { req: void; res: PomodoroShortcuts }
  'pomodoro:integration:setShortcut': {
    req: { action: PomodoroShortcutAction; accelerator: string }
    res: { shortcuts: PomodoroShortcuts; failed: string[] }
  }
  'pomodoro:integration:resetShortcuts': {
    req: void
    res: { shortcuts: PomodoroShortcuts; failed: string[] }
  }
  'pomodoro:integration:updateTraySnapshot': {
    req: { patch: Partial<PomodoroTraySnapshot> }
    res: PomodoroTraySnapshot
  }
  'pomodoro:integration:getTraySnapshot': { req: void; res: PomodoroTraySnapshot }
  'pomodoro:integration:describeTraySnapshot': {
    req: void
    res: { primary: string; secondary: string }
  }
  'pomodoro:integration:setFocusMode': {
    req: { enabled: boolean }
    res: PomodoroTraySnapshot
  }
  'pomodoro:integration:getFocusMode': { req: void; res: boolean }
  'pomodoro:integration:updateProjects': {
    req: {
      projects: Array<{ id: string; name: string; isActive: boolean }>
      focusedProjectId: string | null
    }
    res: { ok: boolean }
  }

  // ─────────── 启动器（launcher:* / plugapi:* / fileIndex:* / action:invoke）───────────
  // res 尽量写成 ReturnType<typeof 真实函数>：这些通道的返回值就是仓库/服务层的返回类型，
  // 在登记册里再抄一份只会造出第二个真相（pomodoro 家族已验证编译器能抓到这种漂移）。
  'launcher:listPlugins': { req: void; res: InstalledPlugin[] }
  'launcher:perf': { req: void; res: { lastShowLatencyMs: number } }
  /** P-1.3 keep-open：钉住时失焦不隐藏（会话级，窗口销毁复位） */
  'launcher:setPinned': { req: { pinned: boolean }; res: { pinned: boolean } }
  /** 应用包元数据（只认绝对路径下的 .app，见 main/ipc/applications.ts） */
  'applications:readInfo': {
    req: { appPath: string }
    res: {
      bundleId: string | null
      version: string | null
      buildVersion: string | null
      executable: string | null
      modifiedMs: number | null
    }
  }
  'launcher:installFromFolder': {
    req: { dirPath: string }
    res: { success: boolean; plugin?: InstalledPlugin; error?: string }
  }
  'launcher:market:list': { req: void; res: MarketItem[] }
  /** 索引来源与新鲜度（打包索引路径 / 远程地址 / 上次拉取时间 / 被挡条目） */
  'launcher:market:indexInfo': {
    req: void
    res: ReturnType<typeof marketIndexInfo>
  }
  'launcher:market:setIndexUrl': {
    req: { url: string }
    res: { ok: boolean; error?: string }
  }
  'launcher:market:refreshIndex': {
    req: void
    res: Awaited<ReturnType<typeof refreshRemoteIndex>>
  }
  'launcher:market:install': {
    req: { entryId: string }
    res: Awaited<ReturnType<typeof installFromMarket>>
  }
  'launcher:market:update': {
    req: { entryId: string }
    res: Awaited<ReturnType<typeof installFromMarket>>
  }
  'launcher:devPlugins:list': { req: void; res: DevPluginInfo[] }
  'launcher:devPlugins:add': {
    req: { dirPath: string }
    res: { ok: false; error: string } | Awaited<ReturnType<typeof addDevPlugin>>
  }
  'launcher:devPlugins:remove': {
    req: { pluginId: string }
    res: { ok: boolean; error?: string }
  }
  'launcher:devPlugins:setAutoReload': {
    req: { pluginId: string; autoReload: boolean }
    res: Awaited<ReturnType<typeof setDevAutoReload>>
  }
  'launcher:devPlugins:reload': {
    req: { pluginId: string }
    res: Awaited<ReturnType<typeof reloadDevPlugin>>
  }
  'launcher:hyperkey:getConfig': { req: void; res: HyperKeyConfig }
  'launcher:hyperkey:setEnabled': {
    req: { enabled: boolean }
    res: { ok: boolean; config: HyperKeyConfig; error?: string }
  }
  'launcher:hyperkey:setQuickPress': {
    /** 任意输入都被 normalizeQuickPress 收敛，故 req 侧不做类型承诺 */
    req: { action: unknown }
    res: { ok: true; config: HyperKeyConfig }
  }
  'launcher:pluginDevtools': {
    req: { pluginId: string }
    res: { success: boolean; error?: string }
  }
  'launcher:removePlugin': { req: { pluginId: string }; res: { success: boolean; error?: string } }
  'launcher:getPluginState': {
    req: void
    res: {
      open: boolean
      pluginId: string | null
      pluginName: string | null
      subInputPlaceholder: string | null
      declaredList: PluginListItem[] | null
      declaredForm: ParsedPluginForm | null
      /** P-2.6：列表加载态 / 空态文案（Raycast isLoading / emptyView 语义） */
      declaredLoading: boolean
      declaredEmptyMessage: string | null
      /** P-2.2：该命令是否声明为无界面 Action；attached = 视图是否已挂到胶囊窗 */
      headless: boolean
      attached: boolean
    }
  }
  'launcher:setPluginEnabled': {
    req: { pluginId: string; enabled: boolean }
    res: { success: boolean; plugin?: InstalledPlugin }
  }
  'launcher:selectPluginFolder': {
    req: void
    res: { success: boolean; canceled?: boolean; dirPath?: string }
  }
  'launcher:hotkeys:getConfig': { req: void; res: HotkeyConfig }
  'launcher:hotkeys:getConflicts': { req: void; res: HotkeyConflicts }
  'launcher:hotkeys:setMain': {
    req: { accelerator: string }
    res: { ok: boolean; error?: string; config?: HotkeyConfig }
  }
  'launcher:hotkeys:setCommand': {
    req: { accelerator: string; spec: CommandHotkeySpec | null }
    res: { ok: true; config: HotkeyConfig; registered: string[] }
  }
  'launcher:hotkeys:setChord': {
    req: { letter: string; spec: CommandHotkeySpec | null }
    res: { ok: boolean; error?: string; config?: HotkeyConfig }
  }
  'action:invoke': {
    /** 主进程仍按未信任输入校验（createDispatchMainAction 逐字段判型），这里声明的是调用方该发的形状 */
    req: { action: MainAction }
    res: Awaited<ReturnType<typeof dispatchMainAction>>
  }
  'launcher:pluginSearchItems:list': { req: void; res: PluginSearchItemStored[] }
  'fileIndex:status': { req: void; res: ReturnType<typeof fileIndex.getStatus> }
  'fileIndex:addScope': {
    req: void
    res: { ok: boolean; canceled?: boolean; scopes?: string[] }
  }
  'fileIndex:removeScope': { req: { dir: string }; res: { ok: true; scopes: string[] } }
  'fileIndex:rebuild': { req: void; res: { ok: true } }
  'fileIndex:setHidden': { req: { value: boolean }; res: void }
  'launcher:expansion:getConfig': {
    req: void
    res: ExpansionConfig & { triggerCount: number; hookAvailable: boolean }
  }
  'launcher:expansion:setConfig': {
    req: { patch: Partial<ExpansionConfig> }
    res: ExpansionConfig
  }
  'launcher:expansion:probe': {
    req: void
    res: Awaited<ReturnType<typeof probeGlobalKeys>> & { hookAvailable: boolean }
  }
  'launcher:getPreference': {
    req: { pluginId: string; name: string }
    res: ReturnType<typeof getPluginPreference>
  }
  'launcher:setPreference': {
    req: { pluginId: string; name: string; value: unknown }
    res: ReturnType<typeof setPluginPreference>
  }
  // ── 插件受控面（plugapi:*：preload/plugin.ts 暴露给插件，按 sender 解析身份）──
  'plugapi:submitSearchItems': {
    req: { items: unknown }
    res: { ok: boolean; error?: string }
  }
  'plugapi:getPreference': {
    req: { name: string }
    res: ReturnType<typeof getPluginPreference> | { ok: false; error: string }
  }
  'plugapi:setPreference': {
    req: { name: string; value: unknown }
    res: ReturnType<typeof setPluginPreference> | { ok: false; error: string }
  }
  'plugapi:fetch': {
    req: {
      url: string
      init?: { method?: string; headers?: Record<string, string>; body?: string }
    }
    res: Awaited<ReturnType<typeof proxyPluginFetch>> | { ok: false; error: string }
  }
  /** push = 「我进下一层」（栈里留住当前层）；不带就是当前层重绘。id 是渲染端的稳定 key */
  'plugapi:renderList': {
    req: { items: unknown; push: boolean; id: string }
    res: ReturnType<typeof setDeclaredList>
  }
  /** 插件退一层（P-2④ 第二半）。depth = 退完剩下的栈深；第一层退不动，交给胶囊关插件 */
  'plugapi:popView': {
    req: void
    res: { ok: boolean; depth: number; error?: string }
  }
  'plugapi:clearList': { req: void; res: ReturnType<typeof clearDeclaredList> }
  'plugapi:renderView': { req: { view: unknown }; res: ReturnType<typeof setDeclaredView> }
  'plugapi:getContext': {
    req: void
    res: {
      pluginId: PluginCtx['plugin']['id']
      name: PluginCtx['plugin']['name']
      cmd: PluginCtx['cmd']
      args: PluginCtx['args']
    } | null
  }
  'plugapi:setExpandHeight': { req: { height: number }; res: boolean }
  'plugapi:setSubInput': { req: { placeholder: string }; res: boolean }
  'plugapi:notify': { req: { body: unknown }; res: boolean }
  'plugapi:copyText': { req: { text: unknown }; res: boolean }
  'plugapi:readText': { req: void; res: string }
  'plugapi:openPath': { req: { path: string }; res: boolean }
  /** open(url)（P-2.5）：交给系统浏览器，需 net 权限 + http/https/mailto 白名单 */
  'plugapi:openUrl': { req: { url: string }; res: boolean }
  /** Alert（P-2.5）：宿主原生模态框；回被按下的动作 id，无对应动作时 null。
   *  同插件同时只一条框，抢不到名额也回 null（与「用户没选」同一个返回值，插件侧不需要分支） */
  'plugapi:alert': {
    req: { title: string; message: string; actions: unknown[] }
    res: string | null
  }
  /** 一次取回声明过的全部偏好（P-2.5：getPreferenceValues） */
  // 插件登记自己的定时任务（P-2③「生命周期外执行」）：owner 由 handler 按 sender 定，
  // 插件传不进别人的身份，也只能排 mode:'action' 的命令
  'plugapi:scheduleList': { req: void; res: AutomationTaskView[] }
  'plugapi:scheduleAdd': {
    req: {
      label?: string
      cron: string
      cmd: string
      arguments?: Record<string, string>
    }
    res: { ok: boolean; id?: string; error?: string }
  }
  'plugapi:scheduleRemove': { req: { id: string }; res: { ok: boolean; error?: string } }
  'plugapi:listPreferences': {
    req: void
    res: ReturnType<typeof listPluginPreferences>
  }
  'plugapi:detach': { req: void; res: boolean }
  'plugapi:close': { req: void; res: boolean }
  'plugapi:dbPut': {
    req: { id: string; data: unknown }
    res: { id: string } | { error: string }
  }
  'plugapi:dbGet': { req: { id: string }; res: { id: string; data: unknown } | null }
  'plugapi:dbRemove': { req: { id: string }; res: { ok: boolean } | { error: string } }
  'plugapi:dbList': { req: void; res: Array<{ id: string; data: unknown; updatedAt: number }> }
  'launcher:plugin-form-submit': {
    req: { values: unknown }
    res: ReturnType<typeof submitPluginFormValues>
  }
  'launcher:plugin-run-action': {
    req: { pluginId: string; itemIndex: number; actionIndex: number }
    res: ReturnType<typeof runPluginCallback>
  }
  'launcher:quicklinks:list': { req: void; res: Quicklink[] }
  'launcher:quicklink:favicon': { req: { url: string }; res: string | null }
  'launcher:quicklinks:save': {
    req: { items: unknown[] }
    res: { success: true; removed: number }
  }
  'launcher:syncGetConfig': { req: void; res: SyncConfig }
  'launcher:syncSetConfig': { req: { config: SyncConfig }; res: { success: true } }
  'launcher:syncTest': {
    req: { configOverride?: SyncConfig | null }
    res: Awaited<ReturnType<typeof testConnection>>
  }
  'launcher:syncBackup': { req: void; res: SyncRunResult }
  'launcher:syncRestore': { req: void; res: SyncRunResult }

  // ─────────── 标签（tag:*）与使用统计（usage:*）───────────
  // 这两个家族的主进程只是 store 的纯转发层，res 直接取 store 方法的返回类型：
  // 登记册不再复述形状，store 改签名时这里编译期就报。
  'tag:getTags': { req: void; res: ReturnType<TagDataStore['getTags']> }
  'tag:getTagById': { req: { id: string }; res: ReturnType<TagDataStore['getTagById']> }
  'tag:addTag': {
    req: { name: string; opts?: { parentId?: string } }
    res: ReturnType<TagDataStore['addTag']>
  }
  'tag:updateTag': {
    req: { id: string; updates: Parameters<TagDataStore['updateTag']>[1] }
    res: ReturnType<TagDataStore['updateTag']>
  }
  'tag:deleteTag': { req: { id: string }; res: ReturnType<TagDataStore['deleteTag']> }
  'tag:getTagsByIds': { req: { ids: string[] }; res: ReturnType<TagDataStore['getTagsByIds']> }

  'usage:recordUse': { req: { moduleId: string }; res: void }
  'usage:getRecent': { req: { limit?: number }; res: string[] }
  'usage:getStats': {
    req: void
    res: Array<{ moduleId: string; useCount: number; usedAt: number }>
  }
  'usage:clearRecent': { req: void; res: void }
  'usage:addFavorite': { req: { moduleId: string }; res: void }
  'usage:removeFavorite': { req: { moduleId: string }; res: void }
  'usage:isFavorite': { req: { moduleId: string }; res: boolean }
  'usage:getFavorites': { req: void; res: string[] }
  'usage:toggleFavorite': { req: { moduleId: string }; res: boolean }

  // ─────────── 提醒事项（reminders:*）───────────
  // req/res 全部从 ReminderService 的方法签名派生：这些通道是纯转发层，
  // 登记册复述一遍形状只会造成漂移（该服务的 data/patch 参数就是线格式）。
  'reminders:list': {
    req: { filter?: ReminderFilter }
    res: ReturnType<typeof reminderService.list>
  }
  'reminders:get': { req: { id: string }; res: ReturnType<typeof reminderService.get> }
  'reminders:create': {
    req: Parameters<typeof reminderService.create>[0]
    res: ReturnType<typeof reminderService.create>
  }
  'reminders:update': {
    req: { id: string; patch: Parameters<typeof reminderService.update>[1] }
    res: ReturnType<typeof reminderService.update>
  }
  'reminders:complete': {
    req: { id: string }
    res: ReturnType<typeof reminderService.complete>
  }
  'reminders:uncomplete': {
    req: { id: string }
    res: ReturnType<typeof reminderService.uncomplete>
  }
  'reminders:remove': {
    req: { id: string }
    res: ReturnType<typeof reminderService.remove>
  }
  'reminders:countActive': { req: void; res: ReturnType<typeof reminderService.countActive> }

  // ─────────── 笔记（notes:*）／片段（snippet:*）／剪辑（clip:*）───────────
  // 同样全部派生自仓库/store/service 的方法签名（这三个家族是纯转发层）。
  'notes:list': {
    req: { filter?: NoteFilter }
    res: ReturnType<typeof notesRepository.getNotes>
  }
  'notes:get': {
    req: { id: string }
    res: NonNullable<ReturnType<typeof notesRepository.getNoteById>> | null
  }
  'notes:create': {
    req: Parameters<typeof notesRepository.addNote>[0]
    res: ReturnType<typeof notesRepository.addNote>
  }
  'notes:update': {
    req: { id: string; updates: Parameters<typeof notesRepository.updateNote>[1] }
    res: ReturnType<typeof notesRepository.updateNote>
  }
  'notes:trash': { req: { id: string }; res: ReturnType<typeof notesRepository.trashNote> }
  'notes:restore': { req: { id: string }; res: ReturnType<typeof notesRepository.restoreNote> }
  'notes:delete': {
    req: { id: string }
    res: ReturnType<typeof notesRepository.permanentlyDeleteNote>
  }
  'notes:emptyTrash': { req: void; res: ReturnType<typeof notesRepository.emptyTrash> }
  'notes:togglePin': { req: { id: string }; res: ReturnType<typeof notesRepository.togglePin> }
  'notes:stats': { req: void; res: ReturnType<typeof notesRepository.getStatistics> }
  'notes:folders': { req: void; res: ReturnType<typeof notesRepository.getFolders> }
  'notes:createFolder': {
    req: { name: string }
    res: ReturnType<typeof notesRepository.addFolder>
  }
  'notes:renameFolder': {
    req: { id: string; name: string }
    res: ReturnType<typeof notesRepository.updateFolder>
  }
  'notes:deleteFolder': {
    req: { id: string }
    res: ReturnType<typeof notesRepository.deleteFolder>
  }

  'snippet:getSnippets': {
    req: { filters?: SnippetFilter }
    res: ReturnType<SnippetDataStore['getSnippets']>
  }
  'snippet:getSnippetById': {
    req: { id: string }
    res: ReturnType<SnippetDataStore['getSnippetById']>
  }
  'snippet:addSnippet': {
    req: Parameters<SnippetDataStore['addSnippet']>[0]
    res: ReturnType<SnippetDataStore['addSnippet']>
  }
  'snippet:updateSnippet': {
    req: { id: string; updates: Parameters<SnippetDataStore['updateSnippet']>[1] }
    res: ReturnType<SnippetDataStore['updateSnippet']>
  }
  'snippet:deleteSnippet': {
    req: { id: string }
    res: ReturnType<SnippetDataStore['deleteSnippet']>
  }
  'snippet:permanentlyDeleteSnippet': {
    req: { id: string }
    res: ReturnType<SnippetDataStore['permanentlyDeleteSnippet']>
  }
  'snippet:restoreSnippet': {
    req: { id: string }
    res: ReturnType<SnippetDataStore['restoreSnippet']>
  }
  'snippet:duplicateSnippet': {
    req: { id: string }
    res: ReturnType<SnippetDataStore['duplicateSnippet']>
  }
  'snippet:getStatistics': { req: void; res: ReturnType<SnippetDataStore['getStatistics']> }
  'snippet:emptyTrash': { req: void; res: ReturnType<SnippetDataStore['emptyTrash']> }
  'snippet:exportAll': {
    req: void
    res: {
      ok: boolean
      canceled?: boolean
      filePath?: string
      count?: number
      error?: string
    }
  }
  'snippet:importFile': {
    req: void
    res: SnippetImportResult & { ok: boolean; canceled?: boolean; error?: string }
  }

  'clip:addClip': {
    req: { videoId: string; startTime: number; endTime: number; label?: string }
    res: ReturnType<ClipService['addClip']>
  }
  'clip:removeClip': { req: { videoId: string; clipId: string }; res: boolean }
  'clip:updateClip': {
    req: { videoId: string; clipId: string; updates: Partial<Clip> }
    res: ReturnType<ClipService['updateClip']>
  }
  'clip:getClips': { req: { videoId: string }; res: ReturnType<ClipService['getClips']> }
  'clip:clearClips': { req: { videoId: string }; res: void }
  'clip:previewClip': {
    req: { videoPath: string; clip: Clip }
    res: Awaited<ReturnType<ClipService['previewClip']>>
  }
  'clip:exportClips': {
    req: { videoPath: string; options: ClipExportOptions }
    res: { success: boolean; outputPath?: string; error?: string }
  }
  'clip:getVideoInfo': {
    req: { videoPath: string }
    res: Awaited<ReturnType<ClipService['getVideoInfo']>>
  }
  'clip:selectVideoFile': { req: void; res: string | null }
  'clip:selectAudioFile': { req: void; res: string | null }
  'clip:selectSavePath': { req: void; res: string | null }

  // ─────────── 文件夹（folder:*）───────────
  'folder:selectSavePath': {
    req: { defaultName?: string; filters?: Array<{ name: string; extensions: string[] }> }
    res: string | null
  }
  'folder:getFolders': { req: void; res: ReturnType<FolderDataStore['getAllFolders']> }
  'folder:getFolderTree': { req: void; res: ReturnType<FolderDataStore['getFolderTree']> }
  'folder:getFolderById': {
    req: { id: string }
    res: ReturnType<FolderDataStore['getFolderById']>
  }
  'folder:getFoldersByParentId': {
    req: { parentId: string | null }
    res: ReturnType<FolderDataStore['getFoldersByParentId']>
  }
  'folder:addFolder': {
    /** 线格式就是「调用方给的那一份」：store 的入参多出 orderIndex（主进程补 0 再自动重算），
     *  所以这里不能直接 Parameters<...>[0] 派生 */
    req: {
      name: string
      parentId?: string | null
      icon?: string | null
      defaultLanguage?: string
      isOpen?: boolean
    }
    res: ReturnType<FolderDataStore['addFolder']>
  }
  'folder:updateFolder': {
    req: { id: string; updates: Parameters<FolderDataStore['updateFolder']>[1] }
    res: ReturnType<FolderDataStore['updateFolder']>
  }
  'folder:deleteFolder': {
    req: { id: string }
    res: ReturnType<FolderDataStore['deleteFolder']>
  }
  'folder:updateFolderOrder': {
    req: { folderId: string; newParentId: string | null; newOrderIndex: number }
    res: boolean
  }
  'folder:canMoveFolder': {
    req: { folderId: string; targetParentId: string | null }
    res: ReturnType<FolderDataStore['canMoveFolder']>
  }

  // ─────────── 截图库 OCR 索引（shotidx:*）与录制设置（recording-settings:*）───────────
  'shotidx:status': { req: void; res: ReturnType<typeof screenshotIndexService.status> }
  'shotidx:scan': {
    req: void
    res: { success: true; added: number } | { success: false; error: string }
  }
  'shotidx:search': {
    /** 胶囊搜索框传来的都是未校验值，handler 内保留 typeof 守卫（渲染端可被攻陷） */
    req: { query?: string; ensure?: boolean }
    res: { success: true; items: ReturnType<typeof screenshotIndexService.search> }
  }
  'shotidx:pastePath': {
    req: { filePath: string }
    res: Awaited<ReturnType<typeof screenshotIndexService.pastePath>> | { ok: false; error: string }
  }
  'shotidx:pasteLatest': {
    req: void
    res: Awaited<ReturnType<typeof screenshotIndexService.pasteLatest>>
  }

  'recording-settings:getSettings': {
    req: void
    res: ReturnType<RecordingSettingsDataStore['getSettings']>
  }
  'recording-settings:updateSettings': {
    req: Parameters<RecordingSettingsDataStore['updateSettings']>[0]
    res: ReturnType<RecordingSettingsDataStore['updateSettings']>
  }
  'recording-settings:resetToDefaults': {
    req: void
    res: ReturnType<RecordingSettingsDataStore['resetToDefaults']>
  }
  'recording-settings:getQualityPreset': {
    req: { quality: QualityKey }
    res: (typeof QUALITY_PRESETS)[QualityKey]
  }

  // ─────────── 旧录制历史（recording-history:*，与 recording.* 并存 6 个月）───────────
  'recording-history:getHistory': {
    req: void
    res: ReturnType<RecordingHistoryService['getHistory']>
  }
  'recording-history:getHistoryByDateRange': {
    req: { start: number; end: number }
    res: ReturnType<RecordingHistoryService['getHistoryByDateRange']>
  }
  'recording-history:addHistory': {
    req: Omit<RecordingHistory, 'id' | 'createdAt'>
    res: ReturnType<RecordingHistoryService['addHistory']>
  }
  'recording-history:deleteHistory': {
    req: { id: string }
    res: ReturnType<RecordingHistoryService['deleteHistory']>
  }
  'recording-history:clearHistory': { req: void; res: void }
  'recording-history:generateThumbnail': {
    req: { videoPath: string }
    res: Awaited<ReturnType<RecordingHistoryService['generateThumbnail']>>
  }
  'recording-history:updateThumbnail': {
    req: { id: string }
    res: Awaited<ReturnType<RecordingHistoryService['updateThumbnail']>>
  }
  'recording-history:getStatistics': {
    req: void
    res: ReturnType<RecordingHistoryService['getStatistics']>
  }
  'recording-history:openFile': {
    req: { filePath: string }
    res: { success: boolean; error?: string }
  }
  'recording-history:showInFolder': {
    req: { filePath: string }
    res: { success: boolean; error?: string }
  }

  // ─────────── 系统信息 / 通知 / 剪贴板历史 / 悬浮窗 / 专注屏蔽 ───────────
  // 两个同名不同义的 SystemInfo（系统路径信息 vs 硬件信息）必须分别起别名，
  // 否则这里 import 会撞名（此前 d.ts 靠手抄一份 HardwareInfo 绕开，抄丢过字段）。
  'system:info': { req: void; res: LeafSystemInfo }
  'system:hardware': { req: void; res: HardwareInfo }
  'system:openPath': { req: { p: string }; res: boolean }
  'system:openExternal': { req: { url: string }; res: boolean }
  'system:frontmostApp': { req: void; res: string | null }
  /** P-4⑤：前台应用 + 窗口标题（只到「标题」这一层，不抓屏、不动剪贴板） */
  'system:frontmostContext': { req: void; res: FrontmostContext }

  'notification:show': {
    req: { type: NotificationType; title: string; body: string; options?: NotificationOptions }
    res: number
  }
  'notification:pomodoro': {
    req: { type: 'start' | 'break' | 'complete' | 'pause' | 'remind'; message?: string }
    res: number
  }
  'notification:recording': {
    req: { type: 'start' | 'stop' | 'error'; message?: string }
    res: number
  }
  'notification:info': {
    req: { title: string; body: string; options?: NotificationOptions }
    res: number
  }
  'notification:success': {
    req: { title: string; body: string; options?: NotificationOptions }
    res: number
  }
  'notification:warning': {
    req: { title: string; body: string; options?: NotificationOptions }
    res: number
  }
  'notification:error': {
    req: { title: string; body: string; options?: NotificationOptions }
    res: number
  }
  'notification:close': { req: { id: number }; res: void }
  'notification:closeAll': { req: void; res: void }

  'cliphist:list': { req: void; res: ClipboardHistoryItem[] }
  'cliphist:copy': { req: { id: string }; res: boolean }
  'cliphist:remove': { req: { id: string }; res: boolean }
  'cliphist:clear': { req: void; res: boolean }
  'cliphist:togglePin': { req: { id: string }; res: boolean }
  'cliphist:setKeywords': { req: { id: string; keywords: string[] }; res: boolean }
  'cliphist:getEnabled': { req: void; res: ReturnType<typeof clipboardHistory.getEnabled> }
  'cliphist:setEnabled': {
    req: { on: boolean }
    res: ReturnType<typeof clipboardHistory.getEnabled>
  }
  'cliphist:getBlockedApps': { req: void; res: string[] }
  'cliphist:setBlockedApps': { req: { apps: string[] }; res: string[] }
  'cliphist:startPasteSequence': {
    req: { id: string }
    res: { ok: boolean; count?: number; error?: string }
  }
  'cliphist:pasteNext': { req: void; res: { ok: boolean; hasMore: boolean; error?: string } }
  'cliphist:decodeQr': { req: { id: string }; res: { ok: boolean; text?: string; error?: string } }
  'cliphist:pasteBack': { req: { id: string }; res: { ok: boolean; error?: string } }

  'pomodoro:mini:show': { req: void; res: boolean }
  'pomodoro:mini:hide': { req: void; res: boolean }
  'pomodoro:mini:toggle': { req: void; res: boolean }
  'pomodoro:mini:isVisible': { req: void; res: boolean }

  'floatingNote:toggle': { req: void; res: boolean }
  'floatingNote:show': { req: void; res: boolean }
  'floatingNote:hide': { req: void; res: boolean }
  'floatingNote:isVisible': { req: void; res: boolean }

  'focus-shield:getConfig': { req: void; res: ReturnType<typeof focusShield.getConfig> }
  'focus-shield:setConfig': {
    req: Parameters<typeof focusShield.setConfig>[0]
    res: ReturnType<typeof focusShield.setConfig>
  }
  'focus-shield:setActive': { req: { active: boolean }; res: boolean }
  'focus-shield:temporaryAllow': { req: void; res: boolean }
  'focus-shield:currentState': { req: void; res: ReturnType<typeof focusShield.currentState> }

  // ─────────── AI 助手（ai:*）───────────
  // 类型全在 src/shared/ai.ts（本来就是两端共用），不引 AIService.ts：
  // 后者 import electron + db/repos，会把主进程依赖拖进 web 编译程序。
  'ai:getConfig': { req: void; res: AIConfig }
  'ai:setConfig': { req: { patch: Partial<AIConfig> }; res: AIConfig }
  'ai:isConfigured': { req: void; res: boolean }
  /** BYOM：拉当前端点的模型列表（P-4①），顺带回连接的是哪个地址 */
  'ai:listModels': {
    req: void
    res: { ok: boolean; models: string[]; error?: string; url?: string }
  }
  // ── MCP 客户端最小面（P-4②）：连接只认已存配置的 id ──
  'mcp:overview': { req: void; res: McpOverview }
  'mcp:setServers': {
    req: { servers: unknown }
    res: {
      servers: McpServerPublic[]
      rejected: Array<{ index: number; reason: string }>
    }
  }
  'mcp:connect': { req: { id: string }; res: McpServerView }
  'mcp:stop': { req: { id: string }; res: boolean }
  'mcp:callTool': {
    req: { id: string; tool: string; args: Record<string, unknown> }
    res: { ok: boolean; text: string; ignoredContent: number; error?: string }
  }
  /** 工具清单缓存 → 根搜索命令行（P-4② 收尾）：不 spawn，纯读缓存 */
  'mcp:toolCommands': { req: void; res: McpToolCommand[] }
  /** 从搜索框跑一个工具：认 id + 工具名，参数是**字符串**（类型由主进程按 schema 定） */
  'mcp:runTool': {
    req: { id: string; tool: string; args: Record<string, string> }
    res: McpCallResult
  }
  // ── Automations（P-4④）：定时跑主进程可无界面执行的动作 ──
  'automation:list': { req: void; res: AutomationTaskView[] }
  'automation:save': {
    req: { tasks: unknown }
    res: {
      tasks: AutomationTaskView[]
      rejected: Array<{ index: number; reason: string }>
    }
  }
  'automation:runNow': { req: { id: string }; res: { ok: boolean; error?: string } }
  'automation:setEnabled': { req: { id: string; enabled: boolean }; res: AutomationTaskView[] }
  'ai:listSessions': { req: void; res: AIChatSession[] }
  'ai:getSession': { req: { id: string }; res: AIChatSession | null }
  'ai:saveSession': { req: AIChatSession; res: AIChatSession }
  'ai:deleteSession': { req: { id: string }; res: boolean }
  'ai:clearSessions': { req: void; res: boolean }
  'ai:listPresets': { req: void; res: AIModelPreset[] }
  'ai:savePreset': { req: { preset: AIModelPreset }; res: AIModelPreset[] }
  'ai:deletePreset': { req: { id: string }; res: AIModelPreset[] }
  'ai:applyPreset': { req: { id: string }; res: AIConfig | null }
  'ai:chat': {
    req: { sessionId: string; messages: AIChatMessage[] }
    res: { ok: boolean; text?: string; error?: string }
  }

  // ─────────── 迁移 / 备份 / 同步（migration:* / cloudBackup:* / syncdata:*）───────────
  'migration:listArchives': { req: void; res: ArchiveInfo[] }
  'migration:deleteArchive': { req: { archivePath: string }; res: { ok: boolean; error?: string } }
  'migration:restoreArchive': {
    req: { archivePath: string }
    res: { ok: boolean; restored: string[]; errors: string[] }
  }
  'migration:exportDb': { req: void; res: string | null }
  'migration:importDb': { req: void; res: { imported: boolean; filePath: string | null } }
  'migration:factoryReset': { req: void; res: boolean }
  'cloudBackup:list': {
    req: void
    res: Awaited<ReturnType<typeof listCloudBackups>>
  }
  'cloudBackup:backup': {
    req: { password: string }
    res: { ok: false; error: string } | Awaited<ReturnType<typeof backupFullDb>>
  }
  'cloudBackup:restore': {
    req: { password: string; fileName?: string }
    res: { ok: false; error: string } | Awaited<ReturnType<typeof restoreFullDb>>
  }
  'syncdata:status': { req: void; res: ReturnType<typeof dataSyncStatus> }
  'syncdata:push': { req: void; res: Awaited<ReturnType<typeof pushDataSync>> }
  'syncdata:pull': { req: void; res: Awaited<ReturnType<typeof pullDataSync>> }

  // ─────────── 日历（calendar:*，返回形状全部从 CalendarService 派生）───────────
  'calendar:status': {
    req: void
    res: { auth: Awaited<ReturnType<typeof calendarService.getNextEvent>>['auth'] }
  }
  'calendar:requestAccess': {
    req: void
    res: Awaited<ReturnType<typeof calendarService.requestAccess>>
  }
  'calendar:next': { req: void; res: Awaited<ReturnType<typeof calendarService.getNextEvent>> }
  'calendar:createEvent': {
    req: Parameters<typeof calendarService.createEvent>[0]
    res: Awaited<ReturnType<typeof calendarService.createEvent>>
  }
  'calendar:schedule': {
    req: void
    res: Awaited<ReturnType<typeof calendarService.getSchedule>>
  }

  // ─────────── 杂项小家族 ───────────
  'trash:list': { req: void; res: TrashItem[] }
  'trash:empty': { req: void; res: boolean }
  'trash:restore': { req: { itemPath: string }; res: boolean }
  'trash:delete': { req: { itemPath: string }; res: boolean }
  'trash:open': { req: void; res: boolean }

  'alias:getAll': { req: void; res: ReturnType<typeof getAliases> }
  'alias:get': { req: { commandKey: string }; res: ReturnType<typeof getAliasesForCommand> }
  'alias:set': {
    req: { commandKey: string; alias: string }
    res: ReturnType<typeof setAlias>
  }
  'alias:remove': {
    req: { commandKey: string; alias: string }
    res: ReturnType<typeof removeAlias>
  }

  'search:history:get': { req: void; res: string[] }
  'search:history:add': { req: { query: string }; res: string[] }
  'search:history:clear': { req: void; res: boolean }

  'get-applications': { req: void; res: AppEntry[] }
  'refresh-applications': { req: void; res: AppEntry[] }
  'launch-application': { req: { appPath: string }; res: { success: boolean; error?: string } }
  'create-new-window': { req: { route: string }; res: boolean }
  'app:isPrimaryWindow': { req: void; res: boolean }

  'find:files': {
    req: { query: string; limit?: number; opts?: FileSearchOptions }
    res: {
      ok: boolean
      supported: boolean
      items: Array<{
        path: string
        name: string
        dir: string
        size?: number
        modifiedAt?: number
      }>
      /** 'index' = #9 自建索引命中；其余为系统检索回退路径 */
      source?: 'index' | 'mdfind' | 'powershell'
      error?: string
    }
  }
  'find:reveal': { req: { filePath: string }; res: { ok: boolean; error?: string } }

  /** E2E-only：主进程通道调用计数快照（仅 LEAF_E2E=1 时注册，见 src/main/e2eProbe.ts） */
  'e2e:probeCounts': { req: void; res: Record<string, number> }

  'systemcmd:run': { req: { id: string }; res: { ok: boolean; error?: string } }
  'systemcmd:ids': {
    req: void
    res: { system: string[]; window: string[] }
  }

  'browser:tabs:list': {
    req: void
    res: { ok: boolean; tabs: BrowserTab[]; supported: boolean }
  }
  'browser:tabs:activate': { req: { tab: BrowserTab }; res: { ok: boolean; error?: string } }

  'dictionary:open': { req: { word: string }; res: boolean }
  'dictionary:query': { req: { word: string }; res: DictionaryDefinition[] }

  'windows:list': { req: void; res: WindowInfo[] }
  'windows:activate': { req: { pid: number; title: string }; res: boolean }

  'region-overlay:submit': { req: { region: RegionSelection }; res: void }
  'region-overlay:cancel': { req: void; res: void }

  'screen-recorder:getSources': {
    req: {
      options: {
        types: Array<'screen' | 'window'>
        thumbnailSize?: { width: number; height: number }
      }
    }
    /** Electron desktopCapturer 的源列表（name/thumbnail/displayId…） */
    res: Array<{ name: string; id: string; thumbnail: string; displayId?: number }>
  }
  'screen-recorder:requestPermission': {
    req: void
    res: { success: boolean; message: string }
  }
  'screen-recorder:checkPermission': {
    req: void
    res: { hasPermission: boolean; message?: string }
  }
  // ── macOS 权限面板（P-3.5）：真状态 / 真申请 / 真跳转 ──
  'permissions:probe': { req: void; res: PermissionStatus[] }
  'permissions:request': {
    req: { id: PermissionId }
    res: { fired: boolean; state: PermissionState; note?: string }
  }
  'permissions:openSettings': {
    req: { id: PermissionId | 'privacy' }
    res: { ok: boolean; error?: string }
  }
  'screen-recorder:getDefaultSavePath': { req: void; res: string }
  'screen-recorder:selectSavePath': { req: void; res: string | null }
  'screen-recorder:beginWrite': {
    req: { filePath: string }
    res: { ok: boolean; error?: string; path?: string }
  }
  'screen-recorder:appendChunk': {
    req: { filePath: string; chunk: Uint8Array }
    res: { ok: boolean; error?: string }
  }
  /** 分片写盘与一次性写盘共用同一返回形状（成功带 filePath/historyId，失败带 error） */
  'screen-recorder:abortWrite': { req: { filePath: string }; res: { ok: boolean } }
  'screen-recorder:endWrite': {
    req: { filePath: string; duration?: number; recordingId?: string }
    res: { success: boolean; filePath?: string; historyId?: string; error?: string }
  }
  'screen-recorder:saveFile': {
    req: {
      filePath: string
      buffer: Uint8Array
      duration?: number
      recordingId?: string
    }
    res: { success: boolean; filePath?: string; historyId?: string; error?: string }
  }

  'pomodoro:dispatchShortcut': {
    req: { action: 'toggle' | 'skip' | 'reset' }
    res: boolean
  }
}

// ─────────── 录制契约专用类型（递归引用 OK；放置在 IpcContract 之后） ───────────
/**
 * 录制状态取自仓库层的唯一定义。此前这里自己抄了一份字面量并多出一个
 * 'discarded'（那是 SegmentState 的成员，属于 rec_segments 不是 rec_recordings），
 * 两份定义一漂移，渲染端就会拿到永不出现的状态值。
 */
export type RecordingStatus = RepoRecordingStatus

export interface RecordingSummary {
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
  status: RecordingStatus
  quality: 'low' | 'medium' | 'high' | 'source'
  cursorStyle: 'halo' | 'highlight' | 'click-ring' | null
  startedAt: number
  endedAt: number | null
  recoveredAt: number | null
  thumbnailPath: string | null
  description: string | null
}

export interface RecordingDefaultSettings {
  fps: 30 | 60
  quality: 'low' | 'medium' | 'high' | 'source'
  cursor: 'halo' | 'highlight' | 'click-ring'
  defaultSavePath: string | null
  micDefault: string | null
  systemDefault: string | null
  hasCamera: boolean
  hasMic: boolean
  hasSystemAudio: boolean
}

/** 明暗选择（与 PreferencesDataStore.getTheme 的取值域一致） */
export type ThemeChoice = 'light' | 'dark' | 'auto'

export type IpcKey = keyof IpcContract
export type IpcRequest<K extends IpcKey> = IpcContract[K]['req']
export type IpcResponse<K extends IpcKey> = IpcContract[K]['res']

/**
 * 注册每个 IPC 通道。
 * 主进程模块用它来声明一个 channel 必须有 req/res 类型。
 */
export interface IpcRegistration<K extends IpcKey = IpcKey> {
  channel: K
  handler: (req: IpcRequest<K>) => Promise<IpcResponse<K>> | IpcResponse<K>
}
