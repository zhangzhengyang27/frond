import type { UpdateEvent, UpdateStatus } from '../renderer/src/types/update'
import type { ArchiveInfo } from '../main/db/legacyArchive'
import type { FirstPartyPage } from '../shared/commands'
import type { McpToolArg } from '../shared/mcp'
import type { McpToolCommand } from './mcp'
import type { McpCallResult } from '../main/services/mcp/client'
import type { PopToRootMode } from '../shared/popToRoot'
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
import type { SystemInfo as LeafSystemInfo } from '../main/ipc/system'
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

export interface API {
  /** E2E-only：主进程通道调用计数快照（未设 LEAF_E2E 时主进程不注册，调用会 reject） */
  e2e: { probeCounts: () => Promise<Record<string, number>> }
  getApplications: () => Promise<Application[]>
  refreshApplications: () => Promise<Application[]>
  /** 应用包元数据（读 Info.plist + 包 mtime；非 .app 绝对路径一律返回全 null） */
  readAppInfo: (appPath: string) => Promise<{
    bundleId: string | null
    version: string | null
    buildVersion: string | null
    executable: string | null
    modifiedMs: number | null
  }>
  launchApplication: (appPath: string) => Promise<{ success: boolean; error?: string }>
  /** 本 webContents 是否为主窗口（App 级单例只在主窗口初始化） */
  isPrimaryWindow: () => Promise<boolean>
  /** ⌘R 刷新应用列表（主进程 watcher 转发）；返回取消订阅函数 */
  onRefreshApplications: (cb: () => void) => () => void
  pomodoro: {
    getTasks: () => Promise<PomodoroTask[]>
    addTask: (title: string, options?: PomodoroAddTaskOptions) => Promise<PomodoroTask>
    updateTask: (id: string, updates: PomodoroUpdateTaskPayload) => Promise<PomodoroTask | null>
    deleteTask: (id: string) => Promise<boolean>
    completeTask: (id: string) => Promise<PomodoroTask | null>
    projects: {
      getAll: () => Promise<PomodoroProject[]>
      add: (name: string, color?: string) => Promise<PomodoroProject>
      update: (
        id: string,
        updates: { name?: string; color?: string; sortOrder?: number }
      ) => Promise<PomodoroProject | null>
      delete: (id: string) => Promise<boolean>
      settings: {
        get: (projectId: string) => Promise<ProjectTimerOverrides | null>
        all: () => Promise<Record<string, ProjectTimerOverrides>>
        save: (
          projectId: string,
          overrides: ProjectTimerOverrides
        ) => Promise<ProjectTimerOverrides>
        delete: (projectId: string) => Promise<boolean>
      }
    }
    timerState: {
      getAll: () => Promise<Record<string, PersistedTimerState>>
      get: (projectId: string) => Promise<PersistedTimerState | null>
      save: (projectId: string, state: PersistedTimerState) => Promise<void>
      delete: (projectId: string) => Promise<boolean>
    }
    addRecord: (record: Omit<PomodoroRecord, 'id' | 'date'>) => Promise<PomodoroRecord>
    getRecords: () => Promise<PomodoroRecord[]>
    getTodayRecords: () => Promise<PomodoroRecord[]>
    getFreeRecords: () => Promise<PomodoroRecord[]>
    getRecordsByRange: (opts: {
      from: number
      to: number
      projectId?: string | null
    }) => Promise<PomodoroRecord[]>
    getThisWeekRecords: () => Promise<PomodoroRecord[]>
    getThisMonthRecords: () => Promise<PomodoroRecord[]>
    getStatistics: () => Promise<{
      today: PomodoroPeriodStats
      week: PomodoroPeriodStats
      month: PomodoroPeriodStats
    }>
    task: {
      detail: (taskId: string) => Promise<PomodoroTaskDetail | null>
      export: (
        format: 'csv' | 'markdown',
        fileBaseName: string,
        payload: PomodoroTaskExportPayload
      ) => Promise<{ ok: boolean; canceled: boolean; path: string | null; error?: string }>
    }
    record: {
      get: (id: string) => Promise<PomodoroRecordDetail | null>
      updateNote: (id: string, note: string) => Promise<PomodoroRecord | null>
    }
    todoist: {
      getToken: () => Promise<string>
      setToken: (token: string) => Promise<{ ok: boolean }>
      importTasks: () => Promise<{
        ok: boolean
        error?: string
        tasks?: Array<{ externalId: string; title: string }>
      }>
      complete: (externalId: string) => Promise<{ ok: boolean; error?: string }>
    }
    integration: {
      getMode: () => Promise<'normal' | 'strong' | 'silent'>
      setMode: (mode: 'normal' | 'strong' | 'silent') => Promise<'normal' | 'strong' | 'silent'>
      testNotification: () => Promise<void>
      notify: (
        event: 'start' | 'break' | 'complete' | 'pause' | 'remind',
        message?: string
      ) => Promise<number | null>
      getShortcuts: () => Promise<{ toggle: string; skip: string; reset: string }>
      setShortcut: (
        action: 'toggle' | 'skip' | 'reset',
        accelerator: string
      ) => Promise<{ shortcuts: { toggle: string; skip: string; reset: string }; failed: string[] }>
      resetShortcuts: () => Promise<{
        shortcuts: { toggle: string; skip: string; reset: string }
        failed: string[]
      }>
      updateTraySnapshot: (patch: Partial<PomodoroTraySnapshot>) => Promise<PomodoroTraySnapshot>
      getTraySnapshot: () => Promise<PomodoroTraySnapshot>
      /** 触发主进程按 sender 回推 traySnapshot（B5 修复，无参订阅） */
      subscribeSnapshot: () => void
      describeTraySnapshot: () => Promise<{ primary: string; secondary: string }>
      setFocusMode: (enabled: boolean) => Promise<PomodoroTraySnapshot>
      getFocusMode: () => Promise<boolean>
      onTraySnapshot: (cb: (snap: PomodoroTraySnapshot) => void) => () => void
      onShortcut: (cb: (event: { action: 'toggle' | 'skip' | 'reset' }) => void) => () => void
      onFocusProject: (cb: (event: { projectId: string }) => void) => () => void
      updateProjects: (
        projects: Array<{ id: string; name: string; isActive: boolean }>,
        focusedProjectId: string | null
      ) => Promise<{ ok: boolean }>
    }
    stats: {
      getDailyTrend: (days: number, endDate?: number) => Promise<DailyTrendPoint[]>
      getProjectDistribution: (from: number, to: number) => Promise<ProjectDistributionPoint[]>
      getFocusHeatmap: (days: number, endDate?: number) => Promise<HeatmapCell[]>
      getTaskCompletionStats: (from: number, to: number) => Promise<TaskCompletionStats>
    }
    // M5：迷你悬浮窗
    mini: {
      show: () => Promise<boolean>
      hide: () => Promise<boolean>
      toggle: () => Promise<boolean>
      isVisible: () => Promise<boolean>
    }
    /** 远程快捷键：胶囊「开始专注」内联页等外部入口触发（与全局快捷键同链路） */
    dispatchShortcut: (action: 'toggle' | 'skip' | 'reset') => Promise<boolean>
    getSettings: () => Promise<PomodoroSettings>
    saveSettings: (settings: Partial<PomodoroSettings>) => Promise<PomodoroSettings>
  }
  snippet: {
    getSnippets: (filters?: {
      folderId?: string | null
      tagId?: string
      isFavorites?: boolean
      isDeleted?: boolean
      isInbox?: boolean
      search?: string
    }) => Promise<Snippet[]>
    getSnippetById: (id: string) => Promise<Snippet | undefined>
    addSnippet: (snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Snippet>
    updateSnippet: (id: string, updates: Partial<Snippet>) => Promise<Snippet | undefined>
    deleteSnippet: (id: string) => Promise<boolean>
    permanentlyDeleteSnippet: (id: string) => Promise<boolean>
    restoreSnippet: (id: string) => Promise<boolean>
    duplicateSnippet: (id: string) => Promise<Snippet | undefined>
    getStatistics: () => Promise<{ total: number; trash: number }>
    emptyTrash: () => Promise<number>
    /** B3：导出全部片段为 JSON 文件（弹出保存对话框） */
    exportAll: () => Promise<{
      ok: boolean
      canceled?: boolean
      filePath?: string
      count?: number
      error?: string
    }>
    /** B3：从 JSON 文件导入片段（弹出选择对话框，同 id 去重合并） */
    importFile: () => Promise<
      SnippetImportResult & { ok: boolean; canceled?: boolean; error?: string }
    >
  }
  tag: {
    getTags: () => Promise<Tag[]>
    getTagById: (id: string) => Promise<Tag | undefined>
    addTag: (name: string, opts?: { parentId?: string }) => Promise<Tag>
    updateTag: (
      id: string,
      updates: Partial<Omit<Tag, 'id' | 'createdAt'>>
    ) => Promise<Tag | undefined>
    deleteTag: (id: string) => Promise<boolean>
    getTagsByIds: (ids: string[]) => Promise<Tag[]>
  }
  prettier: {
    format: (text: string, parser: string) => Promise<string>
  }
  /** 用户主题文件（#12 Phase 2）：userData/themes/*.json 的列举 / 激活 / 导入 */
  userTheme: {
    list: () => Promise<{
      /** '' = 不注入（内置 tokens.css） */
      active: string
      themes: ThemeDefinition[]
      rejected: Array<{ file: string; error: string }>
      dir: string
    }>
    setActive: (id: string) => Promise<{ ok: boolean; active?: string; error?: string }>
    install: () => Promise<{
      ok: boolean
      theme?: ThemeDefinition
      canceled?: boolean
      error?: string
    }>
    openDir: () => Promise<{ ok: boolean }>
    /** 订阅激活主题变更广播（多窗口同步）；返回取消订阅函数 */
    onChanged: (cb: (activeId: string) => void) => () => void
  }
  preferences: {
    getEditorSettings: () => Promise<EditorSettings>
    updateEditorSettings: (updates: Partial<EditorSettings>) => Promise<EditorSettings>
    getTheme: () => Promise<'light' | 'dark' | 'auto'>
    setTheme: (theme: 'light' | 'dark' | 'auto') => Promise<void>
    /** 订阅主题变更广播（多窗口同步，BUGS.md B4）；返回取消订阅函数 */
    onThemeChanged: (cb: (theme: 'light' | 'dark' | 'auto') => void) => () => void
    getPreferences: () => Promise<Preferences>
    isOnboardingCompleted: () => Promise<boolean>
    setOnboardingCompleted: () => Promise<void>
    resetOnboarding: () => Promise<void>
    getFavoriteModules: () => Promise<string[]>
    setFavoriteModules: (ids: string[]) => Promise<void>
    /** 兜底命令中被停用的 id 列表（V4 P0-3） */
    getFallbackDisabled: () => Promise<string[]>
    setFallbackDisabled: (ids: string[]) => Promise<void>
    /** 兜底命令的用户自定义顺序（id 列表，未收录保持默认序随后） */
    getFallbackOrder: () => Promise<string[]>
    setFallbackOrder: (ids: string[]) => Promise<void>
    /** Pop to Root 三态（immediately / afterInterval / manually） */
    getPopToRootMode: () => Promise<PopToRootMode>
    setPopToRootMode: (mode: PopToRootMode) => Promise<void>
    /** 窗口间隙（px，0-200；0 = 关闭） */
    getWindowGap: () => Promise<number>
    setWindowGap: (px: number) => Promise<void>
    /** 自动入会开关（默认关） */
    getAutoJoinEnabled: () => Promise<boolean>
    setAutoJoinEnabled: (enabled: boolean) => Promise<void>
  }
  // 截图库 OCR 索引（V4 P1-10）
  shotIndex: {
    status: () => Promise<{
      total: number
      pending: number
      done: number
      failed: number
      scanning: boolean
    }>
    scan: () => Promise<{ success: boolean; added?: number; error?: string }>
    search: (
      query: string,
      ensure?: boolean
    ) => Promise<{
      success: boolean
      items: Array<{
        filePath: string
        fileName: string
        fileSize: number
        mtime: number
        capturedAt: number
        ocrStatus: 'pending' | 'done' | 'failed'
        ocrText: string | null
      }>
    }>
    pastePath: (filePath: string) => Promise<{ ok: boolean; error?: string }>
    pasteLatest: () => Promise<{ ok: boolean; error?: string }>
    /** 索引/OCR 进度变化推送；返回取消订阅函数 */
    onChanged: (cb: () => void) => () => void
  }
  // 系统日历只读（V4 P0-1 批次4）
  calendar: {
    status: () => Promise<{ auth: 'authorized' | 'denied' | 'notDetermined' | 'unsupported' }>
    /** 触发系统日历授权弹窗（notDetermined 时用） */
    requestAccess: () => Promise<{ fired: boolean }>
    /** 下一个会议（48h 窗口内最早的非全天事件；未授权 / 无事件 next 为 null） */
    next: () => Promise<{
      auth: 'authorized' | 'denied' | 'notDetermined' | 'unsupported'
      next: {
        title: string
        startMs: number
        endMs: number
        isAllDay: boolean
        meeting: { url: string; provider: string } | null
      } | null
    }>
    /** 未来 7 天日程（含全天事件，按开始时间升序） */
    schedule: () => Promise<{
      auth: 'authorized' | 'denied' | 'notDetermined' | 'unsupported'
      events: Array<{
        title: string
        startMs: number
        endMs: number
        isAllDay: boolean
        meeting: { url: string; provider: string } | null
      }>
    }>
    /** 创建日程（写回默认日历）；失败弹系统通知并返回 ok=false */
    createEvent: (input: {
      title: string
      startMs: number
      endMs: number
    }) => Promise<{ ok: boolean; error?: string }>
  }
  // 轻量多设备同步（V4 批次6）
  dataSync: {
    status: () => Promise<{
      lastAppliedAt: number
      snapshots: number
      configured: boolean
    }>
    push: () => Promise<{ ok: boolean; decision?: 'pull' | 'push' | 'noop'; error?: string }>
    pull: () => Promise<{
      ok: boolean
      decision?: 'pull' | 'push' | 'noop'
      applied?: number
      snapshot?: string
      error?: string
    }>
  }
  // Hyper Key（V4 P1-8 方案 A）
  hyperKey: {
    getConfig: () => Promise<{
      enabled: boolean
      quickPress: 'toggle' | 'escape' | 'caps' | 'nothing'
    }>
    /** 启用/停用（即时应用/还原 hidutil 重映射） */
    setEnabled: (enabled: boolean) => Promise<{
      ok: boolean
      error?: string
      config: { enabled: boolean; quickPress: 'toggle' | 'escape' | 'caps' | 'nothing' }
    }>
    setQuickPress: (action: 'toggle' | 'escape' | 'caps' | 'nothing') => Promise<{ ok: boolean }>
  }
  usage: {
    recordUse: (moduleId: string) => Promise<void>
    getRecent: (limit?: number) => Promise<string[]>
    getStats: () => Promise<Array<{ moduleId: string; useCount: number; usedAt: number }>>
    clearRecent: () => Promise<void>
    addFavorite: (moduleId: string) => Promise<void>
    removeFavorite: (moduleId: string) => Promise<void>
    isFavorite: (moduleId: string) => Promise<boolean>
    getFavorites: () => Promise<string[]>
    toggleFavorite: (moduleId: string) => Promise<boolean>
  }
  update: {
    check: () => Promise<UpdateStatus>
    download: () => Promise<void>
    install: () => void
    getStatus: () => Promise<UpdateStatus>
    getCurrentVersion: () => Promise<string>
    onEvent: (cb: (e: UpdateEvent) => void) => () => void
  }
  system: {
    info: () => Promise<LeafSystemInfo>
    hardware: () => Promise<HardwareInfoType>
    openPath: (p: string) => Promise<boolean>
    openExternal: (url: string) => Promise<boolean>
    frontmostApp: () => Promise<string | null>
  }
  permissions: {
    probe: () => Promise<
      Array<{
        id: 'accessibility' | 'calendar' | 'screenRecording'
        label: string
        usedBy: string
        state: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' | 'unsupported'
        canRequest: boolean
        note?: string
      }>
    >
    request: (id: 'accessibility' | 'calendar' | 'screenRecording') => Promise<{
      fired: boolean
      state: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' | 'unsupported'
      note?: string
    }>
    openSettings: (
      id: 'accessibility' | 'calendar' | 'screenRecording' | 'privacy'
    ) => Promise<{ ok: boolean; error?: string }>
  }
  windows: {
    list: () => Promise<WindowInfo[]>
    activate: (pid: number, title: string) => Promise<boolean>
  }
  trash: {
    list: () => Promise<TrashItem[]>
    empty: () => Promise<boolean>
    restore: (itemPath: string) => Promise<boolean>
    delete: (itemPath: string) => Promise<boolean>
    open: () => Promise<boolean>
  }
  dictionary: {
    open: (word: string) => Promise<boolean>
    query: (word: string) => Promise<DictionaryDefinition[]>
  }
  log: {
    export: () => Promise<string | null>
    getMode: () => Promise<TelemetryMode>
    setMode: (mode: TelemetryMode) => Promise<TelemetryMode>
  }
  onAppOpenModule: (cb: (e: { moduleId: string; path: string }) => void) => () => void
  onAppGoHome: (cb: () => void) => () => void
  onAppOpenCommandPalette: (cb: () => void) => () => void
  onAppOpenSettings: (cb: () => void) => () => void
  onAppOpenAbout: (cb: () => void) => () => void
  migration: {
    listArchives: () => Promise<ArchiveInfo[]>
    deleteArchive: (archivePath: string) => Promise<{ ok: boolean; error?: string }>
    restoreArchive: (archivePath: string) => Promise<{
      ok: boolean
      restored: string[]
      errors: string[]
    }>
    exportDb: () => Promise<string | null>
    importDb: () => Promise<{ imported: boolean; filePath: string | null }>
    factoryReset: () => Promise<boolean>
  }
  /** 云端整库备份（WebDAV 加密快照）；密码不落盘，仅本次调用使用 */
  cloudBackup: {
    list: () => Promise<{
      ok: boolean
      items?: Array<{ file: string; createdAt: number; size: number }>
      configured?: boolean
      error?: string
    }>
    backup: (password: string) => Promise<{ ok: boolean; file?: string; error?: string }>
    restore: (password: string, fileName?: string) => Promise<{ ok: boolean; error?: string }>
  }
  launcher: {
    toggle: () => void
    show: () => void
    hide: () => void
    openModule: (moduleId: string, path: string) => void
    input: (value: string) => void
    /** 运行插件命令；args = 命令参数值（多参数命令，对标 Raycast launchCommand arguments） */
    openPlugin: (pluginId: string, cmd?: string, args?: Record<string, string>) => void
    closePlugin: () => void
    /** 退插件的一层视图栈（见 launcherApi.popView 的插件侧口径） */
    popPluginView: () => void
    /** 第一方内联页（Raycast 式）：外部入口唤起胶囊窗并打开对应页 */
    openFirstParty: (page: FirstPartyPage) => void
    /** 第一方内联页打开事件（主进程转发，胶囊渲染端订阅） */
    onOpenFirstParty: (cb: (page: FirstPartyPage) => void) => () => void
    /**
     * MCP 工具调用转交胶囊（P-4② 收尾）：⌘K 面板没有参数格与结果页。
     * argSpecs 是**参数清单**（排几格、哪个必填），不是值。
     */
    runMcpTool: (payload: {
      serverId: string
      serverLabel: string
      tool: string
      argSpecs: McpToolArg[]
    }) => void
    /** 胶囊侧订阅上述转交 */
    onRunMcpTool: (
      cb: (payload: {
        serverId: string
        serverLabel: string
        tool: string
        argSpecs: McpToolArg[]
      }) => void
    ) => () => void
    /** 独立模块窗已接管某路由（主窗口若正显示同路由应让位回 Hub） */
    onAppRouteTaken: (cb: (payload: { path: string }) => void) => () => void
    getPluginState: () => Promise<{
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
      headless: boolean
      attached: boolean
      /** P-2④ 第二半：插件自己的视图栈（含当前层）与「还有得退吗」 */
      viewDepth?: number
      canGoBack?: boolean
    } | null>
    /** 性能基线（M0）：胶囊唤起耗时 */
    perf: () => Promise<{ lastShowLatencyMs: number }>
    /** 保持打开（P-1.3）：钉住时失焦不隐藏，返回主进程生效值 */
    setPinned: (pinned: boolean) => Promise<{ pinned: boolean }>
    /** Quicklinks（M2.3） */
    quicklinksList: () => Promise<Array<{ id: string; name: string; url: string }>>
    quicklinksSave: (items: Array<{ id: string; name: string; url: string }>) => Promise<{
      success: boolean
      removed?: number
    }>
    /** Quicklink favicon：返回本地缓存文件路径（走 image:// 协议），失败 null */
    quicklinkFavicon: (url: string) => Promise<string | null>
    /** 插件偏好（M3.2，管理页读写） */
    getPreference: (
      pluginId: string,
      name: string
    ) => Promise<{ ok: boolean; value?: unknown; error?: string }>
    setPreference: (
      pluginId: string,
      name: string,
      value: unknown
    ) => Promise<{ ok: boolean; error?: string }>
    /** 热键配置（M4）；类型直接用主进程的唯一定义，避免这里再抄一份宽松副本 */
    hotkeysGetConfig: () => Promise<HotkeyConfig>
    /** 最近一轮注册的冲突清单（V4 P0-3：设置页冲突提示） */
    hotkeysGetConflicts: () => Promise<HotkeyConflicts>
    hotkeysSetMain: (
      accelerator: string
    ) => Promise<{ ok: boolean; config?: HotkeyConfig; error?: string }>
    hotkeysSetCommand: (
      accelerator: string,
      spec: CommandHotkeySpec | null
    ) => Promise<{ ok: boolean; config?: HotkeyConfig; registered?: string[]; error?: string }>
    /** 两段式直达（主热键后按住修饰键再按字母） */
    hotkeysSetChord: (
      letter: string,
      spec: CommandHotkeySpec | null
    ) => Promise<{ ok: boolean; config?: HotkeyConfig; error?: string }>
    /** 片段文本扩展（M5.1）配置 / 权限诊断 */
    expansionGetConfig: () => Promise<{
      enabled: boolean
      triggerCount: number
      hookAvailable: boolean
    }>
    expansionSetConfig: (patch: { enabled?: boolean }) => Promise<{ enabled: boolean }>
    expansionProbe: () => Promise<{ received: boolean; timeoutMs: number; hookAvailable: boolean }>
    listPlugins: () => Promise<
      Array<{
        id: string
        name: string
        version?: string
        description?: string
        enabled: boolean
        commands?: Array<{ code: string; title: string; description?: string }>
      }>
    >
    installFromFolder: (dirPath: string) => Promise<{
      success: boolean
      error?: string
      plugin?: { id: string; name: string }
    }>
    /** 插件市场：打包索引 + 可选远程索引（P-3.1） */
    marketList: () => Promise<
      Array<{
        id: string
        name: string
        version?: string
        description?: string
        author?: string
        download: string
        /** 索引声明的包体摘要；缺省 = 安装时不校验 */
        sha256?: string
        installed: boolean
        installedVersion?: string
        updatable: boolean
      }>
    >
    marketIndexInfo: () => Promise<{
      localFile: string
      remoteUrl: string
      remoteFetchedAt: number | null
      remoteCount: number
      shadowed: string[]
    }>
    marketSetIndexUrl: (url: string) => Promise<{ ok: boolean; error?: string }>
    marketRefreshIndex: () => Promise<{
      ok: boolean
      count: number
      shadowed: string[]
      fetchedAt?: number
      error?: string
    }>
    marketInstall: (entryId: string) => Promise<{
      success: boolean
      error?: string
      plugin?: { id: string; name: string }
    }>
    /** 市场版本更新：覆盖安装最新版 */
    marketUpdate: (entryId: string) => Promise<{
      success: boolean
      error?: string
      plugin?: { id: string; name: string }
    }>
    /** 插件开发模式（本地目录 link + 文件 watcher 热重载） */
    devPluginsList: () => Promise<
      Array<{
        pluginId: string
        sourceDir: string
        autoReload: boolean
        name?: string
        version?: string
        installed: boolean
        sourceExists: boolean
        manifestValid: boolean
      }>
    >
    devPluginsAdd: (dirPath: string) => Promise<{
      ok: boolean
      error?: string
      plugin?: { id: string; name: string }
    }>
    devPluginsRemove: (pluginId: string) => Promise<{ ok: boolean; error?: string }>
    devPluginsSetAutoReload: (
      pluginId: string,
      autoReload: boolean
    ) => Promise<{ ok: boolean; error?: string }>
    devPluginsReload: (pluginId: string) => Promise<{
      ok: boolean
      error?: string
      plugin?: { id: string; name: string }
    }>
    /** 开发插件变更推送（重装/重载/错误），管理页刷新 + toast */
    onDevPluginsChanged: (
      cb: (payload: {
        kind: 'added' | 'removed' | 'reloaded' | 'error'
        pluginId: string
        name?: string
        error?: string
      }) => void
    ) => () => void
    removePlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>
    /** 打开插件视图的独立 DevTools 窗口（插件需处于打开状态） */
    pluginDevtools: (pluginId: string) => Promise<{ success: boolean; error?: string }>
    setPluginEnabled: (
      pluginId: string,
      enabled: boolean
    ) => Promise<{ success: boolean; plugin?: unknown }>
    selectPluginFolder: () => Promise<{
      success: boolean
      canceled?: boolean
      dirPath?: string
    }>
    openPluginsDir: () => void
    syncGetConfig: () => Promise<{
      url: string
      username: string
      password: string
      remoteDir: string
    }>
    syncSetConfig: (config: SyncConfig) => Promise<{ success: boolean }>
    syncTest: (configOverride?: SyncConfig | null) => Promise<{ ok: boolean; error?: string }>
    syncBackup: () => Promise<{ ok: boolean; count?: number; error?: string }>
    syncRestore: () => Promise<{ ok: boolean; count?: number; error?: string }>
    onShown: (cb: () => void) => () => void
    onPluginChanged: (
      cb: (state: {
        open: boolean
        pluginId: string | null
        pluginName: string | null
        subInputPlaceholder: string | null
        declaredList?: unknown
        declaredForm?: unknown
        /** P-2.6：与 launcher:getPluginState 同形（快照是同一份数据，两处别再漂） */
        declaredLoading?: boolean
        declaredEmptyMessage?: string | null
        headless?: boolean
        attached?: boolean
        /** P-2④ 第二半：插件视图栈的栈深与「可退」 */
        viewDepth?: number
        canGoBack?: boolean
      }) => void
    ) => () => void
    /** #11 M2：React 表单视图提交（值经 Callback 钩子回传插件 onSubmit）；
     * 表单/列表都随 onPluginChanged 的整份快照下发，无独立推送通道 */
    pluginFormSubmit: (
      values: Record<string, string | boolean>
    ) => Promise<{ ok: boolean; error?: string }>
    /** #5 插件双通道：searchable 插件持久化条目合并读取（仅已启用 + searchable 插件） */
    pluginSearchList: () => Promise<
      Array<{
        title: string
        subtitle?: string
        icon?: string
        keywords?: string[]
        badge?: string
        action: { type: 'copy' | 'open' | 'callback'; payload?: string }
        pluginId: string
      }>
    >
    /** searchable 插件提交新条目集时推送（胶囊刷新合并缓存） */
    onPluginSearchIndexUpdated: (cb: () => void) => () => void
    /** 执行声明式条目的 callback 动作（copy/open 由胶囊本地执行） */
    /**
     * 命令表变了（插件装/卸/启停、MCP 工具清单变化）。回调带上**是哪一路**，
     * 渲染端只重拉那一路 —— 全量重刷会把用户的选中位反复归零。
     */
    onCommandTableChanged: (cb: (source: 'plugins' | 'mcp') => void) => () => void
    runPluginAction: (
      pluginId: string,
      itemIndex: number,
      actionIndex: number
    ) => Promise<{ ok: boolean; error?: string }>
  }
  /** 统一动作执行端（#4：与窗口无关的动作由 main 注册表分发） */
  action: {
    invoke: (action: MainAction) => Promise<{ ok: boolean; error?: string }>
  }
  /** 文件索引（#9，macOS / Windows） */
  fileIndex: {
    status: () => Promise<{
      status: 'disabled' | 'scanning' | 'ready' | 'capped' | 'error'
      files: number
      scopes: string[]
      lastFullScan: number | null
      error: string | null
      hidden: boolean
      /** 本次扫描读不到的范围（外接卷未挂载等）；不视为整体失败，管理页点名提示 */
      unavailable: Array<{ root: string; reason: string }>
    }>
    addScope: () => Promise<{ ok: boolean; scopes?: string[]; canceled?: boolean }>
    removeScope: (dir: string) => Promise<{ ok: boolean; scopes: string[] }>
    rebuild: () => Promise<{ ok: boolean }>
    setHidden: (value: boolean) => Promise<void>
  }
  /** 剪贴板历史（胶囊内联页数据源；持久化 + 置顶 + 文件/链接类型） */
  clipHist: {
    /** 条目形状直接取服务层定义：此前这里是手抄副本，少抄了 sourceApp/ocrText/ocrStatus */
    list: () => Promise<ClipboardHistoryItem[]>
    copy: (id: string) => Promise<boolean>
    remove: (id: string) => Promise<boolean>
    clear: () => Promise<boolean>
    togglePin: (id: string) => Promise<boolean>
    /** P0-3：设置条目备注关键词（补充索引，搜索可命中）；空数组清除 */
    setKeywords: (id: string, keywords: string[]) => Promise<boolean>
    getEnabled: () => Promise<{ enabled: boolean; supported: boolean }>
    setEnabled: (on: boolean) => Promise<{ enabled: boolean; supported: boolean }>
    /** 复制并向前台应用粘贴（收起胶囊 → ⌘V）；未授权时退化为仅复制 */
    pasteBack: (id: string) => Promise<{ ok: boolean; error?: string }>
    /** 识别图片条目中的二维码，文本回填剪贴板；无二维码时 ok=false */
    decodeQr: (id: string) => Promise<{ ok: boolean; text?: string; error?: string }>
    /** P1-6：敏感应用屏蔽列表 */
    getBlockedApps: () => Promise<string[]>
    setBlockedApps: (apps: string[]) => Promise<string[]>
    /** P1-6：依次粘贴 */
    startPasteSequence: (id: string) => Promise<{ ok: boolean; count?: number; error?: string }>
    pasteNext: () => Promise<{ ok: boolean; hasMore: boolean; error?: string }>
  }
  /** AI 服务（P0-3：OpenAI 兼容 API + 流式响应 + 对话历史 + 模型预设） */
  ai: {
    /** 全部取 src/shared/ai.ts 的真类型：此前这里是手抄副本 + Record<string, unknown> 擦除，
     *  渲染端传错形状（如 saveSession 少 id/createdAt）编译期完全看不出来 */
    getConfig: () => Promise<AIConfig>
    setConfig: (patch: Partial<AIConfig>) => Promise<AIConfig>
    isConfigured: () => Promise<boolean>
    listModels: () => Promise<{
      ok: boolean
      models: string[]
      error?: string
      url?: string
    }>
    /** MCP 客户端最小面（P-4②） */
    mcpOverview: () => Promise<McpOverview>
    /** 工具清单缓存 → 根搜索命令行（P-4② 收尾，纯读缓存不 spawn） */
    mcpToolCommands: () => Promise<McpToolCommand[]>
    /** 从搜索框/⌘K 跑一个工具：参数值是字符串，类型由主进程按 schema 定 */
    mcpRunTool: (payload: {
      id: string
      tool: string
      args: Record<string, string>
    }) => Promise<McpCallResult>
    mcpSetServers: (servers: unknown) => Promise<{
      servers: McpServerPublic[]
      rejected: Array<{ index: number; reason: string }>
    }>
    mcpConnect: (id: string) => Promise<McpServerView>
    mcpStop: (id: string) => Promise<boolean>
    mcpCallTool: (
      id: string,
      tool: string,
      args: Record<string, unknown>
    ) => Promise<{ ok: boolean; text: string; ignoredContent: number; error?: string }>
    // ── Automations（P-4④）：设置页读写与「现在跑一次」──
    automationList: () => Promise<AutomationTaskView[]>
    automationSave: (tasks: unknown) => Promise<{
      tasks: AutomationTaskView[]
      rejected: Array<{ index: number; reason: string }>
    }>
    automationRunNow: (id: string) => Promise<{ ok: boolean; error?: string }>
    automationSetEnabled: (id: string, enabled: boolean) => Promise<AutomationTaskView[]>
    chat: (
      sessionId: string,
      messages: AIChatMessage[]
    ) => Promise<{ ok: boolean; text?: string; error?: string }>
    onStreamChunk: (
      cb: (payload: { sessionId: string; delta: string; done: boolean; error?: string }) => void
    ) => () => void
    /** 对话历史 */
    listSessions: () => Promise<AIChatSession[]>
    getSession: (id: string) => Promise<AIChatSession | null>
    saveSession: (session: AIChatSession) => Promise<AIChatSession>
    deleteSession: (id: string) => Promise<boolean>
    clearSessions: () => Promise<boolean>
    /** 模型预设 */
    listPresets: () => Promise<AIModelPreset[]>
    savePreset: (preset: AIModelPreset) => Promise<AIModelPreset[]>
    deletePreset: (id: string) => Promise<AIModelPreset[]>
    applyPreset: (id: string) => Promise<AIConfig | null>
  }
  /** 轻量笔记（Notes） */
  notes: {
    /** 全部取 NotesRepository 的真类型（此前 list/get 手抄了 8 字段副本、
     *  create/update/togglePin 擦成 Record<string, unknown> / unknown，渲染端传错形状看不出来） */
    list: (filter?: NoteFilter) => Promise<Note[]>
    get: (id: string) => Promise<Note | null>
    create: (data: Parameters<typeof notesRepository.addNote>[0]) => Promise<Note>
    update: (
      id: string,
      updates: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'isPinned'>>
    ) => Promise<Note | undefined>
    trash: (id: string) => Promise<boolean>
    restore: (id: string) => Promise<boolean>
    delete: (id: string) => Promise<boolean>
    emptyTrash: () => Promise<number>
    togglePin: (id: string) => Promise<Note | undefined>
    stats: () => Promise<{ total: number; trash: number; pinned: number }>
    folders: () => Promise<NoteFolder[]>
    createFolder: (name: string) => Promise<NoteFolder>
    renameFolder: (id: string, name: string) => Promise<NoteFolder | undefined>
    deleteFolder: (id: string) => Promise<boolean>
  }
  /** 提醒事项（Reminders） */
  reminders: {
    list: (filter?: ReminderFilter) => Promise<Reminder[]>
    get: (id: string) => Promise<Reminder | null>
    create: (data: {
      title: string
      notes?: string
      dueAt?: number | null
      remindAt?: number | null
    }) => Promise<unknown>
    update: (
      id: string,
      patch: {
        title?: string
        notes?: string
        dueAt?: number | null
        remindAt?: number | null
      }
    ) => Promise<unknown>
    complete: (id: string) => Promise<unknown>
    uncomplete: (id: string) => Promise<unknown>
    remove: (id: string) => Promise<boolean>
    countActive: () => Promise<number>
  }
  /** 浮动笔记（Floating Notes） */
  floatingNote: {
    toggle: () => Promise<boolean>
    show: () => Promise<boolean>
    hide: () => Promise<boolean>
    isVisible: () => Promise<boolean>
  }
  /** 命令别名（P2-8：用户自定义别名，搜索时匹配） */
  alias: {
    getAll: () => Promise<Record<string, string[]>>
    get: (commandKey: string) => Promise<string[]>
    set: (commandKey: string, alias: string) => Promise<boolean>
    remove: (commandKey: string, alias: string) => Promise<boolean>
  }
  /** 搜索历史（P2-9：空查询时展示最近搜索） */
  searchHistory: {
    get: () => Promise<string[]>
    add: (query: string) => Promise<string[]>
    clear: () => Promise<boolean>
  }
  /** 浏览器标签（P1-5：Chrome/Safari 标签搜索与切换，macOS） */
  browserTabs: {
    list: () => Promise<{
      ok: boolean
      tabs: Array<{
        id: string
        browser: 'chrome' | 'safari'
        title: string
        url: string
        windowId: number
        tabIndex: number
      }>
      supported: boolean
    }>
    activate: (tab: BrowserTab) => Promise<{ ok: boolean; error?: string }>
  }
  /** 系统命令 / 窗口管理（M2） */
  sysCmd: {
    run: (id: string) => Promise<{ ok: boolean; error?: string }>
    ids: () => Promise<{ system: string[]; window: string[] }>
  }
  /** 文件搜索（M5.3，mac mdfind） */
  fileSearch: {
    query: (
      q: string,
      limit?: number,
      opts?: { mode?: 'name' | 'content'; onlyIn?: string }
    ) => Promise<{
      ok: boolean
      supported: boolean
      items: Array<{ path: string; name: string; dir: string }>
      /** 结果来自哪条链路：自建索引 / mdfind 回退 / PowerShell 回退（#9 设计 §6） */
      source?: 'index' | 'mdfind' | 'powershell'
      error?: string
    }>
    reveal: (filePath: string) => Promise<{ ok: boolean }>
  }
  /** 专注护盾（应用屏蔽） */
  focusShield: {
    getConfig: () => Promise<ReturnType<typeof focusShield.getConfig>>
    setConfig: (
      patch: Parameters<typeof focusShield.setConfig>[0]
    ) => Promise<ReturnType<typeof focusShield.setConfig>>
    /** 番茄钟桥上报：工作计时进行中 */
    setActive: (active: boolean) => Promise<boolean>
    temporaryAllow: () => Promise<boolean>
    currentState: () => Promise<ReturnType<typeof focusShield.currentState>>
    /** 推送载荷与 currentState 同源（此前手抄少了 kind/url） */
    onInfo: (
      callback: (payload: NonNullable<ReturnType<typeof focusShield.currentState>>) => void
    ) => () => void
  }
  folder: {
    getFolders: () => Promise<Folder[]>
    getFolderTree: () => Promise<FolderWithChildren[]>
    getFolderById: (id: string) => Promise<Folder | undefined>
    getFoldersByParentId: (parentId: string | null) => Promise<Folder[]>
    addFolder: (folder: {
      name: string
      parentId?: string | null
      icon?: string | null
      defaultLanguage?: string
      isOpen?: boolean
    }) => Promise<Folder>
    updateFolder: (
      id: string,
      updates: Partial<{
        name: string
        parentId: string | null
        icon: string | null
        defaultLanguage: string
        isOpen: boolean
        orderIndex: number
      }>
    ) => Promise<Folder | undefined>
    deleteFolder: (id: string) => Promise<boolean>
    updateFolderOrder: (
      folderId: string,
      newParentId: string | null,
      newOrderIndex: number
    ) => Promise<boolean>
    canMoveFolder: (folderId: string, targetParentId: string | null) => Promise<boolean>
    /** 通用另存为对话框（导出类通道的写盘路径由此签发） */
    selectSavePath: (req?: {
      defaultName?: string
      filters?: { name: string; extensions: string[] }[]
    }) => Promise<string | null>
  }
  createNewWindow: (route: string) => Promise<boolean>
  onNavigateToRoute: (callback: (route: string) => void) => () => void
  // 屏幕录制相关 API
  screenRecorder: {
    getSources: (options: Electron.SourcesOptions) => Promise<
      Array<{
        id: string
        name: string
        thumbnail: string
      }>
    >
    selectSavePath: () => Promise<string | null>
    getDefaultSavePath: () => Promise<string>
    saveFile: (
      filePath: string,
      buffer: Uint8Array,
      duration?: number,
      recordingId?: string
    ) => Promise<{ success: boolean; error?: string; filePath?: string; historyId?: string }>
    /** 分片流式写盘：开始一个写入会话（长录制避免整段视频驻留内存） */
    beginWrite: (filePath: string) => Promise<{ ok: boolean; error?: string }>
    appendChunk: (filePath: string, chunk: Uint8Array) => Promise<{ ok: boolean; error?: string }>
    endWrite: (
      filePath: string,
      duration?: number,
      recordingId?: string
    ) => Promise<{ success: boolean; error?: string; filePath?: string; historyId?: string }>
    /** 中止分片写盘会话（丢弃半截文件，不写历史） */
    abortWrite: (filePath: string) => Promise<{ ok: boolean }>
    requestPermission: () => Promise<{ success: boolean; message?: string }>
    checkPermission: () => Promise<{ hasPermission: boolean; message?: string }>
  }
  // 录制历史相关 API
  recordingHistory: {
    getHistory: () => Promise<RecordingHistory[]>
    getHistoryByDateRange: (start: number, end: number) => Promise<RecordingHistory[]>
    addHistory: (recording: {
      filename: string
      filePath: string
      duration: number
      fileSize: number
      thumbnail?: string
    }) => Promise<RecordingHistory>
    deleteHistory: (id: string) => Promise<boolean>
    clearHistory: () => Promise<void>
    generateThumbnail: (videoPath: string) => Promise<string | null>
    updateThumbnail: (id: string) => Promise<string | null>
    getStatistics: () => Promise<{
      total: number
      totalSize: number
      totalDuration: number
      oldestDate: number | null
      newestDate: number | null
    }>
    openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
    showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>
  }
  recordingSettings: {
    getSettings: () => Promise<RecordingSettings>
    updateSettings: (updates: Partial<RecordingSettings>) => Promise<RecordingSettings>
    resetToDefaults: () => Promise<RecordingSettings>
    getQualityPreset: (
      quality: 'low' | 'medium' | 'high'
    ) => Promise<Partial<RecordingSettings> | null>
  }
  // 标记相关 API
  marker: {
    addMarker: (recordingId: string, timestamp: number, label?: string) => Promise<Marker>
    removeMarker: (recordingId: string, markerId: string) => Promise<boolean>
    getMarkers: (recordingId: string) => Promise<Marker[]>
    updateMarker: (
      recordingId: string,
      markerId: string,
      updates: Partial<Marker>
    ) => Promise<Marker | null>
    clearMarkers: (recordingId: string) => Promise<void>
    exportToCSV: (recordingId: string) => Promise<string>
  }
  // 视频剪辑相关 API
  clip: {
    addClip: (videoId: string, startTime: number, endTime: number, label?: string) => Promise<Clip>
    removeClip: (videoId: string, clipId: string) => Promise<boolean>
    updateClip: (videoId: string, clipId: string, updates: Partial<Clip>) => Promise<Clip | null>
    getClips: (videoId: string) => Promise<Clip[]>
    clearClips: (videoId: string) => Promise<void>
    previewClip: (videoPath: string, clip: Clip) => Promise<string>
    exportClips: (
      videoPath: string,
      options: ClipExportOptions
    ) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>
    getVideoInfo: (videoPath: string) => Promise<{
      duration: number
      width: number
      height: number
      fps: number
    }>
    onExportProgress: (
      callback: (progress: {
        percent: number
        currentClip: number
        totalClips: number
        message: string
      }) => void
    ) => () => void
    removeExportProgressListener: () => void
    selectVideoFile: () => Promise<string | null>
    selectAudioFile: () => Promise<string | null>
    selectSavePath: () => Promise<string | null>
  }
  // 通知相关 API
  notification: {
    // 通用通知
    show: (
      type: NotificationType,
      title: string,
      body: string,
      options?: NotificationOptions
    ) => Promise<number>
    // 番茄钟通知
    pomodoro: (
      type: 'start' | 'break' | 'complete' | 'pause' | 'remind',
      message?: string
    ) => Promise<number>
    // 屏幕录制通知
    recording: (type: 'start' | 'stop' | 'error', message?: string) => Promise<number>
    // 信息通知
    info: (title: string, body: string, options?: NotificationOptions) => Promise<number>
    // 成功通知
    success: (title: string, body: string, options?: NotificationOptions) => Promise<number>
    // 警告通知
    warning: (title: string, body: string, options?: NotificationOptions) => Promise<number>
    // 错误通知
    error: (title: string, body: string, options?: NotificationOptions) => Promise<number>
    // 关闭通知
    close: (id: number) => Promise<void>
    // 关闭所有通知
    closeAll: () => Promise<void>
    /** 订阅通知点击/关闭事件（BUGS.md B10）；返回取消订阅函数 */
    onEvent: (cb: (e: { id: number; kind: 'click' | 'close' }) => void) => () => void
  }
  /**
   * 1.0 录制新通道（SQLite repos）
   *
   * 注意：运行时挂载在 `window.api.recording`（preload 只在 exposeInMainWorld
   * 里暴露了 'api'，没有暴露顶层的 'recording'）。此前本字段被错误地声明在
   * Window 接口上，导致所有调用点只能用 `as unknown as` 强转绕过。
   */
  recording: RecordingAPI
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
    api: API
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
