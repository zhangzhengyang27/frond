import { app, BrowserWindow, dialog, protocol, session, Tray } from 'electron'
import { fileIndexClient } from './fileIndex/client'
import { migrateLegacyBrandData } from './modules/brandMigration'

// userData 目录显式钉回 frond-desktop：package.json 的 productName=Frond（isSelfName
// 打包判定用，见 frontmostCache）会让 Electron 把 userData 迁到「Application Support/Frond」，
// 用户数据看起来像被清空。这里在任何服务触碰 userData 之前钉回历史路径。
// 例外：FROND_USER_DATA_DIR 显式指定独立目录（e2e 隔离——测试实例与 dev/正式实例
// 并存时不抢单实例锁，也不读写真实用户数据）。
app.setPath(
  'userData',
  process.env.FROND_USER_DATA_DIR || join(app.getPath('appData'), 'frond-desktop')
)
// 旧品牌（Leaf）的盘上存量搬到当前路径。必须紧跟在上面的钉径之后、
// requestSingleInstanceLock() 之前——那一步会创建 userData 目录。
migrateLegacyBrandData(app.getPath('userData'))
import { join, resolve } from 'path'
import { electronApp } from '@electron-toolkit/utils'

// 自定义协议特权（必须在 app ready 前注册）：plugin:// 承载启动器插件页面
protocol.registerSchemesAsPrivileged([
  { scheme: 'plugin', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])
// 数据存储实例统一导入
import {
  pomodoroStore,
  snippetStore,
  tagStore,
  preferencesStore,
  folderStore,
  usageStore
} from './stores'
// IPC 处理器统一导入
import {
  registerNotificationIpcHandlers,
  registerPreferencesIpcHandlers,
  registerPrettierIpcHandlers,
  registerTagIpcHandlers,
  registerSnippetIpcHandlers,
  registerApplicationsIpcHandlers,
  registerFoldersIpcHandlers,
  registerUsageIpcHandlers,
  registerAutoUpdateIpcHandlers,
  registerSystemInfoIpcHandlers,
  registerLogIpcHandlers,
  registerCrashIpcHandlers,
  registerMigrationIpcHandlers,
  registerNotesIpc,
  registerCloudBackupIpcHandlers,
  registerRemindersIpc,
  registerPermissionsIpcHandlers
} from './ipc'
// 主进程模块统一导入
import {
  createAppWindow,
  windowSizeForRoute,
  createAppTray,
  destroyTrayTimer,
  setupAppDockMenu,
  destroyDockMenuTimer,
  registerAppGlobalShortcuts,
  unregisterAppGlobalShortcuts,
  registerProtocols,
  registerPomodoroHandlers,
  registerMiniWindowIpc,
  installApplicationMenu,
  watchWindowShortcuts
} from './modules'
// SQLite 单例
import { installDatabase, uninstallDatabase } from './db/database'
import { snippetRepository, TRASH_RETENTION_DAYS } from './db/repos/SnippetRepository'
import { runDataMigrations } from './db/dataMigrations'
import { runPomodoroDurationMsMigration } from './db/dataMigrationsPomodoro'
import { installGlobalLogHandlers, log } from './services/LogService'
import { crashReport } from './services/CrashReportService'
// 平台差异集中工具
import { isMac as isMacRuntime, shouldQuitOnAllWindowsClosed } from './utils/platform'
// 启动器（胶囊搜索窗 + 插件运行时）
import { registerLauncher } from './launcher'
import { showLauncherWindow, getLauncherWindow } from './launcher/window'
import { openPlugin } from './launcher/runtime'
import { parseFrondUrl } from './launcher/frondUrl'
// 剪贴板历史（阶段B：胶囊内联页数据源）
import { clipboardHistory } from './services/ClipboardHistoryService'
import { reminderService } from './services/ReminderService'
import { registerClipboardHistoryIpc } from './ipc/clipboardHistory'
import { registerShotIndexIpc } from './ipc/shotIndex'
import { registerScreenshotHandlers } from './modules/screenshot'
import { registerCalendarIpc } from './ipc/calendar'
import { registerDataSyncIpc } from './ipc/dataSync'
import { calendarService } from './services/CalendarService'
import { hyperKeyService, readHyperKeyConfig, clearCapsRemapSync } from './modules/hyperKey'
import { textExpansion } from './modules/textExpansion'
// 系统命令与窗口管理（M2）
import { registerSystemCommandIpc } from './modules/systemCommands'
// 文件搜索（M5.3）
import { registerFileSearchIpc } from './modules/fileSearch'
import { registerE2EProbe } from './e2eProbe'
import { registerFloatingNoteIpc } from './modules/floatingNote'
import { focusShield, registerFocusShieldIpc } from './modules/focusShield'
// AI 服务（P0-3：OpenAI 兼容 API + 流式响应）
import { registerAIIpc } from './services/AIService'
import { registerMcpIpc, stopAllMcpServers } from './services/mcp/store'
import {
  registerAutomationIpc,
  startAutomationEngine,
  stopAutomationEngine
} from './modules/automation/store'
// 内置插件自动安装
import { autoInstallBuiltinPlugins } from './launcher/builtinPlugins'
// 插件静默自动更新（P-3.2）
import { startPluginAutoUpdate, stopPluginAutoUpdate } from './launcher/pluginAutoUpdate'
// 命令别名（P2-8）
import { registerAliasIpc } from './services/AliasService'
// 搜索历史（P2-9）
import { registerSearchHistoryIpc } from './services/SearchHistoryService'
// 浏览器标签（P1-5：Chrome/Safari 标签搜索与切换）
import { registerBrowserTabsIpc } from './services/BrowserTabsService'
import { registerSystemInfoIpc } from './services/SystemInfoService'
import { registerWindowSwitcherIpc } from './services/WindowSwitcherService'
import { registerProcessIpc } from './services/ProcessService'
import { registerMenuBarIpc } from './services/MenuBarService'
import { registerTrashIpc } from './services/TrashService'
import { registerDictionaryIpc } from './services/DictionaryService'
import { typedHandle } from './ipc/typedIpc'
import {
  defaultFirstPartyContext,
  installNavigationGuards,
  installPermissionGuards,
  resolveAppRoot
} from './security/navigationGuard'

let mainWindow: BrowserWindow | null = null

// ─────────── 全局 webContents 安全兜底 ───────────
// 判定与装配都在 ./security/navigationGuard（判据是纯函数，可单测）：
// - 导航 / 服务端重定向白名单：仅第一方（产物目录 file:// / devServer / plugin:// /
//   frond:// / devtools / about:blank）+ 内部哨兵 frond-region://（原录屏框选用，
//   录屏已移除、哨兵暂留——第一方覆盖层类功能的预留位）
// - window.open 一律 deny，http(s) 转系统浏览器
// - <webview> 拒绝（纵深防御）
// - 权限请求白名单：录屏移除后暂无第一方功能申请 media，白名单保留媒体项作预留
const firstPartyCtx = defaultFirstPartyContext(resolveAppRoot())
installNavigationGuards(firstPartyCtx)

// 系统托盘相关
let tray: Tray | null = null

// ─────────── frond:// URL Scheme（B4）───────────────────
// 单实例锁：Windows 上 frond:// 深链依赖「第二实例退出 + first 实例收 second-instance argv」，
// 锁也是启动器形态（Raycast 式常驻）应有的约束——二次启动不再堆出第二个进程
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else if (process.defaultApp && process.argv.length >= 2) {
  // dev 两态：开发态应用是 electron 二进制 + 入口脚本，注册协议必须把入口脚本
  // 作为执行参数带上，否则系统唤起 frond:// 时不知道要加载哪个入口；
  // 打包态（process.defaultApp 为 false）只注册 scheme 即可
  app.setAsDefaultProtocolClient('frond', process.execPath, [resolve(process.argv[1]!)]) // defaultApp 分支 argv[1] 必为脚本路径
} else {
  app.setAsDefaultProtocolClient('frond')
}

// frond:// 深链缓冲：open-url / 冷启动 argv 可能在 app ready（窗口/服务未建）前到达，
// 先入队，whenReady 末尾统一放行
let frondRoutesReady = false
const pendingFrondUrls: string[] = []

function handleFrondUrl(raw: string): void {
  if (frondRoutesReady) {
    routeFrondUrl(raw)
  } else if (!pendingFrondUrls.includes(raw)) {
    pendingFrondUrls.push(raw)
  }
}

/** frond:// 路由执行（路由表见 launcher/frondUrl.ts）；未识别路由静默忽略并 log */
function routeFrondUrl(raw: string): void {
  const route = parseFrondUrl(raw)
  if (!route) {
    console.warn('[Main] frond:// 未识别路由，忽略:', raw)
    return
  }
  switch (route.kind) {
    case 'launcher':
      // frond://launcher → 唤起胶囊窗
      showLauncherWindow()
      break
    case 'settings': {
      // frond://settings → 主窗设置路由；与 create-new-window IPC 的 /settings 分支
      // 完全一致（独立设置窗尺寸 + route-taken 让位通知）
      createAppWindow('/settings', true, 800, 786)
      mainWindow?.webContents.send('app:route-taken', { path: '/settings' })
      break
    }
    case 'plugin': {
      // frond://plugin/<id> → 胶囊窗打开插件（复用 launcher:openPlugin 内部路径；
      // 插件未安装/停用时由 openPlugin 弹通知兜底）
      showLauncherWindow()
      const capsule = getLauncherWindow()
      if (capsule) openPlugin(capsule, route.pluginId, null)
      break
    }
  }
}

// mac：运行中/冷启动经系统深链唤起（open-url 先于 ready 触发时由缓冲兜住）
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleFrondUrl(url)
})

