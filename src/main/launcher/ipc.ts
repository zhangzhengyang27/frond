/**
 * Leaf · 启动器 IPC
 *
 * launcher:*  —— 胶囊窗控制 / 插件管理（主窗口管理页与胶囊窗 UI 使用）
 * plugapi:*   —— 插件受控 API（专用 preload 经 contextBridge 暴露，按 sender 解析插件身份）
 */
import { BrowserWindow, clipboard, dialog, Notification, shell, ipcMain } from 'electron'
import { typedHandle } from '../ipc/typedIpc'
import {
  listPlugins,
  importFromFolder,
  removePlugin,
  setPluginEnabled,
  getPluginsRoot
} from './pluginStore'
import {
  openPlugin,
  closeActivePlugin,
  openPluginDevtools,
  setExpandHeight,
  setSubInput,
  relaySearchInput,
  detachActivePlugin,
  getContextBySender,
  getActiveContext,
  popActiveView,
  popActiveViewFromHost,
  setDeclaredList,
  setDeclaredView,
  submitPluginFormValues,
  clearDeclaredList,
  runPluginCallback,
  getPluginPreference,
  listPluginPreferences,
  setPluginPreference,
  proxyPluginFetch,
  reloadPluginView
} from './runtime'
import {
  showLauncherWindow,
  getLauncherWindow,
  getLastShowLatencyMs,
  setLauncherPinned,
  setLauncherCompact
} from './window'
import { countE2E } from '../e2eProbe'
import {
  isActionCommand,
  sanitizeAlertRequest,
  sanitizePluginOpenableUrl
} from '../../shared/plugin-protocol'
import {
  alertPressedAction,
  beginPluginAlert,
  buildAlertDialogOptions,
  endPluginAlert
} from './pluginAlert'
import {
  listMarket,
  installFromMarket,
  marketIndexInfo,
  setRemoteIndexUrl,
  refreshRemoteIndex
} from './market'
import {
  listDevPlugins,
  addDevPlugin,
  removeDevPlugin,
  setDevAutoReload,
  reloadDevPlugin
} from './devPlugins'
import { textExpansion } from '../modules/textExpansion'
import { probeGlobalKeys, globalKeyHook } from '../modules/globalKeys'
import { getLauncherDocStore } from './docStore'
import { confirmPluginImport } from './pluginConfirm'
import {
  addPluginTask,
  listPluginTasks,
  removePluginTask,
  removeTasksOwnedByPlugin
} from '../modules/automation/store'
import {
  hyperKeyService,
  normalizeQuickPress,
  readHyperKeyConfig,
  writeHyperKeyConfig
} from '../modules/hyperKey'
import { safeOpenablePath } from '../utils/openPathGuard'
import { type PluginPermission } from '../../shared/plugin-protocol'
import { isValidQuicklinkUrl, FIRST_PARTY_PAGE_VALUES, type Quicklink } from '../../shared/commands'
import { getFaviconPath } from './favicon'
import {
  readHotkeyConfig,
  writeHotkeyConfig,
  registerAllHotkeys,
  getHotkeyConflicts,
  getRegisteredAccelerators
} from './hotkeys'
import { dispatchMainAction } from './actionHandlers'
import { setPluginSearchItems, listPluginSearchItems } from './pluginSearchIndex'
import { fileIndex } from '../modules/fileIndex/service'

/** Quicklinks kv 命名空间（M2.3） */
const QUICKLINK_NS = 'sys.quicklinks'

/** 插件单条文档的大小上限（防无界写入变成磁盘耗尽 DoS） */
const PLUGIN_DOC_MAX_BYTES = 256 * 1024
/** 每插件文档条数上限：单条已限大小，不限条数可无限累积耗尽磁盘 */
const PLUGIN_DOC_MAX_COUNT = 500

/**
 * 本地目录导入插件前的人工确认：渲染端（含被攻陷场景）可传任意目录，
 * 系统级模态框是攻击者无法自动点掉的一道闸。
 * E2E 环境（LEAF_E2E=1）旁路：Playwright 无法点击原生对话框。
 */

/**
 * 敏感权限判定（声明制）：manifest.permissions 包含对应权限才放行。
 * 未声明 / 旧版 manifest（无 permissions 字段）一律视为未授权（fail closed）。
 */
