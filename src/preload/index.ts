import { contextBridge, ipcRenderer } from 'electron'
import type { API, PomodoroTraySnapshot, TelemetryMode } from './index.d'
import type { UpdateEvent } from '../renderer/src/types/update'
import type { FirstPartyPage } from '../shared/commands'
import type { McpToolArg } from '../shared/mcp'
import type { PopToRootMode } from '../shared/popToRoot'
import type { Density } from '../shared/density'
import type { CapsuleGlass } from '../shared/capsuleGlass'
import { typedInvoke } from './typedIpc'
import type { CommandHotkeySpec } from '../main/launcher/hotkeys'
import type { ExpansionConfig } from '../main/modules/textExpansion'

// Re-export types for renderer process
export type {
  Application,
  Snippet,
  SnippetContent,
  Tag,
  EditorSettings,
  Preferences,
  Folder,
  RecordingHistory,
  RecordingSettings,
  Marker,
  TelemetryMode
} from './index.d'

// Custom APIs for renderer（类型契约见 ./index.d.ts 的 API 接口）
const api: API = {
  // 应用搜索相关 API
  getApplications: () => typedInvoke('get-applications'),
  refreshApplications: () => typedInvoke('refresh-applications'),
  /** 应用包元数据（胶囊详情面板异步取，只在选中应用行时调用） */
  readAppInfo: (appPath: string) => typedInvoke('applications:readInfo', { appPath }),
  launchApplication: (appPath: string) => typedInvoke('launch-application', { appPath }),
  /** 本 webContents 是否为主窗口（App 级单例只在主窗口初始化） */
  isPrimaryWindow: () => typedInvoke('app:isPrimaryWindow') as Promise<boolean>,
  // ⌘R 刷新应用列表（主进程 watcher 拦截按键后转发；返回取消订阅函数）
  onRefreshApplications: (cb: () => void): (() => void) => {
    const l = (): void => cb()
    ipcRenderer.on('app:refresh-applications', l)
    return () => ipcRenderer.removeListener('app:refresh-applications', l)
  },
  // 番茄钟相关 API
  pomodoro: {
    // 任务管理
    getTasks: () => typedInvoke('pomodoro:getTasks'),
    addTask: (title: string, options?) => typedInvoke('pomodoro:addTask', { title, options }),
    updateTask: (id: string, updates) => typedInvoke('pomodoro:updateTask', { id, updates }),
    deleteTask: (id: string) => typedInvoke('pomodoro:deleteTask', { id }),
    completeTask: (id: string) => typedInvoke('pomodoro:completeTask', { id }),
    // 项目管理
    projects: {
      getAll: () => typedInvoke('pomodoro:projects:getAll'),
      add: (name: string, color?: string) => typedInvoke('pomodoro:projects:add', { name, color }),
      update: (id: string, updates) => typedInvoke('pomodoro:projects:update', { id, updates }),
      delete: (id: string) => typedInvoke('pomodoro:projects:delete', { id }),
      settings: {
        get: (projectId: string) => typedInvoke('pomodoro:projects:settings:get', { projectId }),
        all: () => typedInvoke('pomodoro:projects:settings:all'),
        save: (projectId: string, overrides) =>
          typedInvoke('pomodoro:projects:settings:save', { projectId, overrides }),
        delete: (projectId: string) =>
          typedInvoke('pomodoro:projects:settings:delete', { projectId })
      }
    },
    // M14 / M15：每项目 timer state 持久化
    timerState: {
      getAll: () => typedInvoke('pomodoro:timerState:getAll'),
      get: (projectId: string) => typedInvoke('pomodoro:timerState:get', { projectId }),
      save: (projectId: string, state) =>
        typedInvoke('pomodoro:timerState:save', { projectId, state }),
      delete: (projectId: string) => typedInvoke('pomodoro:timerState:delete', { projectId })
    },
    // 记录管理
    addRecord: (record) => typedInvoke('pomodoro:addRecord', { record }),
    getRecords: () => typedInvoke('pomodoro:getRecords'),
    getTodayRecords: () => typedInvoke('pomodoro:getTodayRecords'),
    getFreeRecords: () => typedInvoke('pomodoro:getFreeRecords'),
    getRecordsByRange: (opts: { from: number; to: number; projectId?: string | null }) =>
      typedInvoke('pomodoro:getRecordsByRange', opts),
    getThisWeekRecords: () => typedInvoke('pomodoro:getThisWeekRecords'),
    getThisMonthRecords: () => typedInvoke('pomodoro:getThisMonthRecords'),
    getStatistics: () => typedInvoke('pomodoro:getStatistics'),
    // P1-1：详情页
    task: {
      detail: (taskId: string) => typedInvoke('pomodoro:task:detail', { taskId }),
      export: (format: 'csv' | 'markdown', fileBaseName: string, payload) =>
        typedInvoke('pomodoro:task:export', { format, fileBaseName, payload })
    },
    record: {
      get: (id: string) => typedInvoke('pomodoro:record:get', { id }),
      updateNote: (id: string, note: string) =>
        typedInvoke('pomodoro:record:updateNote', { id, note })
    },
    // P2-7：Todoist 任务集成
    todoist: {
      getToken: () => typedInvoke('pomodoro:todoist:getToken'),
      setToken: (token: string) => typedInvoke('pomodoro:todoist:setToken', { token }),
      importTasks: () => typedInvoke('pomodoro:todoist:import'),
      complete: (externalId: string) => typedInvoke('pomodoro:todoist:complete', { externalId })
    },
    // 集成（P0-4）
    integration: {
      getMode: () => typedInvoke('pomodoro:integration:getMode'),
      setMode: (mode: 'normal' | 'strong' | 'silent') =>
        typedInvoke('pomodoro:integration:setMode', { mode }),
      testNotification: () => typedInvoke('pomodoro:integration:testNotification'),
      notify: (event: 'start' | 'break' | 'complete' | 'pause' | 'remind', message?: string) =>
        typedInvoke('pomodoro:integration:notify', { event, message }),
      getShortcuts: () => typedInvoke('pomodoro:integration:getShortcuts'),
      setShortcut: (action: 'toggle' | 'skip' | 'reset', accelerator: string) =>
        typedInvoke('pomodoro:integration:setShortcut', { action, accelerator }),
      resetShortcuts: () => typedInvoke('pomodoro:integration:resetShortcuts'),
      updateTraySnapshot: (patch) =>
        typedInvoke('pomodoro:integration:updateTraySnapshot', { patch }),
      getTraySnapshot: () => typedInvoke('pomodoro:integration:getTraySnapshot'),
      // B5 修复：主进程只有收到 subscribeSnapshot 才开始推送 traySnapshot
      // （src/main/modules/pomodoro.ts ipcMain.on('pomodoro:integration:subscribeSnapshot')），
      // 旧版 preload 未暴露本方法导致推送永不发生 → 悬浮窗只能本地估算
      subscribeSnapshot: () => ipcRenderer.send('pomodoro:integration:subscribeSnapshot'),
      describeTraySnapshot: () => typedInvoke('pomodoro:integration:describeTraySnapshot'),
      setFocusMode: (enabled: boolean) =>
        typedInvoke('pomodoro:integration:setFocusMode', { enabled }),
      getFocusMode: () => typedInvoke('pomodoro:integration:getFocusMode'),
      onTraySnapshot: (cb) => {
        const listener = (_e: Electron.IpcRendererEvent, payload: PomodoroTraySnapshot): void =>
          cb(payload)
        ipcRenderer.on('pomodoro:integration:traySnapshot', listener)
        return () => ipcRenderer.removeListener('pomodoro:integration:traySnapshot', listener)
      },
      onShortcut: (cb: (event: { action: 'toggle' | 'skip' | 'reset' }) => void) => {
        const listener = (
          _e: Electron.IpcRendererEvent,
          payload: { action: 'toggle' | 'skip' | 'reset' }
        ): void => cb(payload)
        ipcRenderer.on('pomodoro:shortcut', listener)
        return () => ipcRenderer.removeListener('pomodoro:shortcut', listener)
      },
      onFocusProject: (cb: (event: { projectId: string }) => void) => {
        const listener = (_e: Electron.IpcRendererEvent, payload: { projectId: string }): void =>
          cb(payload)
        ipcRenderer.on('pomodoro:focusProject', listener)
        return () => ipcRenderer.removeListener('pomodoro:focusProject', listener)
      },
      updateProjects: (
        projects: Array<{ id: string; name: string; isActive: boolean }>,
        focusedProjectId: string | null
      ) => typedInvoke('pomodoro:integration:updateProjects', { projects, focusedProjectId })
    },
    // M5：迷你悬浮窗
    mini: {
      show: () => typedInvoke('pomodoro:mini:show'),
      hide: () => typedInvoke('pomodoro:mini:hide'),
      toggle: () => typedInvoke('pomodoro:mini:toggle'),
      isVisible: () => typedInvoke('pomodoro:mini:isVisible')
    },
    // 远程快捷键：胶囊「开始专注」内联页等外部入口触发（与全局快捷键同链路）
    dispatchShortcut: (action: 'toggle' | 'skip' | 'reset') =>
      typedInvoke('pomodoro:dispatchShortcut', { action }),
    // 统计扩展
    stats: {
      getDailyTrend: (days: number, endDate?: number) =>
        typedInvoke('pomodoro:stats:dailyTrend', { days, endDate }),
      getProjectDistribution: (from: number, to: number) =>
        typedInvoke('pomodoro:stats:projectDistribution', { from, to }),
      getFocusHeatmap: (days: number, endDate?: number) =>
        typedInvoke('pomodoro:stats:focusHeatmap', { days, endDate }),
      getTaskCompletionStats: (from: number, to: number) =>
        typedInvoke('pomodoro:stats:taskCompletionStats', { from, to })
    },
    // 设置管理
    getSettings: () => typedInvoke('pomodoro:getSettings'),
    saveSettings: (settings) => typedInvoke('pomodoro:saveSettings', { settings })
  },
  // 代码片段相关 API
  snippet: {
    getSnippets: (filters?) => typedInvoke('snippet:getSnippets', { filters }),
    getSnippetById: (id: string) => typedInvoke('snippet:getSnippetById', { id }),
    addSnippet: (snippet) => typedInvoke('snippet:addSnippet', snippet),
    updateSnippet: (id: string, updates) => typedInvoke('snippet:updateSnippet', { id, updates }),
    deleteSnippet: (id: string) => typedInvoke('snippet:deleteSnippet', { id }),
    permanentlyDeleteSnippet: (id: string) =>
      typedInvoke('snippet:permanentlyDeleteSnippet', { id }),
    restoreSnippet: (id: string) => typedInvoke('snippet:restoreSnippet', { id }),
    duplicateSnippet: (id: string) => typedInvoke('snippet:duplicateSnippet', { id }),
    getStatistics: () => typedInvoke('snippet:getStatistics'),
    emptyTrash: () => typedInvoke('snippet:emptyTrash'),
    /** B3：导出全部片段为 JSON 文件（弹出保存对话框） */
    exportAll: () => typedInvoke('snippet:exportAll'),
    /** B3：从 JSON 文件导入片段（弹出选择对话框，同 id 去重合并） */
    importFile: () => typedInvoke('snippet:importFile')
  },
  // 标签相关 API
  tag: {
    getTags: () => typedInvoke('tag:getTags'),
    getTagById: (id: string) => typedInvoke('tag:getTagById', { id }),
    addTag: (name: string, opts?) => typedInvoke('tag:addTag', { name, opts }),
    updateTag: (id: string, updates) => typedInvoke('tag:updateTag', { id, updates }),
    deleteTag: (id: string) => typedInvoke('tag:deleteTag', { id }),
    getTagsByIds: (ids: string[]) => typedInvoke('tag:getTagsByIds', { ids })
  },
  // Prettier 格式化 API
  prettier: {
    format: (text: string, parser: string) => typedInvoke('prettier:format', { text, parser })
  },
  // 用户主题文件（#12 Phase 2：userData/themes/*.json）
  userTheme: {
    list: () => typedInvoke('userTheme:list'),
    setActive: (id: string) => typedInvoke('userTheme:setActive', { id }),
    install: () => typedInvoke('userTheme:install'),
    openDir: () => typedInvoke('userTheme:openDir'),
    onChanged: (cb: (activeId: string) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, id: string): void => cb(id)
      ipcRenderer.on('userTheme:changed', listener)
      return () => ipcRenderer.removeListener('userTheme:changed', listener)
    }
  },
  // 偏好设置 API
  preferences: {
    getEditorSettings: () => typedInvoke('preferences:getEditorSettings'),
    updateEditorSettings: (updates) => typedInvoke('preferences:updateEditorSettings', updates),
    getTheme: () => typedInvoke('preferences:getTheme'),
    setTheme: (theme: 'light' | 'dark' | 'auto') => typedInvoke('preferences:setTheme', { theme }),
    // B4 修复：订阅主进程的主题广播（多窗口主题同步）
    onThemeChanged: (cb: (theme: 'light' | 'dark' | 'auto') => void) => {
      const listener = (_e: Electron.IpcRendererEvent, t: 'light' | 'dark' | 'auto'): void => cb(t)
      ipcRenderer.on('theme:changed', listener)
      return () => ipcRenderer.removeListener('theme:changed', listener)
    },
    getPreferences: () => typedInvoke('preferences:getPreferences'),
    // onboarding 状态（首次启动引导）
    isOnboardingCompleted: () => typedInvoke('preferences:isOnboardingCompleted'),
    setOnboardingCompleted: () => typedInvoke('preferences:setOnboardingCompleted'),
    resetOnboarding: () => typedInvoke('preferences:resetOnboarding'),
    // 用户选的常用模块（onboarding 步骤 3 写入）
    getFavoriteModules: () => typedInvoke('preferences:getFavoriteModules'),
    setFavoriteModules: (ids: string[]) => typedInvoke('preferences:setFavoriteModules', { ids }),
    // 兜底命令启停（V4 P0-3）
    getFallbackDisabled: () => typedInvoke('preferences:getFallbackDisabled'),
    setFallbackDisabled: (ids: string[]) => typedInvoke('preferences:setFallbackDisabled', { ids }),
    // 兜底命令自定义顺序（V4 P0-3）
    getFallbackOrder: () => typedInvoke('preferences:getFallbackOrder'),
    setFallbackOrder: (ids: string[]) => typedInvoke('preferences:setFallbackOrder', { ids }),
    // Pop to Root 三态（V4 P0-3）
    getPopToRootMode: () => typedInvoke('preferences:getPopToRootMode'),
    setPopToRootMode: (mode: PopToRootMode) =>
      typedInvoke('preferences:setPopToRootMode', { mode }),
    getWindowGap: () => typedInvoke('preferences:getWindowGap'),
    setWindowGap: (px: number) => typedInvoke('preferences:setWindowGap', { px }),
    getAutoJoinEnabled: () => typedInvoke('preferences:getAutoJoinEnabled'),
    setAutoJoinEnabled: (enabled: boolean) =>
      typedInvoke('preferences:setAutoJoinEnabled', { enabled }),
    // 密度档 / 玻璃档 / 紧凑模式（P-6）：都是「一处改完别的窗口要立刻跟上」的档，
    // 所以每档三件套 get + set + on…Changed（订阅函数返回取消订阅，与 onThemeChanged 同形）
    getDensity: () => typedInvoke('preferences:getDensity'),
    setDensity: (density: string) => typedInvoke('preferences:setDensity', { density }),
    onDensityChanged: (cb: (density: Density) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, d: Density): void => cb(d)
      ipcRenderer.on('density:changed', listener)
      return () => ipcRenderer.removeListener('density:changed', listener)
    },
    getCapsuleGlass: () => typedInvoke('preferences:getCapsuleGlass'),
    setCapsuleGlass: (glass: string) => typedInvoke('preferences:setCapsuleGlass', { glass }),
    onCapsuleGlassChanged: (cb: (glass: CapsuleGlass) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, g: CapsuleGlass): void => cb(g)
      ipcRenderer.on('capsule-glass:changed', listener)
      return () => ipcRenderer.removeListener('capsule-glass:changed', listener)
    },
    getCompactMode: () => typedInvoke('preferences:getCompactMode'),
    setCompactMode: (enabled: boolean) => typedInvoke('preferences:setCompactMode', { enabled }),
    onCompactModeChanged: (cb: (enabled: boolean) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, on: boolean): void => cb(on)
      ipcRenderer.on('compact-mode:changed', listener)
      return () => ipcRenderer.removeListener('compact-mode:changed', listener)
    }
  },
  // 截图库 OCR 索引（V4 P1-10）
  shotIndex: {
    status: () => typedInvoke('shotidx:status'),
    scan: () => typedInvoke('shotidx:scan'),
    search: (query, ensure?) => typedInvoke('shotidx:search', { query, ensure }),
    pastePath: (filePath) => typedInvoke('shotidx:pastePath', { filePath }),
    pasteLatest: () => typedInvoke('shotidx:pasteLatest'),
    onChanged: (cb: () => void) => {
      const listener = (): void => cb()
      ipcRenderer.on('shotidx:changed', listener)
      return () => ipcRenderer.removeListener('shotidx:changed', listener)
    }
  },
  // 系统日历只读（V4 P0-1 批次4）
  calendar: {
    status: () => typedInvoke('calendar:status'),
    requestAccess: () => typedInvoke('calendar:requestAccess'),
    next: () => typedInvoke('calendar:next'),
    schedule: () => typedInvoke('calendar:schedule'),
    createEvent: (input: { title: string; startMs: number; endMs: number }) =>
      typedInvoke('calendar:createEvent', input)
  },
  // 轻量多设备同步（V4 批次6）
  dataSync: {
    status: () => typedInvoke('syncdata:status'),
    push: () => typedInvoke('syncdata:push'),
    pull: () => typedInvoke('syncdata:pull')
  },
  // Hyper Key（V4 P1-8 方案 A：hidutil Caps→F18 + uiohook 组合）
  hyperKey: {
    getConfig: () => typedInvoke('launcher:hyperkey:getConfig'),
    setEnabled: (enabled: boolean) => typedInvoke('launcher:hyperkey:setEnabled', { enabled }),
    setQuickPress: (action: 'toggle' | 'escape' | 'caps' | 'nothing') =>
      typedInvoke('launcher:hyperkey:setQuickPress', { action })
  },
  // 使用统计（最近使用 + 收藏 + 频次）
  usage: {
    recordUse: (moduleId: string) => typedInvoke('usage:recordUse', { moduleId }),
    getRecent: (limit?: number) => typedInvoke('usage:getRecent', { limit }),
    getStats: () => typedInvoke('usage:getStats'),
    clearRecent: () => typedInvoke('usage:clearRecent'),
    addFavorite: (moduleId: string) => typedInvoke('usage:addFavorite', { moduleId }),
    removeFavorite: (moduleId: string) => typedInvoke('usage:removeFavorite', { moduleId }),
    isFavorite: (moduleId: string) => typedInvoke('usage:isFavorite', { moduleId }),
    getFavorites: () => typedInvoke('usage:getFavorites'),
    toggleFavorite: (moduleId: string) => typedInvoke('usage:toggleFavorite', { moduleId })
  },
  // 自动更新
  update: {
    check: () => typedInvoke('update:check'),
    download: () => typedInvoke('update:download'),
    install: () => typedInvoke('update:install'),
    getStatus: () => typedInvoke('update:getStatus'),
    getCurrentVersion: () => typedInvoke('update:getCurrentVersion'),
    onEvent: (cb) => {
      const listener = (_e: unknown, payload: UpdateEvent): void => cb(payload)
      ipcRenderer.on('update:event', listener)
      return () => ipcRenderer.removeListener('update:event', listener)
    }
  },
  // System info (userData path, legacy archive dir)
  system: {
    info: () => typedInvoke('system:info'),
    hardware: () => typedInvoke('system:hardware'),
    openPath: (p) => typedInvoke('system:openPath', { p }),
    openExternal: (url) => typedInvoke('system:openExternal', { url }),
    frontmostApp: () => typedInvoke('system:frontmostApp')
  },
  // macOS 权限面板（P-3.5）：状态 / 申请 / 跳转系统设置
  permissions: {
    probe: () => typedInvoke('permissions:probe'),
    request: (id: 'accessibility' | 'calendar' | 'screenRecording') =>
      typedInvoke('permissions:request', { id }),
    openSettings: (id: 'accessibility' | 'calendar' | 'screenRecording' | 'privacy') =>
      typedInvoke('permissions:openSettings', { id })
  },
  // 窗口切换（阶段3.3b）
  windows: {
    list: () => typedInvoke('windows:list'),
    activate: (pid: number, title: string) => typedInvoke('windows:activate', { pid, title })
  },
  // 回收站管理（阶段3.3c）
  trash: {
    list: () => typedInvoke('trash:list'),
    empty: () => typedInvoke('trash:empty'),
    restore: (itemPath: string) => typedInvoke('trash:restore', { itemPath }),
    delete: (itemPath: string) => typedInvoke('trash:delete', { itemPath }),
    open: () => typedInvoke('trash:open')
  },
  // 词典（阶段3.3d）
  dictionary: {
    open: (word: string) => typedInvoke('dictionary:open', { word }),
    query: (word: string) => typedInvoke('dictionary:query', { word })
  },
  // 日志 / 反馈
  log: {
    export: () => typedInvoke('log:export'),
    getMode: () => typedInvoke('log:getMode'),
    setMode: (mode: TelemetryMode) => typedInvoke('log:setMode', { mode })
  },
  // 主进程菜单 / dock / tray 跳转订阅
  onAppOpenModule: (cb: (e: { moduleId: string; path: string }) => void): (() => void) => {
    const l = (_e: unknown, payload: unknown): void =>
      cb(payload as { moduleId: string; path: string })
    ipcRenderer.on('app:openModule', l)
    return () => ipcRenderer.removeListener('app:openModule', l)
  },
  onAppGoHome: (cb: () => void): (() => void) => {
    const l = (): void => cb()
    ipcRenderer.on('app:goHome', l)
    return () => ipcRenderer.removeListener('app:goHome', l)
  },
  onAppOpenCommandPalette: (cb: () => void): (() => void) => {
    const l = (): void => cb()
    ipcRenderer.on('app:openCommandPalette', l)
    return () => ipcRenderer.removeListener('app:openCommandPalette', l)
  },
  onAppOpenSettings: (cb: () => void): (() => void) => {
    const l = (): void => cb()
    ipcRenderer.on('app:openSettings', l)
    return () => ipcRenderer.removeListener('app:openSettings', l)
  },
  onAppOpenAbout: (cb: () => void): (() => void) => {
    const l = (): void => cb()
    ipcRenderer.on('app:openAbout', l)
    return () => ipcRenderer.removeListener('app:openAbout', l)
  },
  // 平台特性
  // 数据迁移中心
  migration: {
    listArchives: () => typedInvoke('migration:listArchives'),
    deleteArchive: (archivePath: string) => typedInvoke('migration:deleteArchive', { archivePath }),
    restoreArchive: (archivePath: string) =>
      typedInvoke('migration:restoreArchive', { archivePath }),
    exportDb: () => typedInvoke('migration:exportDb'),
    importDb: () => typedInvoke('migration:importDb'),
    factoryReset: () => typedInvoke('migration:factoryReset')
  },
  // 云端整库备份（WebDAV 加密快照；密码不落盘，仅本次调用使用）
  cloudBackup: {
    list: () => typedInvoke('cloudBackup:list'),
    backup: (password: string) => typedInvoke('cloudBackup:backup', { password }),
    restore: (password: string, fileName?: string) =>
      typedInvoke('cloudBackup:restore', { password, fileName })
  },
  // 启动器胶囊窗
  launcher: {
    toggle: () => ipcRenderer.send('launcher:toggle'),
    show: () => ipcRenderer.send('launcher:show'),
    hide: () => ipcRenderer.send('launcher:hide'),
    openModule: (moduleId: string, path: string) =>
      ipcRenderer.send('launcher:openModule', { moduleId, path }),
    /** 转发搜索框输入（插件 SubInputChange 钩子） */
    input: (value: string) => ipcRenderer.send('launcher:search-input', value),
    /** 搜索结果：运行插件命令（args = 命令参数值，多参数命令经胶囊表单收集） */
    openPlugin: (pluginId: string, cmd?: string, args?: Record<string, string>) =>
      ipcRenderer.send('launcher:openPlugin', { pluginId, cmd, args }),
    /** 关闭当前打开的插件（回到搜索列表） */
    closePlugin: () => ipcRenderer.send('launcher:closePlugin'),
    /** 退回插件自己压的那一层（P-2④ 第二半）；第一层不在这里退，那是 closePlugin */
    popPluginView: () => ipcRenderer.send('launcher:popPluginView'),
    /** 第一方内联页（Raycast 式）：外部入口唤起胶囊窗并打开对应页 */
    openFirstParty: (page: FirstPartyPage) => ipcRenderer.send('launcher:openFirstParty', { page }),
    /**
     * MCP 工具调用（P-4② 收尾）：⌘K 面板既没有参数格也没有结果页，
     * 把「跑这个工具」交给胶囊做——两个入口同一个行为，而不是面板里做半套。
     * 送的是**参数清单**（几个格、哪个必填）不是值：值由用户在胶囊里填。
     */
    runMcpTool: (payload: {
      serverId: string
      serverLabel: string
      tool: string
      argSpecs: McpToolArg[]
    }) => ipcRenderer.send('launcher:runMcpTool', payload),
    /** 胶囊侧订阅上述转交（主进程已把窗唤起） */
    onRunMcpTool: (
      cb: (payload: {
        serverId: string
        serverLabel: string
        tool: string
        argSpecs: McpToolArg[]
      }) => void
    ): (() => void) => {
      const l = (_e: unknown, payload: unknown): void => cb(payload as never)
      ipcRenderer.on('launcher:mcp:run', l as never)
      return () => ipcRenderer.removeListener('launcher:mcp:run', l as never)
    },
    /** 第一方内联页打开事件（主进程转发，胶囊渲染端订阅） */
    onOpenFirstParty: (cb: (page: FirstPartyPage) => void): (() => void) => {
      const l = (_e: unknown, payload: { page: FirstPartyPage }): void => cb(payload.page)
      ipcRenderer.on('launcher:firstparty:open', l as never)
      return () => ipcRenderer.removeListener('launcher:firstparty:open', l as never)
    },
    /** 独立模块窗已接管某路由（主窗口若正显示同路由应让位回 Hub） */
    onAppRouteTaken: (cb: (payload: { path: string }) => void): (() => void) => {
      const l = (_e: unknown, payload: { path: string }): void => cb(payload)
      ipcRenderer.on('app:route-taken', l as never)
      return () => ipcRenderer.removeListener('app:route-taken', l as never)
    },
    /** 已安装插件清单（搜索命令来源） */
    listPlugins: () => typedInvoke('launcher:listPlugins'),
    /** 性能基线（M0）：胶囊唤起耗时 */
    perf: () => typedInvoke('launcher:perf'),
    /** 保持打开（P-1.3）：返回主进程生效值 */
    setPinned: (pinned: boolean) => typedInvoke('launcher:setPinned', { pinned }),
    /** 紧凑模式（P-6⑤）：渲染端量好一条栏的高度报过来，主进程夹住后改窗 */
    setCompact: (compact: boolean, height: number) =>
      typedInvoke('launcher:setCompact', { compact, height }),
    /** Quicklinks（M2.3） */
    quicklinksList: () => typedInvoke('launcher:quicklinks:list'),
    quicklinksSave: (items: unknown[]) => typedInvoke('launcher:quicklinks:save', { items }),
    /** Quicklink favicon：返回本地缓存路径（image:// 加载），失败 null */
    quicklinkFavicon: (url: string) => typedInvoke('launcher:quicklink:favicon', { url }),
    /** 插件偏好（M3.2，管理页读写） */
    getPreference: (pluginId: string, name: string) =>
      typedInvoke('launcher:getPreference', { pluginId, name }),
    setPreference: (pluginId: string, name: string, value: unknown) =>
      typedInvoke('launcher:setPreference', { pluginId, name, value }),
    /** 热键配置（M4：主热键可配置 + 命令级全局热键） */
    hotkeysGetConfig: () => typedInvoke('launcher:hotkeys:getConfig'),
    // 最近一轮注册的冲突清单（V4 P0-3：设置页冲突提示）
    hotkeysGetConflicts: () => typedInvoke('launcher:hotkeys:getConflicts'),
    hotkeysSetMain: (accelerator: string) =>
      typedInvoke('launcher:hotkeys:setMain', { accelerator }),
    hotkeysSetCommand: (accelerator: string, spec: CommandHotkeySpec | null) =>
      typedInvoke('launcher:hotkeys:setCommand', { accelerator, spec }),
    /** 两段式直达（主热键后按住修饰键再按字母） */
    hotkeysSetChord: (letter: string, spec: CommandHotkeySpec | null) =>
      typedInvoke('launcher:hotkeys:setChord', { letter, spec }),
    /** 片段文本扩展（M5.1）配置 / 权限诊断 */
    expansionGetConfig: () => typedInvoke('launcher:expansion:getConfig'),
    expansionSetConfig: (patch: Partial<ExpansionConfig>) =>
      typedInvoke('launcher:expansion:setConfig', { patch }),
    expansionProbe: () => typedInvoke('launcher:expansion:probe'),
    /** 从本地目录导入插件（管理页） */
    installFromFolder: (dirPath: string) => typedInvoke('launcher:installFromFolder', { dirPath }),
    /** 插件市场：打包索引 + 可选远程索引（P-3.1） */
    marketList: () => typedInvoke('launcher:market:list'),
    marketIndexInfo: () => typedInvoke('launcher:market:indexInfo'),
    marketSetIndexUrl: (url: string) => typedInvoke('launcher:market:setIndexUrl', { url }),
    marketRefreshIndex: () => typedInvoke('launcher:market:refreshIndex'),
    marketInstall: (entryId: string) => typedInvoke('launcher:market:install', { entryId }),
    /** 市场版本更新：覆盖安装最新版 */
    marketUpdate: (entryId: string) => typedInvoke('launcher:market:update', { entryId }),
    /** 插件开发模式（本地目录 link + 文件 watcher 热重载） */
    devPluginsList: () => typedInvoke('launcher:devPlugins:list'),
    devPluginsAdd: (dirPath: string) => typedInvoke('launcher:devPlugins:add', { dirPath }),
    devPluginsRemove: (pluginId: string) => typedInvoke('launcher:devPlugins:remove', { pluginId }),
    devPluginsSetAutoReload: (pluginId: string, autoReload: boolean) =>
      typedInvoke('launcher:devPlugins:setAutoReload', { pluginId, autoReload }),
    devPluginsReload: (pluginId: string) => typedInvoke('launcher:devPlugins:reload', { pluginId }),
    onDevPluginsChanged: (
      cb: (payload: {
        kind: 'added' | 'removed' | 'reloaded' | 'error'
        pluginId: string
        name?: string
        error?: string
      }) => void
    ): (() => void) => {
      const l = (_e: unknown, payload: unknown): void => cb(payload as Parameters<typeof cb>[0])
      ipcRenderer.on('launcher:devPlugins:changed', l)
      return () => ipcRenderer.removeListener('launcher:devPlugins:changed', l)
    },
    removePlugin: (pluginId: string) => typedInvoke('launcher:removePlugin', { pluginId }),
    pluginDevtools: (pluginId: string) => typedInvoke('launcher:pluginDevtools', { pluginId }),
    setPluginEnabled: (pluginId: string, enabled: boolean) =>
      typedInvoke('launcher:setPluginEnabled', { pluginId, enabled }),
    selectPluginFolder: () => typedInvoke('launcher:selectPluginFolder'),
    openPluginsDir: () => ipcRenderer.send('launcher:openPluginsDir'),
    syncGetConfig: () => typedInvoke('launcher:syncGetConfig'),
    syncSetConfig: (config) => typedInvoke('launcher:syncSetConfig', { config }),
    syncTest: (configOverride) => typedInvoke('launcher:syncTest', { configOverride }),
    syncBackup: () => typedInvoke('launcher:syncBackup'),
    syncRestore: () => typedInvoke('launcher:syncRestore'),
    onShown: (cb: () => void): (() => void) => {
      const l = (): void => cb()
      ipcRenderer.on('launcher:shown', l)
      return () => ipcRenderer.removeListener('launcher:shown', l)
    },
    /** 当前插件状态（挂载后主动拉取，兜住丢失的一次性推送） */
    getPluginState: () => typedInvoke('launcher:getPluginState'),
    /** 插件状态变化（打开/关闭/副输入框 placeholder/声明式列表） */
    onPluginChanged: (
      cb: (state: {
        open: boolean
        pluginId: string | null
        pluginName: string | null
        subInputPlaceholder: string | null
        declaredList?: unknown
        declaredForm?: unknown
        /** Action 命令 = headless；attached = 视图是否真挂上了胶囊窗 */
        headless?: boolean
        attached?: boolean
      }) => void
    ): (() => void) => {
      const l = (_e: unknown, state: unknown): void =>
        cb(
          state as {
            open: boolean
            pluginId: string | null
            pluginName: string | null
            subInputPlaceholder: string | null
            declaredList?: unknown
            declaredForm?: unknown
          }
        )
      ipcRenderer.on('launcher:plugin-changed', l as never)
      return () => ipcRenderer.removeListener('launcher:plugin-changed', l as never)
    },
    // #11 M2：React 表单视图提交（表单到达经 plugin-changed 快照，不再单开通道）
    pluginFormSubmit: (values: Record<string, string | boolean>) =>
      typedInvoke('launcher:plugin-form-submit', { values }),
    // #5 插件双通道：searchable 插件持久化条目的合并读取与更新推送
    pluginSearchList: () => typedInvoke('launcher:pluginSearchItems:list'),
    onPluginSearchIndexUpdated: (cb: () => void): (() => void) => {
      const l = (): void => cb()
      ipcRenderer.on('launcher:plugin-search-index-updated', l as never)
      return () => ipcRenderer.removeListener('launcher:plugin-search-index-updated', l as never)
    },
    /**
     * 命令表变了（插件装/卸/启停/市场更新，或 MCP 工具清单变化）。
     * 回调带上**是哪一路**：渲染端只重拉那一路，别连带把别的源也刷一遍（会把选中位反复归零）。
     */
    onCommandTableChanged: (cb: (source: 'plugins' | 'mcp') => void): (() => void) => {
      const l = (_e: unknown, payload: { source?: 'plugins' | 'mcp' }): void =>
        cb(payload?.source ?? 'plugins')
      ipcRenderer.on('launcher:command-table-changed', l as never)
      return () => ipcRenderer.removeListener('launcher:command-table-changed', l as never)
    },
    /** 执行声明式条目的 callback 动作（copy/open 由胶囊本地执行） */
    runPluginAction: (pluginId: string, itemIndex: number, actionIndex: number) =>
      typedInvoke('launcher:plugin-run-action', { pluginId, itemIndex, actionIndex })
  },
  // 统一动作执行端（#4：与窗口无关的动作由 main 注册表分发，胶囊/⌘K/热键/托盘共用）
  action: {
    invoke: (action) => typedInvoke('action:invoke', { action })
  },
  // 文件索引（#9，macOS / Windows）：状态 / 范围管理 / 重建
  fileIndex: {
    status: () => typedInvoke('fileIndex:status'),
    addScope: () => typedInvoke('fileIndex:addScope'),
    removeScope: (dir: string) => typedInvoke('fileIndex:removeScope', { dir }),
    rebuild: () => typedInvoke('fileIndex:rebuild'),
    setHidden: (value: boolean) => typedInvoke('fileIndex:setHidden', { value })
  },
  // 剪贴板历史（阶段B：胶囊内联页数据源；主进程 1s 轮询，会话内有效）
  clipHist: {
    list: () => typedInvoke('cliphist:list'),
    copy: (id) => typedInvoke('cliphist:copy', { id }),
    remove: (id) => typedInvoke('cliphist:remove', { id }),
    clear: () => typedInvoke('cliphist:clear'),
    togglePin: (id) => typedInvoke('cliphist:togglePin', { id }),
    // 条目备注关键词（P0-3：补充索引，搜索可命中）
    setKeywords: (id, keywords) => typedInvoke('cliphist:setKeywords', { id, keywords }),
    getEnabled: () => typedInvoke('cliphist:getEnabled'),
    setEnabled: (on) => typedInvoke('cliphist:setEnabled', { on }),
    pasteBack: (id) => typedInvoke('cliphist:pasteBack', { id }),
    // 识别图片条目中的二维码，文本回填剪贴板（V4 P1-12 批次3）
    decodeQr: (id) => typedInvoke('cliphist:decodeQr', { id }),
    getBlockedApps: () => typedInvoke('cliphist:getBlockedApps'),
    setBlockedApps: (apps) => typedInvoke('cliphist:setBlockedApps', { apps }),
    startPasteSequence: (id) => typedInvoke('cliphist:startPasteSequence', { id }),
    pasteNext: () => typedInvoke('cliphist:pasteNext')
  },
  // AI 服务（P0-3：OpenAI 兼容 API + 流式响应 + 对话历史 + 模型预设）
  ai: {
    getConfig: () => typedInvoke('ai:getConfig'),
    setConfig: (patch) => typedInvoke('ai:setConfig', { patch }),
    isConfigured: () => typedInvoke('ai:isConfigured'),
    /** BYOM：探测当前端点并拉模型列表（P-4①） */
    listModels: () => typedInvoke('ai:listModels'),
    /** MCP 客户端最小面（P-4②）：连接只认已存配置的 id */
    mcpOverview: () => typedInvoke('mcp:overview'),
    mcpSetServers: (servers: unknown) => typedInvoke('mcp:setServers', { servers }),
    mcpConnect: (id: string) => typedInvoke('mcp:connect', { id }),
    mcpStop: (id: string) => typedInvoke('mcp:stop', { id }),
    mcpCallTool: (id: string, tool: string, args: Record<string, unknown>) =>
      typedInvoke('mcp:callTool', { id, tool, args }),
    /** 工具清单缓存 → 根搜索命令（P-4② 收尾）：纯读缓存，不 spawn */
    mcpToolCommands: () => typedInvoke('mcp:toolCommands'),
    /** 从搜索框跑一个工具（未连接时主进程先连接；参数以字符串送，类型主进程定） */
    mcpRunTool: (payload: { id: string; tool: string; args: Record<string, string> }) =>
      typedInvoke('mcp:runTool', payload),
    /** Automations（P-4④） */
    automationList: () => typedInvoke('automation:list'),
    automationSave: (tasks: unknown) => typedInvoke('automation:save', { tasks }),
    automationRunNow: (id: string) => typedInvoke('automation:runNow', { id }),
    automationSetEnabled: (id: string, enabled: boolean) =>
      typedInvoke('automation:setEnabled', { id, enabled }),
    chat: (sessionId, messages) => typedInvoke('ai:chat', { sessionId, messages }),
    onStreamChunk: (
      cb: (payload: { sessionId: string; delta: string; done: boolean; error?: string }) => void
    ): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: unknown): void =>
        cb(payload as { sessionId: string; delta: string; done: boolean; error?: string })
      ipcRenderer.on('ai:stream-chunk', listener)
      return () => ipcRenderer.removeListener('ai:stream-chunk', listener)
    },
    // 对话历史
    listSessions: () => typedInvoke('ai:listSessions'),
    getSession: (id: string) => typedInvoke('ai:getSession', { id }),
    saveSession: (session) => typedInvoke('ai:saveSession', session),
    deleteSession: (id: string) => typedInvoke('ai:deleteSession', { id }),
    clearSessions: () => typedInvoke('ai:clearSessions'),
    // 模型预设
    listPresets: () => typedInvoke('ai:listPresets'),
    savePreset: (preset) => typedInvoke('ai:savePreset', { preset }),
    deletePreset: (id: string) => typedInvoke('ai:deletePreset', { id }),
    applyPreset: (id: string) => typedInvoke('ai:applyPreset', { id })
  },
  // 轻量笔记（Notes）
  notes: {
    list: (filter) => typedInvoke('notes:list', { filter }),
    get: (id: string) => typedInvoke('notes:get', { id }),
    create: (data) => typedInvoke('notes:create', data),
    update: (id, updates) => typedInvoke('notes:update', { id, updates }),
    trash: (id: string) => typedInvoke('notes:trash', { id }),
    restore: (id: string) => typedInvoke('notes:restore', { id }),
    delete: (id: string) => typedInvoke('notes:delete', { id }),
    emptyTrash: () => typedInvoke('notes:emptyTrash'),
    togglePin: (id: string) => typedInvoke('notes:togglePin', { id }),
    stats: () => typedInvoke('notes:stats'),
    folders: () => typedInvoke('notes:folders'),
    createFolder: (name: string) => typedInvoke('notes:createFolder', { name }),
    renameFolder: (id, name) => typedInvoke('notes:renameFolder', { id, name }),
    deleteFolder: (id: string) => typedInvoke('notes:deleteFolder', { id })
  },
  // 提醒事项
  reminders: {
    list: (filter) => typedInvoke('reminders:list', { filter }),
    get: (id: string) => typedInvoke('reminders:get', { id }),
    create: (data) => typedInvoke('reminders:create', data),
    update: (id, patch) => typedInvoke('reminders:update', { id, patch }),
    complete: (id: string) => typedInvoke('reminders:complete', { id }),
    uncomplete: (id: string) => typedInvoke('reminders:uncomplete', { id }),
    remove: (id: string) => typedInvoke('reminders:remove', { id }),
    countActive: () => typedInvoke('reminders:countActive')
  },
  // 浮动笔记
  floatingNote: {
    toggle: () => typedInvoke('floatingNote:toggle'),
    show: () => typedInvoke('floatingNote:show'),
    hide: () => typedInvoke('floatingNote:hide'),
    isVisible: () => typedInvoke('floatingNote:isVisible')
  },
  // 命令别名（P2-8：用户自定义命令别名，搜索时匹配）
  alias: {
    getAll: () => typedInvoke('alias:getAll'),
    get: (commandKey: string) => typedInvoke('alias:get', { commandKey }),
    set: (commandKey: string, alias: string) => typedInvoke('alias:set', { commandKey, alias }),
    remove: (commandKey: string, alias: string) =>
      typedInvoke('alias:remove', { commandKey, alias })
  },
  // 搜索历史（P2-9：空查询时展示最近搜索，可点击复用）
  searchHistory: {
    get: () => typedInvoke('search:history:get'),
    add: (query: string) => typedInvoke('search:history:add', { query }),
    clear: () => typedInvoke('search:history:clear')
  },
  // 浏览器标签（P1-5：Chrome/Safari 标签搜索与切换，macOS）
  browserTabs: {
    list: () => typedInvoke('browser:tabs:list'),
    activate: (tab) => typedInvoke('browser:tabs:activate', { tab })
  },
  // 系统命令 / 窗口管理（M2）
  sysCmd: {
    run: (id: string) => typedInvoke('systemcmd:run', { id }),
    ids: () => typedInvoke('systemcmd:ids')
  },
  // 文件搜索（M5.3，mac mdfind）
  fileSearch: {
    query: (q: string, limit?: number, opts?: { mode?: 'name' | 'content'; onlyIn?: string }) =>
      typedInvoke('find:files', { query: q, limit, opts }),
    reveal: (filePath: string) => typedInvoke('find:reveal', { filePath })
  },
  // E2E 探针计数（仅 LEAF_E2E=1 时主进程注册了该通道；生产调用会 reject）
  e2e: {
    probeCounts: () => typedInvoke('e2e:probeCounts')
  },
  // 专注护盾（应用屏蔽）
  focusShield: {
    getConfig: () => typedInvoke('focus-shield:getConfig'),
    setConfig: (patch) => typedInvoke('focus-shield:setConfig', patch),
    setActive: (active) => typedInvoke('focus-shield:setActive', { active }),
    temporaryAllow: () => typedInvoke('focus-shield:temporaryAllow'),
    currentState: () => typedInvoke('focus-shield:currentState'),
    onInfo: (callback) => {
      // 载荷形状由 API 声明（现为 focusShield.currentState 派生）决定，这里不再抄一份
      const listener = (
        _e: Electron.IpcRendererEvent,
        payload: Parameters<typeof callback>[0]
      ): void => callback(payload)
      ipcRenderer.on('focus-shield:info', listener)
      return () => {
        ipcRenderer.removeListener('focus-shield:info', listener)
      }
    }
  },
  // 文件夹 API
  folder: {
    getFolders: () => typedInvoke('folder:getFolders'),
    getFolderTree: () => typedInvoke('folder:getFolderTree'),
    getFolderById: (id: string) => typedInvoke('folder:getFolderById', { id }),
    getFoldersByParentId: (parentId: string | null) =>
      typedInvoke('folder:getFoldersByParentId', { parentId }),
    // 通用另存为对话框（导出类通道的写盘路径由此签发）
    selectSavePath: (req?) => typedInvoke('folder:selectSavePath', req ?? {}),
    addFolder: (folder) => typedInvoke('folder:addFolder', folder),
    updateFolder: (id, updates) => typedInvoke('folder:updateFolder', { id, updates }),
    deleteFolder: (id: string) => typedInvoke('folder:deleteFolder', { id }),
    updateFolderOrder: (folderId, newParentId, newOrderIndex) =>
      typedInvoke('folder:updateFolderOrder', { folderId, newParentId, newOrderIndex }),
    canMoveFolder: (folderId, targetParentId) =>
      typedInvoke('folder:canMoveFolder', { folderId, targetParentId })
  },
  // 创建新窗口
  createNewWindow: (route: string) => typedInvoke('create-new-window', { route }),
  // 监听路由导航消息
  onNavigateToRoute: (callback: (route: string) => void) => {
    const listener = (_event: unknown, route: string): void => callback(route)
    ipcRenderer.on('navigate-to-route', listener)
    // 与其他 on* API 一致：返回退订函数，不误伤同通道其他订阅者
    return (): void => {
      ipcRenderer.removeListener('navigate-to-route', listener)
    }
  },
  // 屏幕录制相关 API
  screenRecorder: {
    getSources: (options: Electron.SourcesOptions) =>
      typedInvoke('screen-recorder:getSources', { options }),
    selectSavePath: () => typedInvoke('screen-recorder:selectSavePath'),
    getDefaultSavePath: () => typedInvoke('screen-recorder:getDefaultSavePath'),
    saveFile: (filePath: string, buffer: Uint8Array, duration?: number, recordingId?: string) =>
      typedInvoke('screen-recorder:saveFile', { filePath, buffer, duration, recordingId }),
    // 分片流式写盘（长录制避免整段视频驻留内存）
    beginWrite: (filePath: string) => typedInvoke('screen-recorder:beginWrite', { filePath }),
    appendChunk: (filePath: string, chunk: Uint8Array) =>
      typedInvoke('screen-recorder:appendChunk', { filePath, chunk }),
    endWrite: (filePath: string, duration?: number, recordingId?: string) =>
      typedInvoke('screen-recorder:endWrite', { filePath, duration, recordingId }),
    abortWrite: (filePath: string) => typedInvoke('screen-recorder:abortWrite', { filePath }),
    requestPermission: () => typedInvoke('screen-recorder:requestPermission'),
    checkPermission: () => typedInvoke('screen-recorder:checkPermission')
  },
  // 录制新通道（SQLite rec_recordings 链路）：与 index.d.ts 的 RecordingAPI 对应
  recording: {
    list: (req) => typedInvoke('recording.list', req ?? {}),
    get: (req) => typedInvoke('recording.get', req),
    remove: (req) => typedInvoke('recording.delete', req),
    deleteOne: (req) => typedInvoke('recording.delete', req),
    start: (req) => typedInvoke('recording.start', req),
    finalize: (req) => typedInvoke('recording.finalize', req),
    togglePause: () => typedInvoke('recording.togglePause'),
    settings: {
      get: () => typedInvoke('recording.settings.get'),
      patch: (req) => typedInvoke('recording.settings.patch', req),
      reset: () => typedInvoke('recording.settings.reset')
    },
    recovery: {
      scan: () => typedInvoke('recording.recovery.scan'),
      recover: (req) => typedInvoke('recording.recovery.recover', req),
      discard: (req) => typedInvoke('recording.recovery.discard', req)
    },
    segments: {
      open: (req) => typedInvoke('recording.segments.open', req),
      close: (req) => typedInvoke('recording.segments.close', req),
      list: (req) => typedInvoke('recording.segments.list', req),
      totalDuration: (req) => typedInvoke('recording.segments.totalDuration', req)
    },
    region: {
      open: () => typedInvoke('recording.region.open'),
      openForDisplay: (req) => typedInvoke('recording.region.openForDisplay', req),
      openCrossDisplay: () => typedInvoke('recording.region.openCrossDisplay'),
      listDisplays: () => typedInvoke('recording.region.listDisplays'),
      cancel: () => typedInvoke('recording.region.cancel')
    },
    systemAudio: {
      probe: (req) => typedInvoke('recording.systemAudio.probe', req)
    },
    cursor: {
      start: () => typedInvoke('recording.cursor.start'),
      stop: () => typedInvoke('recording.cursor.stop')
    },
    export: {
      start: (req) => typedInvoke('recording.export.start', req),
      cancel: (req) => typedInvoke('recording.export.cancel', req),
      getInfo: (req) => typedInvoke('recording.export.getInfo', req)
    },
    shortcut: {
      getConfig: () => typedInvoke('recording.shortcut.getConfig'),
      setConfig: (req) => typedInvoke('recording.shortcut.setConfig', req),
      registered: () => typedInvoke('recording.shortcut.registered'),
      attach: () => typedInvoke('recording.shortcut.attach'),
      detach: () => typedInvoke('recording.shortcut.detach')
    },
    countdown: {
      start: (req) => typedInvoke('recording.countdown.start', req),
      cancel: () => typedInvoke('recording.countdown.cancel')
    }
  },
  // 录制历史相关 API
  recordingHistory: {
    getHistory: () => typedInvoke('recording-history:getHistory'),
    getHistoryByDateRange: (start, end) =>
      typedInvoke('recording-history:getHistoryByDateRange', { start, end }),
    addHistory: (recording) => typedInvoke('recording-history:addHistory', recording),
    deleteHistory: (id) => typedInvoke('recording-history:deleteHistory', { id }),
    clearHistory: () => typedInvoke('recording-history:clearHistory'),
    generateThumbnail: (videoPath) =>
      typedInvoke('recording-history:generateThumbnail', { videoPath }),
    updateThumbnail: (id) => typedInvoke('recording-history:updateThumbnail', { id }),
    getStatistics: () => typedInvoke('recording-history:getStatistics'),
    openFile: (filePath) => typedInvoke('recording-history:openFile', { filePath }),
    showInFolder: (filePath) => typedInvoke('recording-history:showInFolder', { filePath })
  },
  // 录制设置相关 API
  recordingSettings: {
    getSettings: () => typedInvoke('recording-settings:getSettings'),
    updateSettings: (updates) => typedInvoke('recording-settings:updateSettings', updates),
    resetToDefaults: () => typedInvoke('recording-settings:resetToDefaults'),
    getQualityPreset: (quality) => typedInvoke('recording-settings:getQualityPreset', { quality })
  },
  // 标记相关 API
  marker: {
    addMarker: (recordingId: string, timestamp: number, label?: string) =>
      typedInvoke('marker:addMarker', { recordingId, timestamp, label }),
    removeMarker: (recordingId: string, markerId: string) =>
      typedInvoke('marker:removeMarker', { recordingId, markerId }),
    getMarkers: (recordingId: string) => typedInvoke('marker:getMarkers', { recordingId }),
    updateMarker: (recordingId: string, markerId: string, updates) =>
      typedInvoke('marker:updateMarker', { recordingId, markerId, updates }),
    clearMarkers: (recordingId: string) => typedInvoke('marker:clearMarkers', { recordingId }),
    exportToCSV: (recordingId: string) => typedInvoke('marker:exportToCSV', { recordingId })
  },
  // 视频剪辑相关 API
  clip: {
    addClip: (videoId, startTime, endTime, label) =>
      typedInvoke('clip:addClip', { videoId, startTime, endTime, label }),
    removeClip: (videoId, clipId) => typedInvoke('clip:removeClip', { videoId, clipId }),
    updateClip: (videoId, clipId, updates) =>
      typedInvoke('clip:updateClip', { videoId, clipId, updates }),
    getClips: (videoId) => typedInvoke('clip:getClips', { videoId }),
    clearClips: (videoId) => typedInvoke('clip:clearClips', { videoId }),
    previewClip: (videoPath, clip) => typedInvoke('clip:previewClip', { videoPath, clip }),
    exportClips: (videoPath, options) => typedInvoke('clip:exportClips', { videoPath, options }),
    getVideoInfo: (videoPath) => typedInvoke('clip:getVideoInfo', { videoPath }),
    // 监听导出进度；返回退订函数（removeAllListeners 会误杀同通道的其他订阅者）
    onExportProgress: (
      callback: (progress: {
        percent: number
        currentClip: number
        totalClips: number
        message: string
      }) => void
    ) => {
      type ExportProgress = {
        percent: number
        currentClip: number
        totalClips: number
        message: string
      }
      const handler = (_event: Electron.IpcRendererEvent, progress: ExportProgress): void => {
        callback(progress)
      }
      ipcRenderer.on('clip:exportProgress', handler)
      return () => {
        ipcRenderer.removeListener('clip:exportProgress', handler)
      }
    },
    removeExportProgressListener: () => {
      ipcRenderer.removeAllListeners('clip:exportProgress')
    },
    // 文件选择 API
    selectVideoFile: () => typedInvoke('clip:selectVideoFile'),
    selectAudioFile: () => typedInvoke('clip:selectAudioFile'),
    selectSavePath: () => typedInvoke('clip:selectSavePath')
  },
  // 通知相关 API
  notification: {
    // 通用通知
    show: (type, title: string, body: string, options?) =>
      typedInvoke('notification:show', { type, title, body, options }),
    // 番茄钟通知
    pomodoro: (type: 'start' | 'break' | 'complete' | 'pause' | 'remind', message?: string) =>
      typedInvoke('notification:pomodoro', { type, message }),
    // 屏幕录制通知
    recording: (type: 'start' | 'stop' | 'error', message?: string) =>
      typedInvoke('notification:recording', { type, message }),
    // 信息通知
    info: (title: string, body: string, options?) =>
      typedInvoke('notification:info', { title, body, options }),
    // 成功通知
    success: (title: string, body: string, options?) =>
      typedInvoke('notification:success', { title, body, options }),
    // 警告通知
    warning: (title: string, body: string, options?) =>
      typedInvoke('notification:warning', { title, body, options }),
    // 错误通知
    error: (title: string, body: string, options?) =>
      typedInvoke('notification:error', { title, body, options }),
    // 关闭通知
    close: (id: number) => typedInvoke('notification:close', { id }),
    // 关闭所有通知
    closeAll: () => typedInvoke('notification:closeAll'),
    // B10：订阅通知的点击/关闭事件（{ id, kind }）；返回取消订阅函数
    onEvent: (cb: (e: { id: number; kind: 'click' | 'close' }) => void) => {
      const listener = (
        _e: Electron.IpcRendererEvent,
        payload: { id: number; kind: 'click' | 'close' }
      ): void => cb(payload)
      ipcRenderer.on('notification:event', listener)
      return () => ipcRenderer.removeListener('notification:event', listener)
    }
  }
}