// win/linux：第二实例退出，第一实例在此收尾——argv 携带 frond:// 深链则路由，
// 普通二次启动也唤起胶囊（对齐 mac activate 行为）
app.on('second-instance', (_event, argv) => {
  const deepLink = argv.find((a) => typeof a === 'string' && /^frond:\/\//i.test(a))
  if (deepLink) {
    handleFrondUrl(deepLink)
  } else if (app.isReady()) {
    showLauncherWindow()
  }
})

// win/linux 冷启动：open-url 不触发，深链直接出现在启动 argv 里（mac 走 open-url，
// 此处按 URL 去重缓冲，不会二次路由）
const launchFrondUrl = process.argv.find((a) => typeof a === 'string' && /^frond:\/\//i.test(a))
if (launchFrondUrl) handleFrondUrl(launchFrondUrl)

// 性能基线（M0）：内存快照定时器（will-quit 时清理）
let memorySnapshotTimer: ReturnType<typeof setInterval> | null = null

/** 按 process 类型聚合 workingSet（KB），写性能日志 */
function logMemorySnapshot(): void {
  try {
    const byType: Record<string, { count: number; workingSetKB: number }> = {}
    for (const m of app.getAppMetrics()) {
      const type = m.type ?? 'unknown'
      byType[type] ??= { count: 0, workingSetKB: 0 }
      byType[type].count += 1
      byType[type].workingSetKB += m.memory?.workingSetSize ?? 0
    }
    log.info('perf', `memory snapshot: ${JSON.stringify(byType)}`)
  } catch (e) {
    // 批 7b 空 catch 清账（原注释：* noop）
    log.debug('index', '* noop', e)
  }
}

// 全局异常兜底，防止未捕获异常导致主进程崩溃。
// 统一走 LogService：console 留痕 + ring buffer / SQLite / 磁盘（见 LogService.installGlobalLogHandlers）
installGlobalLogHandlers()

// 全局快捷键配置已移至 modules/globalShortcuts.ts

// 抑制 macOS 输入法相关的警告（需要在应用启动前设置）
if (process.platform === 'darwin') {
  // 拦截并过滤 IMK 相关的错误消息
  const originalWrite = process.stderr.write.bind(process.stderr)
  type StderrWriteCallback = (error: Error | null | undefined) => void
  function filteredStderrWrite(chunk: string | Uint8Array, callback?: StderrWriteCallback): boolean
  function filteredStderrWrite(
    chunk: string | Uint8Array,
    encoding: BufferEncoding,
    callback?: StderrWriteCallback
  ): boolean
  function filteredStderrWrite(...writeArgs: unknown[]): boolean {
    const chunk = writeArgs[0] as string | Uint8Array
    if (typeof chunk === 'string' && chunk.includes('IMKCFRunLoopWakeUpReliable')) {
      return true
    }
    // 原样透传参数，保持 Node write 的两种调用形态
    return (originalWrite as (...passthroughArgs: unknown[]) => boolean)(...writeArgs)
  }
  process.stderr.write = filteredStderrWrite
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
void app
  .whenReady()
  .then(() => {
    // 常驻开启 Chromium 无障碍树渲染：VoiceOver 等辅助工具、系统自动化、
    // 依赖 AX 的功能（菜单栏搜索类）都需要渲染层可被辅助功能读取。
    // Electron 默认只在探测到辅助技术时开启，这里显式常开（对齐 Raycast）。
    app.setAccessibilitySupportEnabled(true)

    // 权限请求白名单（必须 ready 后、用真实 session 注册）。
    // 不注册时 Electron **默认放行**权限请求 —— 等于任意 web 内容都能静默开麦/开摄像头。
    // 白名单见 security/navigationGuard.ts 的 PERMISSION_ALLOWLIST（第一方 media 必需）。
    installPermissionGuards(session.defaultSession, firstPartyCtx)

    // 注册协议（image:// 和 video://）
    registerProtocols()

    // 初始化 SQLite 数据库（最早：service 层后面要拿 handle）
    installDatabase()
    // 把旧 electron-store JSON 一次性导入 SQLite（幂等，第二次启动跳过）
    try {
      runDataMigrations()
    } catch (error) {
      console.error('[Main] 数据迁移失败:', error)
    }
    // v4：番茄钟 duration_ms 存量秒值 ×1000 修正（必须在 v2 legacy 导入之后）
    try {
      runPomodoroDurationMsMigration()
    } catch (error) {
      console.error('[Main] 番茄钟时长迁移失败:', error)
    }
    // 从 pref_preferences 读 telemetry_mode（在 installDatabase() 之后）
    try {
      log.loadTelemetryMode()
    } catch (e) {
      // 批 7b 空 catch 清账（原注释：* ignore）
      log.debug('index', '* ignore', e)
    }

    // 崩溃上报（opt-in）：用户开过才启动本地收集 + 挂进程异常退出观察者
    crashReport.startup()

    // Set app user model id for windows（须与 electron-builder.yml 的 appId 一致，
    // 否则 Windows 通知/任务栏身份与安装包脱节）
    electronApp.setAppUserModelId('com.frond.app')

    // 应用菜单：显式构建，去掉默认菜单的 ⌘R reload 占用（页面 ⌘R 刷新靠它放行）
    installApplicationMenu({ getMainWindow: () => mainWindow })

    // 窗口快捷键 watcher：dev F12 DevTools；⌘R/Ctrl+R 拦截后转发刷新 IPC
    // （替代 optimizer.watchWindowShortcuts——后者在生产无条件吞掉 ⌘R 且无开关）
    app.on('browser-window-created', (_, window) => {
      watchWindowShortcuts(window)
    })

    // 注册所有 IPC 处理器（模块化）
    // 注：electron-vite 脚手架的 ipcMain.on('ping') 测试通道已删除（B13 死通道清理）
    registerNotificationIpcHandlers()
    registerApplicationsIpcHandlers()
    registerPomodoroHandlers(pomodoroStore, () => mainWindow)
    registerMiniWindowIpc()
    registerSnippetIpcHandlers(snippetStore)
    registerTagIpcHandlers(tagStore)
    registerPrettierIpcHandlers(preferencesStore)
    registerPreferencesIpcHandlers(preferencesStore)
    registerFoldersIpcHandlers(folderStore, () => mainWindow)
    registerUsageIpcHandlers(usageStore)
    registerAutoUpdateIpcHandlers()
    registerSystemInfoIpcHandlers()
    registerLogIpcHandlers()
    registerCrashIpcHandlers()
    registerMigrationIpcHandlers(() => mainWindow)
    registerNotesIpc()
    registerCloudBackupIpcHandlers()
    registerRemindersIpc()
    registerPermissionsIpcHandlers()
    registerLauncher(() => mainWindow)

    // 创建新窗口 IPC 处理
    typedHandle('create-new-window', (_event, { route }) => {
      // route 必须是形如 /xxx 的应用内路径：非字符串会让 startsWith 抛 TypeError，
      // 非斜杠开头则不是合法路由
      if (typeof route !== 'string' || !route.startsWith('/')) {
        return false
      }
      // Raycast 化：设置窗口使用更小的尺寸，更接近 Raycast 设置窗口
      // 注意：route 可能带 ?immersive=1 查询参数，所以用 startsWith 判断
      // 尺寸严格对齐 Raycast 设置窗口：800 x 786
      // B59b：重型工作模块走各自的紧凑尺寸（此前吃 1450×950 全局默认——用户反馈「窗口太大」）
      if (route.startsWith('/settings')) {
        createAppWindow(route, true, 800, 786)
      } else {
        const size = windowSizeForRoute(route, { width: 1450, height: 950 })
        createAppWindow(route, true, size.width, size.height)
      }
      // 通知主窗口：独立模块窗已接管该路由；若主窗口正显示同一路由则让位回 Hub
      // （避免「胶囊开出沉浸窗 + 主窗口还停在同模块」的两份界面）
      mainWindow?.webContents.send('app:route-taken', { path: route })
      return true
    })

    // 主窗口判定：App 级单例（番茄钟桥等）只在主窗口初始化，
    // 避免 dock/tray 开出的第二个窗口重复创建计时器实例
    typedHandle('app:isPrimaryWindow', (event) => {
      return mainWindow?.webContents.id === event.sender.id
    })

    // 隐藏主窗口（Raycast 式退后台）。用途：模块路由被沉浸窗接管时主窗「让位」、
    // 设置页 ESC 无历史可退时兜底——替代旧实现 router.push('/')（Home 退役后
    // '/' 重定向 /settings，主窗会永久停在设置页）
    typedHandle('app:hideMainWindow', () => {
      const main = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
      if (main?.isVisible()) main.hide()
      return undefined
    })

    // 剪贴板历史：IPC + 轮询启动（will-quit 时停止）
    registerClipboardHistoryIpc()
    clipboardHistory.start()

    // 截图库 OCR 索引（V4 P1-10，对齐 Raycast Search Screenshots）
    registerShotIndexIpc()

    // 截图与标注（electron-screenshots 接管，见 modules/screenshot.ts 与 HANDOFF §11）。
    // 这一行是补回来的：registerScreenshotHandlers() 此前全仓零调用方（基线里就是），
    // 所以 screenshot:startCapture 这类 handler 从来没注册过 —— ⌥⇧S 与页面按钮都是空响。
    registerScreenshotHandlers()

    // 系统日历只读（V4 P0-1 批次4：根搜索下一个会议）
    registerCalendarIpc()
    calendarService.startAutoJoinWatcher()

    // 轻量多设备同步（V4 批次6：后写覆盖 + 快照）
    registerDataSyncIpc()

    // Hyper Key（V4 P1-8）：启用态在启动时重申系统重映射（不做 LaunchAgent 持久化）
    if (isMacRuntime() && readHyperKeyConfig().enabled) {
      void hyperKeyService.enable().catch((error) => {
        console.warn('[HyperKey] 启动重申失败:', error)
      })
    }
    reminderService.start()

    // 片段文本扩展（M5.1）：按配置订阅全局按键（无触发词时无副作用）
    textExpansion.start()

    // 回收站保留期（B58 批C）：软删除超 30 天的片段启动时永久清除
    try {
      const purged = snippetRepository.purgeExpiredTrash(TRASH_RETENTION_DAYS)
      if (purged > 0) console.log(`[snippets] 回收站保留期清理：${purged} 条`)
    } catch (error) {
      console.warn('[snippets] 回收站保留期清理失败:', (error as Error).message)
    }

    // 系统命令 / 窗口管理通道（M2）
    registerSystemCommandIpc()

    // E2E 探针（仅 FROND_E2E=1 时注册读取通道；生产环境这条 IPC 根本不存在）
    registerE2EProbe()

    // 文件搜索通道（M5.3）
    registerFileSearchIpc()
    // 文件索引（#9，macOS / Windows）：批5 起在独立进程运行——这里只负责拉起 worker
    void fileIndexClient.ensureStarted()
    registerFloatingNoteIpc()

    // 专注护盾（应用屏蔽）：配置/上报通道 + 检测轮询
    registerFocusShieldIpc()
    focusShield.start()

    // AI 服务（P0-3）
    registerAIIpc()
    registerMcpIpc()
    // Automations（P-4④）：设置页读写 + 引擎心跳的 IPC
    registerAutomationIpc()
    // 心跳必须单独起：只注册 IPC 的话，任务写得进库，但到点没人触发
    startAutomationEngine()

    // 内置插件自动安装（开箱即用）
    autoInstallBuiltinPlugins()

    // 插件静默自动更新（P-3.2）：启动后 30s 首查 + 每 24h 一查；新版本多声明权限即拦下待确认
    startPluginAutoUpdate()

    // 命令别名（P2-8）
    registerAliasIpc()

    // 搜索历史（P2-9）
    registerSearchHistoryIpc()

    // 浏览器标签（P1-5）
    registerBrowserTabsIpc()

    // 系统信息（阶段3.3a）
    registerSystemInfoIpc()

    // 窗口切换（阶段3.3b）
    registerWindowSwitcherIpc()

    // 进程查杀（Kill Process，Raycast parity）
    registerProcessIpc()

    // 菜单栏项搜索（Raycast parity）
    registerMenuBarIpc()

    // 回收站管理（阶段3.3c）
    registerTrashIpc()

    // 词典（阶段3.3d）
    registerDictionaryIpc()

    // 性能基线（M0）：内存快照（启动后 5s 一次 + 每 10 分钟）。
    // 原注册的 app:memory-snapshot 按需查询通道无任何调用方，已按 dead-channel 清理移除；
    // e2e perf-baseline 经 app.evaluate 直接取 metrics，不走 IPC
    setTimeout(logMemorySnapshot, 5000)
    memorySnapshotTimer = setInterval(logMemorySnapshot, 10 * 60 * 1000)

    // Raycast 化：主窗口 autoShow=false，不自动显示，只作为后台支撑
    mainWindow = createAppWindow(undefined, false)

    // 窗口关闭时置空引用，防止操作已销毁窗口
    mainWindow.on('closed', () => {
      mainWindow = null
    })

    // Raycast 化：应用启动后不显示主窗口，直接显示启动器
    // 主窗口作为功能的后台支撑（设置/独立模块窗等需要时才显示）
    setTimeout(() => {
      showLauncherWindow()
    }, 300)

    // frond:// 冷启动缓冲路由放行（窗口/IPC/服务均已就绪）
    frondRoutesReady = true
    for (const url of pendingFrondUrls.splice(0)) {
      routeFrondUrl(url)
    }

    // 初始化系统托盘（传入窗口重建回调，解决 macOS 关闭窗口后托盘无法恢复的问题）
    tray = createAppTray(
      () => mainWindow,
      () => {
        // Raycast 化：重建主窗口时不自动显示，只作为后台支撑
        mainWindow = createAppWindow(undefined, false)
        mainWindow.on('closed', () => {
          mainWindow = null
        })
        return mainWindow
      }
    )

    // 设置 Dock 菜单（macOS）
    setupAppDockMenu(() => mainWindow)

    // 注册全局快捷键（showHide 窗口显隐；音乐快捷键已随模块移除）
    registerAppGlobalShortcuts(() => mainWindow)

    // 崩溃上报：发现上次异常退出的新转储时提醒一次（放在托盘/快捷键之后，不抢启动）
    void crashReport.notifyPendingCrashes()

    app.on('activate', function () {
      // Raycast 化：点击 Dock 图标时显示启动器，而不是主窗口
      showLauncherWindow()
    })

    // 应用退出前清理
    app.on('will-quit', () => {
      clipboardHistory.stop()
      textExpansion.stop()
      // MCP 是自己 spawn 的长命子进程：不显式杀就会留成孤儿
      stopAllMcpServers()
      stopAutomationEngine()
      stopPluginAutoUpdate()
      if (memorySnapshotTimer) {
        clearInterval(memorySnapshotTimer)
        memorySnapshotTimer = null
      }
      unregisterAppGlobalShortcuts()
      // 清理托盘 / Dock 菜单定时器
      destroyTrayTimer()
      destroyDockMenuTimer()
      // 关闭 SQLite（最后：让所有 service 完成收尾才关）
      log.flush() // B53-11：退出前把微批里的 info 日志落库
      try {
        uninstallDatabase()
      } catch (error) {
        console.error('[Main] 关闭数据库失败:', error)
      }
      if (tray) {
        tray.destroy()
        tray = null
      }
    })
  })
  .catch((error: unknown) => {
    // 启动装配失败必须当场退出（B49）：半初始化进程无窗口无托盘无 IPC，用户只会
    // 看到「进程在跑但什么都不响应」。典型失败 = schema 迁移抛错（ensureOpen 刻意
    // 重抛防带伤运行），此前只被全局兜底记一行日志，应用却继续活着
    console.error('[Main] 启动装配失败，即将退出:', error)
    try {
      dialog.showErrorBox(
        'Frond 启动失败',
        `应用初始化失败，即将退出。\n\n${(error as Error)?.stack ?? String(error)}`
      )
    } finally {
      app.exit(1)
    }
  })

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
// 退出前还原系统键盘映射（同步执行保证 will-quit 窗口期内完成）
app.on('will-quit', () => {
  try {
    if (hyperKeyService.isActive()) clearCapsRemapSync()
  } catch (e) {
    // 批 7b 空 catch 清账（原注释：* 非 mac / hidutil 不可用）
    log.debug('index', '* 非 mac / hidutil 不可用', e)
  }
})

app.on('window-all-closed', () => {
  if (shouldQuitOnAllWindowsClosed()) {
    app.quit()
  }
})