function hasPluginPermission(
  plugin: { permissions?: string[] },
  permission: PluginPermission
): boolean {
  return Array.isArray(plugin.permissions) && plugin.permissions.includes(permission)
}

/**
 * 插件表变了（装 / 卸 / 启停 / 市场更新）→ 通知胶囊把插件命令重拉一遍。
 *
 * 以前这条只能等下一次 `launcher:shown`：在管理页装完插件、胶囊还开着的时候，
 * 搜索框里就是搜不到那条新命令，用户得先把胶囊收起来再唤起一次。
 * 与 `launcher:plugin-search-index-updated` 同一个路子（单向推送，不入 typedHandle 契约）。
 */
/**
 * 命令表变了（插件装卸/启停/市场更新，以及 MCP 工具清单变化）：胶囊不必收起再唤起。
 * 名字叫 command-table 而不是 plugin-table，是因为重拉方在渲染端要同时拉两路
 * （Registry 里的 MCP 工具行 + 插件命令行）。
 */
/**
 * @param source 哪一路命令表变了。渲染端据此**只重拉那一路**——一次 MCP 变化不该
 *   连带把系统命令、模块行、Quicklinks 全重算一遍（推送与唤起同频时会把选中位反复归零）。
 */
export function notifyCommandTableChanged(source: 'plugins' | 'mcp' = 'plugins'): void {
  // 播给所有窗：胶囊与主窗的 ⌘K 面板共用同一份命令源（P-7②），
  // 只推胶囊会让面板拿着一张过期的表
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('launcher:command-table-changed', { source })
  }
}

// 白名单从 shared 的 FIRST_PARTY_PAGE_VALUES 派生（与 FirstPartyPage 类型同源）：
// 此前手写 8 项与类型 18 项漂移，⌘K/首页打开 ai/notes 等页面被静默丢弃
const FIRST_PARTY_PAGES = new Set<string>(FIRST_PARTY_PAGE_VALUES)

import { backup, getSyncConfig, restore, setSyncConfig, testConnection } from './sync'