// 使用 `contextBridge` API 将 Electron API 暴露给渲染进程
// 仅在启用上下文隔离时使用，否则直接添加到 DOM 全局对象

if (process.contextIsolated) {
  try {
    // 不暴露 @electron-toolkit/preload 的 electronAPI（含原始 ipcRenderer，通道名任意）
    contextBridge.exposeInMainWorld('api', api)
    // PR-4: region overlay 专用桥（主窗口 / overlay 窗口均可使用）
    contextBridge.exposeInMainWorld('regionOverlayAPI', {
      submit: (region: { x: number; y: number; width: number; height: number }) =>
        typedInvoke('region-overlay:submit', { region }),
      cancel: () => typedInvoke('region-overlay:cancel')
    })
    // PR-4: cursor 位置推送（main → renderer 单向事件）
    // 用 window.dispatchEvent 把 IPC 消息桥到 DOM CustomEvent，
    // 因为 contextBridge 不能直接 expose ipcRenderer.on。
    ipcRenderer.on('cursor:position', (_e, pt: { x: number; y: number }) => {
      window.dispatchEvent(new CustomEvent('leaf:cursor-position', { detail: pt }))
    })
    ipcRenderer.on('cursor:stop', () => {
      window.dispatchEvent(new CustomEvent('leaf:cursor-stop'))
    })
    // PR-5b: 导出进度/完成
    ipcRenderer.on(
      'recording:export:progress',
      (_e, payload: { jobId: string; recordingId: string; percent: number; message: string }) => {
        window.dispatchEvent(new CustomEvent('leaf:export-progress', { detail: payload }))
      }
    )
    ipcRenderer.on(
      'recording:export:done',
      (
        _e,
        payload: {
          jobId: string
          recordingId: string
          ok: boolean
          outputPath?: string
          fileSize?: number
          error?: string
        }
      ) => {
        window.dispatchEvent(new CustomEvent('leaf:export-done', { detail: payload }))
      }
    )
    // PR-7a: shortcut 推送
    ipcRenderer.on('recording:shortcut:start', () => {
      window.dispatchEvent(new CustomEvent('leaf:shortcut-start'))
    })
    ipcRenderer.on('recording:shortcut:togglePause', () => {
      window.dispatchEvent(new CustomEvent('leaf:shortcut-togglePause'))
    })
    // PR-7b: 倒计时推送
    ipcRenderer.on('recording:countdown:tick', (_e, p: { remaining: number }) => {
      window.dispatchEvent(new CustomEvent('leaf:countdown-tick', { detail: p }))
    })
    ipcRenderer.on('recording:countdown:begun', () => {
      window.dispatchEvent(new CustomEvent('leaf:countdown-begun'))
    })
    ipcRenderer.on('recording:countdown:fire', (_e, p: { reason: string }) => {
      window.dispatchEvent(new CustomEvent('leaf:countdown-fire', { detail: p }))
    })
    ipcRenderer.on('recording:countdown:cancel', () => {
      window.dispatchEvent(new CustomEvent('leaf:countdown-cancel'))
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