export function registerLauncherIpc(): void {
  typedHandle('launcher:listPlugins', () => listPlugins())

  // 性能基线（M0）：胶囊唤起耗时
  typedHandle('launcher:perf', () => ({ lastShowLatencyMs: getLastShowLatencyMs() }))
  // P-1.3 keep-open：返回生效值，渲染端据此对齐指示器
  typedHandle('launcher:setPinned', (_e, { pinned }) => {
    countE2E('launcher:setPinned')
    return { pinned: setLauncherPinned(pinned) }
  })

  // 紧凑模式（P-6⑤）：渲染端量好搜索行的高度报过来，主进程只负责夹住并改窗口
  typedHandle('launcher:setCompact', (_e, { compact, height }) => {
    setLauncherCompact(compact === true, Number(height))
  })

  typedHandle('launcher:installFromFolder', async (_e, { dirPath }) => {
    try {
      const dir = String(dirPath ?? '')
      if (!(await confirmPluginImport(dir))) {
        return { success: false, error: 'canceled' }
      }
      const plugin = importFromFolder(dir)
      notifyCommandTableChanged('plugins')
      return { success: true, plugin }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ─────────── 插件市场（M3.5 静态 v0 + P-3.1 远程索引）───────────
  typedHandle('launcher:market:list', () => listMarket())
  typedHandle('launcher:market:indexInfo', () => marketIndexInfo())
  typedHandle('launcher:market:setIndexUrl', (_e, { url }) => setRemoteIndexUrl(String(url ?? '')))
  typedHandle('launcher:market:refreshIndex', () => refreshRemoteIndex())
  typedHandle('launcher:market:install', async (_e, { entryId }) => {
    const result = await installFromMarket(String(entryId ?? ''))
    if (result.success) notifyCommandTableChanged('plugins')
    return result
  })
  // 版本更新通道：与 install 同为覆盖式安装；成功后就地重载存活插件视图
  typedHandle('launcher:market:update', async (_e, { entryId }) => {
    const result = await installFromMarket(String(entryId ?? ''))
    if (result.success && result.plugin) {
      reloadPluginView(result.plugin.id, getLauncherWindow())
      notifyCommandTableChanged('plugins')
    }
    return result
  })

  // ─────────── 插件热重载开发模式（对标 ray develop）───────────
  typedHandle('launcher:devPlugins:list', () => listDevPlugins())
  typedHandle('launcher:devPlugins:add', async (_e, { dirPath }) => {
    const dir = String(dirPath ?? '')
    if (!(await confirmPluginImport(dir))) {
      return { ok: false, error: 'canceled' }
    }
    return addDevPlugin(dir)
  })
  // 只解除开发跟踪（停 watcher + 删 kv）；卸载插件本体走 launcher:removePlugin
  typedHandle('launcher:devPlugins:remove', (_e, { pluginId }) =>
    removeDevPlugin(String(pluginId ?? ''))
  )
  typedHandle('launcher:devPlugins:setAutoReload', (_e, { pluginId, autoReload }) =>
    setDevAutoReload(String(pluginId ?? ''), autoReload === true)
  )
  // 手动重载单插件（覆盖重装 + 就地重载活动视图）
  typedHandle('launcher:devPlugins:reload', (_e, { pluginId }) =>
    reloadDevPlugin(String(pluginId ?? ''), getLauncherWindow())
  )

  // Hyper Key（V4 P1-8 方案 A）：配置读写 + 即时应用/还原系统重映射
  typedHandle('launcher:hyperkey:getConfig', () => readHyperKeyConfig())
  typedHandle('launcher:hyperkey:setEnabled', async (_e, { enabled }) => {
    const next = writeHyperKeyConfig({ enabled: enabled === true })
    try {
      if (next.enabled) await hyperKeyService.enable()
      else await hyperKeyService.disable()
      return { ok: true, config: next }
    } catch (error) {
      return { ok: false, error: (error as Error).message, config: next }
    }
  })
  typedHandle('launcher:hyperkey:setQuickPress', (_e, { action }) => {
    const next = writeHyperKeyConfig({ quickPress: normalizeQuickPress(action) })
    return { ok: true as const, config: next }
  })

  typedHandle('launcher:pluginDevtools', (_e, { pluginId }) => {
    const ok = openPluginDevtools(String(pluginId ?? ''))
    return ok ? { success: true } : { success: false, error: '插件未打开：先在胶囊中运行该插件' }
  })

  typedHandle('launcher:removePlugin', (_e, { pluginId }) => {
    try {
      // 运行中的插件先关闭，避免视图挂着继续请求已删除资源
      const active = getActiveContext()
      const capsule = getLauncherWindow()
      if (active?.plugin.id === pluginId && capsule) {
        closeActivePlugin(capsule)
      }
      removePlugin(pluginId)
      // 它登记的定时任务一起清掉：留着的话下次装回来会看到不属于它的旧任务，
      // 而且那条任务会在没人知道的情况下继续排下去
      removeTasksOwnedByPlugin(pluginId)
      notifyCommandTableChanged('plugins')
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  typedHandle('launcher:getPluginState', () => {
    const ctx = getActiveContext()
    return {
      open: !!ctx,
      pluginId: ctx?.plugin.id ?? null,
      pluginName: ctx?.plugin.name ?? null,
      subInputPlaceholder: ctx?.subInputPlaceholder ?? null,
      // 声明式列表（M3.1）：胶囊 mount 前的一次性推送收不到，靠本次拉取兜底
      declaredList: ctx?.declaredList ?? null,
      // React 表单视图（#11 M2）：同上兜底
      declaredForm: ctx?.declaredForm ?? null,
      declaredLoading: ctx?.declaredLoading ?? false,
      declaredEmptyMessage: ctx?.declaredEmptyMessage ?? null,
      // Action 命令状态（P-2.2）：headless = 声明为无界面，attached = 视图是否真挂上了窗
      // 给 e2e 用的判据：「没挂视图」这件事在 DOM 上看不出来（不通知时胶囊也没变化）
      headless: ctx?.headless ?? false,
      attached: ctx?.attached ?? false
    }
  })

  typedHandle('launcher:setPluginEnabled', (_e, { pluginId, enabled }) => {
    const updated = setPluginEnabled(pluginId, enabled)
    if (updated) notifyCommandTableChanged('plugins')
    return updated ? { success: true, plugin: updated } : { success: false }
  })

  typedHandle('launcher:selectPluginFolder', async (e) => {
    const { BrowserWindow, dialog } = await import('electron')
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined!, {
      properties: ['openDirectory'],
      title: '选择插件目录（需包含 plugin.json）'
    })
    if (canceled || filePaths.length === 0) return { success: false, canceled: true }
    return { success: true, dirPath: filePaths[0] }
  })

  ipcMain.on('launcher:openPluginsDir', () => {
    void shell.openPath(getPluginsRoot())
  })

  // 第一方内联页（Raycast 式）：外部入口（⌘K）唤起胶囊窗并打开对应页
  ipcMain.on('launcher:openFirstParty', (_e, payload: { page?: string }) => {
    const page = payload?.page
    if (!page || !FIRST_PARTY_PAGES.has(page)) return
    showLauncherWindow()
    getLauncherWindow()?.webContents.send('launcher:firstparty:open', { page })
  })

  // MCP 工具从 ⌘K 面板触发时交给胶囊跑（P-4② 收尾）：面板既没有参数格也没有结果页，
  // 与其在面板里做一套残缺的（无参工具能跑、带参的静默失败），不如两个入口同一个行为。
  ipcMain.on(
    'launcher:runMcpTool',
    (
      _e,
      payload: {
        serverId?: string
        serverLabel?: string
        tool?: string
        argSpecs?: unknown
      }
    ) => {
      const serverId = typeof payload?.serverId === 'string' ? payload.serverId.slice(0, 32) : ''
      const tool = typeof payload?.tool === 'string' ? payload.tool.slice(0, 64) : ''
      // 只认 id + 工具名，且把清单原样转给胶囊：真正的门槛在执行侧
      // （mcp:runTool 认已存配置的 id、认活会话里的工具名，见 main/services/mcp/store.ts）
      if (!serverId || !tool) return
      showLauncherWindow()
      getLauncherWindow()?.webContents.send('launcher:mcp:run', {
        serverId,
        serverLabel:
          typeof payload?.serverLabel === 'string'
            ? payload.serverLabel.slice(0, 60)
            : serverId,
        tool,
        argSpecs: Array.isArray(payload?.argSpecs) ? payload.argSpecs.slice(0, 6) : []
      })
    }
  )

  ipcMain.on(
    'launcher:openPlugin',
    (_e, payload: { pluginId: string; cmd?: string; args?: Record<string, string> }) => {
      const capsule = getLauncherWindow()
      if (capsule) {
        showLauncherWindow()
        openPlugin(capsule, payload.pluginId, payload.cmd ?? null, payload.args)
      } else {
        showLauncherWindow()
        const created = getLauncherWindow()
        if (created) openPlugin(created, payload.pluginId, payload.cmd ?? null, payload.args)
      }
    }
  )

  // 插件自己压的视图层退回一层（P-2④ 第二半）。与 closePlugin 分开：
  // 合成一个的话，用户在插件里按返回键的结果是整个插件被弹掉。
  ipcMain.on('launcher:popPluginView', () => {
    popActiveViewFromHost()
  })
  ipcMain.on('launcher:closePlugin', () => {
    const capsule = getLauncherWindow()
    if (capsule) closeActivePlugin(capsule)
  })

  // 胶囊窗搜索框输入转发给插件（SubInputChange）
  ipcMain.on('launcher:search-input', (_e, value: string) => {
    relaySearchInput(typeof value === 'string' ? value : '')
  })

  // ─────────── 热键配置（M4：主热键可配置 + 命令级全局热键）───────────
  typedHandle('launcher:hotkeys:getConfig', () => readHotkeyConfig())
  // 最近一轮注册的冲突清单（V4 P0-3：设置页冲突提示）
  typedHandle('launcher:hotkeys:getConflicts', () => getHotkeyConflicts())
  // 统一动作执行端（#4：与窗口无关的动作由 main 注册表分发，全入口共用）
  typedHandle('action:invoke', (_e, { action }) => dispatchMainAction(action))

  // ─────────── 插件搜索索引（#5 插件双通道）───────────
  // 插件（有身份）提交可搜索条目集：manifest searchable 门控在存储层强制执行
  typedHandle('plugapi:submitSearchItems', (e, { items }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return { ok: false, error: 'no plugin context' }
    const ok = setPluginSearchItems(ctx.plugin.id, items)
    if (ok) {
      // 通知胶囊刷新合并缓存（插件可能已关闭，条目需立即可搜）
      const capsule = getLauncherWindow()
      if (capsule && !capsule.isDestroyed()) {
        capsule.webContents.send('launcher:plugin-search-index-updated')
      }
    }
    return { ok }
  })
  // 根搜索合并读取（仅「已启用 + searchable」插件的条目）
  typedHandle('launcher:pluginSearchItems:list', () => listPluginSearchItems())

  // ─────────── 文件索引（#9，macOS / Windows）───────────
  typedHandle('fileIndex:status', () => fileIndex.getStatus())
  typedHandle('fileIndex:addScope', async (e) => {
    const { BrowserWindow, dialog } = await import('electron')
    const win = BrowserWindow.fromWebContents(e.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined!, {
      properties: ['openDirectory'],
      title: '选择要索引的目录'
    })
    if (canceled || filePaths.length === 0) return { ok: false, canceled: true }
    const scopes = fileIndex.getScopes()
    if (!scopes.includes(filePaths[0])) fileIndex.setScopes([...scopes, filePaths[0]])
    return { ok: true as const, scopes: fileIndex.getScopes() }
  })
  typedHandle('fileIndex:removeScope', (_e, { dir }) => {
    fileIndex.setScopes(fileIndex.getScopes().filter((s) => s !== String(dir ?? '')))
    return { ok: true as const, scopes: fileIndex.getScopes() }
  })
  typedHandle('fileIndex:rebuild', () => {
    void fileIndex.rebuild()
    return { ok: true as const }
  })
  typedHandle('fileIndex:setHidden', (_e, { value }) => {
    fileIndex.setHidden(value === true)
  })
  typedHandle('launcher:hotkeys:setMain', (_e, { accelerator }) => {
    const accel = String(accelerator ?? '').trim()
    if (!accel) return { ok: false, error: 'accelerator required' }
    const next = writeHotkeyConfig({ main: accel })
    registerAllHotkeys()
    return { ok: true, config: next }
  })
  typedHandle('launcher:hotkeys:setCommand', (_e, { accelerator, spec }) => {
    const accel = String(accelerator ?? '').trim()
    const config = readHotkeyConfig()
    const commands = { ...config.commands }
    if (spec === null) {
      delete commands[accel]
    } else {
      commands[accel] = spec
    }
    const next = writeHotkeyConfig({ commands })
    registerAllHotkeys()
    return { ok: true as const, config: next, registered: getRegisteredAccelerators() }
  })
  // 两段式直达（GAP_ANALYSIS 维度 5）：字母（a-z）→ 命令 spec
  typedHandle('launcher:hotkeys:setChord', (_e, { letter, spec }) => {
    const key = String(letter ?? '')
      .trim()
      .toLowerCase()
    if (key && !/^[a-z]$/.test(key)) return { ok: false, error: 'letter must be a-z' }
    const config = readHotkeyConfig()
    const chords = { ...config.chords }
    if (spec === null || !key) {
      if (key) delete chords[key]
    } else {
      // 同一命令只保留一个字母：清掉绑定相同 spec 的旧字母
      for (const [l, s] of Object.entries(chords)) {
        if (l !== key && JSON.stringify(s) === JSON.stringify(spec)) delete chords[l]
      }
      chords[key] = spec
    }
    const next = writeHotkeyConfig({ chords })
    registerAllHotkeys()
    return { ok: true, config: next }
  })

  // ─────────── 片段文本扩展（M5.1）───────────
  typedHandle('launcher:expansion:getConfig', () => {
    return {
      ...textExpansion.getConfig(),
      triggerCount: textExpansion.getTriggerCount(),
      hookAvailable: globalKeyHook.isAvailable()
    }
  })
  typedHandle('launcher:expansion:setConfig', (_e, { patch }) =>
    textExpansion.setConfig(patch ?? {})
  )
  // 权限诊断：请用户在 4s 内按任意键，收到事件即辅助功能授权正常
  typedHandle('launcher:expansion:probe', async () => {
    const result = await probeGlobalKeys()
    return { ...result, hookAvailable: globalKeyHook.isAvailable() }
  })

  // ─────────── 插件偏好（M3.2）与网络代理（M3.3）───────────
  // 主窗口管理页读写（显式传 pluginId）
  typedHandle('launcher:getPreference', (_e, { pluginId, name }) =>
    getPluginPreference(String(pluginId ?? ''), String(name ?? ''))
  )
  typedHandle('launcher:setPreference', (_e, { pluginId, name, value }) =>
    setPluginPreference(String(pluginId ?? ''), String(name ?? ''), value)
  )
  // 插件视图自读写（按 sender 解析身份）
  typedHandle('plugapi:getPreference', (e, { name }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return { ok: false, error: 'no plugin context' }
    return getPluginPreference(ctx.plugin.id, String(name ?? ''))
  })
  typedHandle('plugapi:setPreference', (e, { name, value }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return { ok: false, error: 'no plugin context' }
    return setPluginPreference(ctx.plugin.id, String(name ?? ''), value)
  })
  typedHandle('plugapi:fetch', (e, { url, init }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'net')) {
      return { ok: false, error: 'permission denied: net（需在 plugin.json 声明）' }
    }
    return proxyPluginFetch(String(url ?? ''), init ?? {})
  })

  // ─────────── 声明式 List 协议（M3.1）───────────
  typedHandle('plugapi:renderList', (e, { items, push, id }) =>
    setDeclaredList(e.sender.id, items, getLauncherWindow(), { push, id })
  )
  typedHandle('plugapi:clearList', (e) => clearDeclaredList(e.sender.id, getLauncherWindow()))
  // 插件退一层（P-2④ 第二半）：只有明说 push 过的层退得回去，第一层交给胶囊的 ESC 关插件
  typedHandle('plugapi:popView', (e) => popActiveView(e.sender.id))
  // ─────────── React 视图协议（#11）───────────
  typedHandle('plugapi:renderView', (e, { view }) =>
    setDeclaredView(e.sender.id, view, getLauncherWindow())
  )
  // 胶囊表单提交：值经 Callback 钩子回传插件 onSubmit（#11 M2）
  typedHandle('launcher:plugin-form-submit', (_e, { values }) =>
    submitPluginFormValues((values ?? {}) as Record<string, string | boolean>)
  )

  // 胶囊执行条目的 callback 动作
  typedHandle('launcher:plugin-run-action', (_e, { pluginId, itemIndex, actionIndex }) =>
    runPluginCallback(pluginId, itemIndex, actionIndex)
  )

  // ─────────── Quicklinks（M2.3，kv 命名空间 sys.quicklinks）───────────
  typedHandle('launcher:quicklinks:list', () => {
    const store = getLauncherDocStore()
    const doc = store.get(QUICKLINK_NS, 'items')
    return (doc?.data as Quicklink[]) ?? []
  })

  // Quicklink favicon：返回本地缓存文件路径（渲染端走 image:// 加载），失败 null
  typedHandle('launcher:quicklink:favicon', async (_e, { url }) => {
    return getFaviconPath(String(url ?? ''))
  })
  typedHandle('launcher:quicklinks:save', (_e, { items }) => {
    const store = getLauncherDocStore()
    // 入库前校验：Quicklink 会被主进程 shell.openExternal 打开，
    // 只允许 http(s)（file:/自定义协议不允许入库）。id/name 一并验字符串，
    // 因为读出的通道（launcher:quicklinks:list）对渲染端承诺的是 Quicklink[]
    const list = Array.isArray(items) ? items : []
    const safeItems = list.filter(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as Quicklink).id === 'string' &&
        typeof (item as Quicklink).name === 'string' &&
        isValidQuicklinkUrl((item as { url?: unknown }).url)
    ) as Quicklink[]
    store.put(QUICKLINK_NS, 'items', safeItems)
    return { success: true as const, removed: list.length - safeItems.length }
  })

  // ─────────── 插件受控 API（plugapi:*）───────────
  typedHandle('plugapi:getContext', (e) => {
    const ctx = getContextBySender(e.sender.id)
    return ctx
      ? { pluginId: ctx.plugin.id, name: ctx.plugin.name, cmd: ctx.cmd, args: ctx.args }
      : null
  })

  typedHandle('plugapi:setExpandHeight', (e, { height }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || ctx.detached) return false
    if (typeof height !== 'number' || !Number.isFinite(height)) return false
    // 注意：BrowserView 的 fromWebContents 解析不可靠（推送到错误窗口），
    // 胶囊窗统一从 window.ts 取
    const win = getLauncherWindow()
    if (win) setExpandHeight(ctx, win, height)
    return true
  })

  typedHandle('plugapi:setSubInput', (e, { placeholder }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || ctx.detached) return false
    if (typeof placeholder !== 'string') return false
    const win = getLauncherWindow()
    if (win) setSubInput(ctx, win, placeholder)
    return true
  })

  typedHandle('plugapi:notify', (e, { body }) => {
    countE2E('plugapi:notify')
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return false
    if (Notification.isSupported()) {
      new Notification({ title: ctx.plugin.name, body: String(body ?? '') }).show()
    }
    return true
  })

  // ─── 敏感权限强制执行（声明制）：manifest 未声明即按原失败形状拒绝 ───
  typedHandle('plugapi:copyText', (e, { text }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'clipboard.write')) return false
    clipboard.writeText(String(text ?? ''))
    return true
  })

  typedHandle('plugapi:readText', (e) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'clipboard.read')) return ''
    return clipboard.readText()
  })

  typedHandle('plugapi:openPath', (e, { path }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'fs.open')) return false
    // 第三方插件不可信：与 system:openPath 同一守卫（绝对路径 + 拒绝可执行类型）
    const target = safeOpenablePath(path)
    if (!target) return false
    void shell.openPath(target)
    return true
  })

  // 一次取回声明过的全部偏好（P-2.5：getPreferenceValues）
  typedHandle('plugapi:listPreferences', (e) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return { ok: false, error: 'no plugin context' }
    return listPluginPreferences(ctx.plugin.id)
  })

  // 插件的定时任务（P-2③「生命周期外执行」）。三条共同点：
  // owner 由 sender 身份定，插件传不进别人的 id；没声明 schedule 权限一律拒。
  typedHandle('plugapi:scheduleList', (e) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'schedule')) return []
    return listPluginTasks(ctx.plugin.id)
  })
  typedHandle('plugapi:scheduleAdd', (e, { label, cron, cmd, arguments: args }) => {
    countE2E('plugapi:scheduleAdd')
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'schedule')) {
      return { ok: false, error: 'permission denied: schedule（需在 plugin.json 声明）' }
    }
    // 「只能排 mode:'action' 的命令」这条闸要按清单声明判，而清单在 ctx.plugin 里就有。
    // 不查的后果很具体：插件排了一条视图命令，就会在没人看着的时候把界面弹出来。
    return addPluginTask(ctx.plugin.id, { label, cron, cmd, arguments: args }, (code) =>
      isActionCommand(ctx.plugin.commands, code)
    )
  })
  typedHandle('plugapi:scheduleRemove', (e, { id }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'schedule')) {
      return { ok: false, error: 'permission denied: schedule（需在 plugin.json 声明）' }
    }
    return removePluginTask(ctx.plugin.id, String(id ?? ''))
  })

  // open(url)：交给系统浏览器。权限按 net 收（与 fetch 同类：副作用在外部），
  // 协议白名单只留 http/https/mailto——file: 与自定义 scheme 能把参数塞进别的应用
  typedHandle('plugapi:openUrl', (e, { url }) => {
    countE2E('plugapi:openUrl')
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || !hasPluginPermission(ctx.plugin, 'net')) return false
    const target = sanitizePluginOpenableUrl(url)
    if (!target) return false
    void shell.openExternal(target)
    return true
  })

  // Alert：宿主确实有原生模态框（dialog），此前只是没人接。
  // 父窗取 sender 自己的窗（挂在胶囊里就是胶囊，detach 出去就是独立窗），
  // 标题带上插件名——否则第三方代码可以拿一个假冒系统提示的框骗用户点确认。
  typedHandle('plugapi:alert', async (e, { title, message, actions }) => {
    countE2E('plugapi:alert')
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return null
    const alert = sanitizeAlertRequest({ title, message, actions })
    if (!alert) return null
    // 一个插件同时只许挂着一条模态框：不 await alert() 就能排出一串，
    // 用户得一条条点掉才能继续用机器——那是现成的拒绝服务。后到的直接回 null（没选任何动作）
    if (!beginPluginAlert(ctx.plugin.id)) return null
    const options = buildAlertDialogOptions(ctx.plugin.name, alert)
    try {
      // 父窗取 sender 自己的窗：挂在胶囊里是胶囊，detach 出去是独立窗口
      const win = BrowserWindow.fromWebContents(e.sender)
      const result = win
        ? await dialog.showMessageBox(win, options)
        : await dialog.showMessageBox(options)
      return alertPressedAction(alert, result.response)
    } finally {
      endPluginAlert(ctx.plugin.id)
    }
  })

  typedHandle('plugapi:detach', (e) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || ctx.detached) return false
    const win = getLauncherWindow()
    if (!win) return false
    return detachActivePlugin(win)
  })

  typedHandle('plugapi:close', (e) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx || ctx.detached) return false
    const win = getLauncherWindow()
    if (win) closeActivePlugin(win)
    return true
  })

  // ─────────── 插件文档存储（按插件命名空间隔离）───────────
  typedHandle('plugapi:dbPut', (e, { id, data }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return { error: 'no context' }
    if (!id || typeof id !== 'string') return { error: 'id required' }
    try {
      // 按真实 UTF-8 字节数计（string.length 是 UTF-16 code units，纯 CJK 会低估 3 倍）
      if (Buffer.byteLength(JSON.stringify(data ?? null), 'utf8') > PLUGIN_DOC_MAX_BYTES) {
        return { error: 'document too large' }
      }
    } catch {
      return { error: 'document not serializable' }
    }
    // 条数配额：单条 256KB 已限大小，但不限条数可无限累积耗尽磁盘
    const store = getLauncherDocStore()
    if (
      !store.exists(ctx.plugin.id, id) &&
      store.countByPlugin(ctx.plugin.id) >= PLUGIN_DOC_MAX_COUNT
    ) {
      return { error: 'document count limit reached' }
    }
    return store.put(ctx.plugin.id, id, data)
  })

  typedHandle('plugapi:dbGet', (e, { id }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return null
    return getLauncherDocStore().get(ctx.plugin.id, id ?? '')
  })

  typedHandle('plugapi:dbRemove', (e, { id }) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return { error: 'no context' }
    return getLauncherDocStore().remove(ctx.plugin.id, id ?? '')
  })

  typedHandle('plugapi:dbList', (e) => {
    const ctx = getContextBySender(e.sender.id)
    if (!ctx) return []
    return getLauncherDocStore().list(ctx.plugin.id)
  })

  // ─────────── WebDAV 同步（管理页）───────────
  typedHandle('launcher:syncGetConfig', () => getSyncConfig())
  typedHandle('launcher:syncSetConfig', (_e, { config }) => {
    setSyncConfig(config)
    return { success: true as const }
  })
  typedHandle('launcher:syncTest', (_e, { configOverride }) =>
    testConnection(configOverride ?? undefined)
  )
  typedHandle('launcher:syncBackup', () => backup())
  typedHandle('launcher:syncRestore', async () => {
    const result = await restore()
    if (result.ok) {
      // 恢复会全量替换 sys.hotkeys / sys.expansion / sys.quicklinks 文档：
      // 同步重注册热键、刷新扩展开关与触发词缓存，否则内存态与持久化不一致
      // （旧热键仍生效、新触发词不生效），要重启应用才对上
      try {
        registerAllHotkeys()
      } catch (e) {
        console.warn('[Launcher] sync restore: 热键重注册失败:', e)
      }
      try {
        textExpansion.applyConfig(textExpansion.getConfig())
        textExpansion.invalidateTriggers()
      } catch (e) {
        console.warn('[Launcher] sync restore: 文本扩展刷新失败:', e)
      }
    }
    return result
  })
}
