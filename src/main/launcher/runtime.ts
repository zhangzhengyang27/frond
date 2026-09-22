/**
 * Leaf · 启动器插件运行时
 *
 * 管理插件 BrowserView 的完整生命周期：
 * open（胶囊窗挂载）→ hooks(Enter/Ready) → SubInputChange / expandHeight 联动
 * → detach（迁移到独立窗口）/ close → hooks(Leave)。
 *
 * 身份模型：所有存活插件视图注册在 viewsByWebContents（webContentsId → 上下文），
 * 插件 API 通道按 event.sender 解析身份，不依赖"当前激活"状态——detach 后依然可用。
 * active 仅表示"当前挂在胶囊窗下"的视图。
 *
 * 安全模型：contextIsolation 开启、nodeIntegration 关闭、webSecurity 开启，
 * 插件只能通过专用 preload 暴露的 window.launcherApi 受控 API 与主进程通信。
 */
import { BrowserView, BrowserWindow, Notification } from 'electron'
import { join } from 'path'
import { getPlugin, pluginEntryUrl, type InstalledPlugin } from './pluginStore'
import { ensureLauncherWindow, getLauncherWindow } from './window'
import { headlessRunBlocker } from './headlessRun'
import {
  pluginCanGoBack,
  type PluginViewLayer,
  popLayer,
  pushLayer,
  replaceLayer,
  topLayer
} from '../../shared/pluginViewStack'
import { getLauncherDocStore } from './docStore'
import { isLocalAddressLiteral } from './netGuard'
import fetch from 'node-fetch'
import { pinningAgentSelector } from './dnsPinning'
import {
  parsePluginView,
  parsePluginListMeta,
  parsePluginForm,
  isActionCommand,
  PLUGIN_MAX_VIEW_ITEMS,
  type ParsedPluginForm
} from '../../shared/plugin-protocol'
import type { PluginListItem } from '../../shared/plugin-protocol'

/** 胶囊窗搜索行高度（与渲染端 .launcher-search 一致） */
export const SEARCH_ROW_HEIGHT = 64
const WINDOW_WIDTH = 750
const MIN_PLUGIN_HEIGHT = 120
const MAX_WINDOW_HEIGHT = 640

interface PluginViewContext {
  plugin: InstalledPlugin
  view: BrowserView
  cmd: string | null
  /** 命令参数值（多参数命令，胶囊参数表单收集后传入；对标 Raycast launchCommand arguments） */
  args: Record<string, string> | null
  detached: boolean
  subInputPlaceholder: string | null
  expandHeight: number
  /** 声明式 List 协议（M3.1）：插件最近一次提交的列表；null = 未声明（传统 UI 模式） */
  declaredList: PluginListItem[] | null
  /** React 表单视图（#11 M2）：与 declaredList 互斥，后提交者生效 */
  declaredForm: ParsedPluginForm | null
  /**
   * P-2.1/2.2 Action 命令（manifest commands[].mode === 'action'）：视图已创建但
   * **不挂到胶囊窗**，插件只跑逻辑。插件真产出 UI 时由 promoteToVisible 升级为可见。
   */
  headless: boolean
  /** headless 视图是否已升级为可见（非 headless 的常规视图恒为 true） */
  attached: boolean
  /** headless 兜底：既不出 UI 也不自行 close 时到点回收（第三方代码不能无限占着一个视图） */
  headlessTimer: ReturnType<typeof setTimeout> | null
  /** P-2.6：列表视图的伴生状态（Raycast isLoading / emptyView 语义），随快照下发 */
  declaredLoading: boolean
  declaredEmptyMessage: string | null
  /**
   * 插件自己的视图栈（P-2④ 第二半），**含当前层**（末位）。上面 declared* 四个字段是它
   * 的镜像 —— 镜像而不是就地改读法，是为了不动渲染端与既有回调的读法。
   * 栈只在插件明说 push 时生长：判据与为什么不靠数据猜，见 shared/pluginViewStack。
   */
  viewStack: PluginViewBackLayer[]
}

/** 栈里的一层连数据一起存：弹出时原样恢复，而不是要求插件重画一遍 */
export interface PluginViewBackLayer extends PluginViewLayer {
  list: PluginListItem[] | null
  form: ParsedPluginForm | null
  loading: boolean
  emptyMessage: string | null
}

/** Action 命令的回收时限（毫秒）：够跑一次网络请求 + 通知，又不至于漏一个常驻视图 */
export const ACTION_COMMAND_TIMEOUT_MS = 20_000

let active: PluginViewContext | null = null
const viewsByWebContents = new Map<number, PluginViewContext>()

export function getActiveContext(): PluginViewContext | null {
  return active
}

/** 插件 API 按发送者解析身份（detach 后依然有效） */
export function getContextBySender(senderId: number): PluginViewContext | null {
  return viewsByWebContents.get(senderId) ?? null
}

/** M3.1：插件提交声明式列表（校验形状，非法输入整体拒绝；capsule 由 ipc 层注入避免循环依赖） */
/** 把栈顶镜像回 declared* —— 渲染端与既有回调读的是那几个字段 */
function applyTopLayer(ctx: PluginViewContext): void {
  const top = topLayer(ctx.viewStack) as PluginViewBackLayer | null
  ctx.declaredList = top?.list ?? null
  ctx.declaredForm = top?.form ?? null
  ctx.declaredLoading = top?.loading ?? false
  ctx.declaredEmptyMessage = top?.emptyMessage ?? null
}

/** 提交一层：push = 明说「我进下一层」；否则是**当前层重绘**（id 不变则渲染端不换实例） */
function commitLayer(
  ctx: PluginViewContext,
  layer: PluginViewBackLayer,
  push: boolean | undefined
): void {
  ctx.viewStack = (
    push ? pushLayer(ctx.viewStack, layer) : replaceLayer(ctx.viewStack, layer)
  ) as PluginViewBackLayer[]
  applyTopLayer(ctx)
}

export function setDeclaredList(
  senderId: number,
  items: unknown,
  capsule: BrowserWindow | null,
  opts?: { push?: boolean; id?: string }
): { ok: boolean; error?: string } {
  const ctx = viewsByWebContents.get(senderId)
  if (!ctx) return { ok: false, error: 'no plugin context' }
  if (ctx.detached) return { ok: false, error: 'declarative list unavailable in detached mode' }
  if (!Array.isArray(items)) return { ok: false, error: 'items must be an array' }
  const list: PluginListItem[] = []
  for (const raw of items.slice(0, PLUGIN_MAX_VIEW_ITEMS)) {
    if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'bad item' }
    const item = raw as Record<string, unknown>
    if (typeof item.title !== 'string' || !Array.isArray(item.actions)) {
      return { ok: false, error: 'item needs title and actions' }
    }
    list.push({
      title: String(item.title).slice(0, 200),
      subtitle: typeof item.subtitle === 'string' ? item.subtitle.slice(0, 300) : undefined,
      icon: typeof item.icon === 'string' ? item.icon : undefined,
      accessories: Array.isArray(item.accessories)
        ? item.accessories.map(String).slice(0, 3)
        : undefined,
      detail: typeof item.detail === 'string' ? item.detail.slice(0, 5000) : undefined,
      // detailFormat 白名单放行：仅接受 'text' / 'markdown'，其余按缺省 'text' 处理
      detailFormat:
        item.detailFormat === 'markdown' || item.detailFormat === 'text'
          ? item.detailFormat
          : undefined,
      actions: item.actions.slice(0, 10).map((a) => {
        const action = (a ?? {}) as Record<string, unknown>
        return {
          label: String(action.label ?? '执行').slice(0, 60),
          type: (['copy', 'open', 'callback'].includes(String(action.type))
            ? String(action.type)
            : 'callback') as 'copy' | 'open' | 'callback',
          payload: typeof action.payload === 'string' ? action.payload.slice(0, 2000) : undefined,
          // #11 React 视图协议：SDK 生成的回调 id，宿主交互时经 Callback 钩子原样回传
          // #11 回调 id 仅 react 模式透传（审查 M7：数据模式插件不得走 Callback 分支）
          callbackId:
            ctx.plugin.api === 'react' &&
            typeof action.callbackId === 'string' &&
            action.callbackId.trim() !== ''
              ? action.callbackId.slice(0, 64)
              : undefined
        }
      })
    })
  }
  commitLayer(
    ctx,
    {
      kind: 'list',
      id: opts?.id ?? topLayer(ctx.viewStack)?.id ?? 'root',
      list,
      form: null, // 表单视图被列表/详情替换（互斥）
      loading: ctx.declaredLoading,
      emptyMessage: ctx.declaredEmptyMessage
    },
    opts?.push
  )
  // Action 命令提交视图即视为「要界面」，升级为可见
  promoteToVisible(ctx, capsule)
  // 声明式模式下隐藏插件视图（纯数据源），窗口回到默认尺寸由原生列表填充
  if (!ctx.detached && capsule && !capsule.isDestroyed() && active === ctx) {
    applyViewBounds(ctx, capsule)
    applyWindowSize(ctx, capsule)
  }
  // 视图随 notifyRenderer 的单一快照下发（曾经这里另发一份 launcher:plugin-list，
  // 同一次更新同一列表跨通道重复过 IPC 一遍，胶囊也被赋两遍）
  notifyRenderer(capsule)
  return { ok: true }
}

export function clearDeclaredList(
  senderId: number,
  capsule: BrowserWindow | null
): { ok: boolean } {
  const ctx = viewsByWebContents.get(senderId)
  if (!ctx) return { ok: false }
  ctx.viewStack = []
  ctx.declaredList = null
  // 回退传统 UI 模式：恢复插件视图与窗口尺寸（否则视图停留在 0 高不可见）
  if (!ctx.detached && capsule && !capsule.isDestroyed() && active === ctx) {
    applyViewBounds(ctx, capsule)
    applyWindowSize(ctx, capsule)
  }
  notifyRenderer(capsule)
  return { ok: true }
}

/** M3.1：胶囊执行条目的 callback 动作（copy/open 由胶囊本地执行，不经主进程） */
/**
 * React 视图协议（#11）：插件提交 JSON 视图树 → parsePluginView 归一为
 * PluginListItem[]（动作携带 callbackId）→ 复用既有 setDeclaredList 渲染管线。
 * 胶囊 / PluginListPage 零改动。
 */
export function setDeclaredView(
  senderId: number,
  raw: unknown,
  capsule: BrowserWindow | null
): { ok: boolean; count?: number; error?: string } {
  const ctx = viewsByWebContents.get(senderId)
  if (!ctx) return { ok: false, error: 'no plugin context' }
  if (ctx.plugin.api !== 'react') return { ok: false, error: "manifest api must be 'react'" }
  // 形状校验先行：合法节点允许空条目（插件可表达「无结果」空态，审查 I3）
  const node = raw as Record<string, unknown> | null
  const kind = typeof node === 'object' && node !== null ? node.$t : null
  if (typeof kind !== 'string' || !['list', 'detail', 'form'].includes(kind)) {
    return { ok: false, error: 'invalid view node' }
  }
  if (kind === 'form') {
    // 表单视图：存 declaredForm（与 declaredList 互斥），胶囊切 FormPage 渲染
    const form = parsePluginForm(raw)
    if (!form) return { ok: false, error: 'empty or invalid form' }
    commitLayer(
      ctx,
      {
        kind: 'form',
        id: `form:${form.fields.map((f) => f.key).join(',')}`.slice(0, 64),
        list: null,
        form,
        loading: false,
        emptyMessage: null
      },
      // 换一张表就是进一层（填完表回得去列表），同一张表重画则是替换
      ctx.declaredForm === null || ctx.declaredForm.submitId !== form.submitId
    )
    promoteToVisible(ctx, capsule)
    if (!ctx.detached && capsule && !capsule.isDestroyed() && active === ctx) {
      applyViewBounds(ctx, capsule)
      applyWindowSize(ctx, capsule)
    }
    // 表单同样走单一快照：另发 launcher:plugin-form 会与 plugin-changed 各推一遍，
    // 且 plugin-changed 早先不带 declaredForm，后到的列表/placeholder 会把表单清掉
    notifyRenderer(capsule)
    return { ok: true, count: form.fields.length }
  }
  const items = parsePluginView(raw)
  // 伴生状态要在 setDeclaredList 推快照之前落好，否则本次更新渲染端看不到
  const meta = parsePluginListMeta(raw)
  ctx.declaredLoading = meta.loading
  ctx.declaredEmptyMessage = meta.emptyMessage
  const result = setDeclaredList(senderId, items, capsule)
  return result.ok ? { ok: true, count: items.length } : result
}

/** 胶囊表单提交（#11 M2）：值经 Callback 钩子回传插件 onSubmit */
export function submitPluginFormValues(values: Record<string, string | boolean>): {
  ok: boolean
  error?: string
} {
  const ctx = active
  if (!ctx || !ctx.declaredForm) return { ok: false, error: 'no active plugin form' }
  sendHook(ctx, 'Callback', { id: ctx.declaredForm.submitId, payload: values })
  return { ok: true }
}

export function runPluginCallback(
  pluginId: string,
  itemIndex: number,
  actionIndex: number
): { ok: boolean; error?: string } {
  const ctx = active
  if (!ctx || ctx.plugin.id !== pluginId || !ctx.declaredList) {
    return { ok: false, error: 'plugin not active' }
  }
  const item = ctx.declaredList[itemIndex]
  const action = item?.actions[actionIndex]
  if (!action) return { ok: false, error: 'no such action' }
  if (action.type !== 'callback') return { ok: false, error: 'not a callback action' }
  if (typeof action.callbackId === 'string' && action.callbackId !== '') {
    // #11 React 视图协议：按回调 id 回传（SDK 端注册表分发）
    sendHook(ctx, 'Callback', { id: action.callbackId, payload: action.payload, item })
    return { ok: true }
  }
  sendHook(ctx, 'Action', { item, action, itemIndex, actionIndex })
  return { ok: true }
}

// ─── M3.2 插件偏好（值存 launcher_docs，命名空间 prefs.<pluginId>）───

/**
 * 读取偏好（声明默认值兜底）。**只认清单里声明过的键**——与 `setPluginPreference` 同一道闸：
 * 少这一句，插件就能读到自己没声明过的存量值（改名之前的旧键、或上一个版本留下的），
 * 声明清单本来是用来界定"这个插件能碰哪些数据"的，读侧不查就等于只约束了写。
 */
export function getPluginPreference(
  pluginId: string,
  name: string
): { ok: boolean; value?: unknown; error?: string } {
  const plugin = getPlugin(pluginId)
  if (!plugin) return { ok: false, error: 'no such plugin' }
  const declared = plugin.preferences?.find((p) => p.name === name)
  if (!declared) return { ok: false, error: `preference not declared: ${name}` }
  const doc = getLauncherDocStore().get(`prefs.${pluginId}`, name)
  if (doc) return { ok: true, value: doc.data }
  return { ok: true, value: declared.default ?? null }
}

/** 保存偏好（仅允许清单里声明的键） */
export function setPluginPreference(
  pluginId: string,
  name: string,
  value: unknown
): { ok: boolean; error?: string } {
  const plugin = getPlugin(pluginId)
  if (!plugin) return { ok: false, error: 'no such plugin' }
  if (!plugin.preferences?.some((p) => p.name === name)) {
    return { ok: false, error: `preference not declared: ${name}` }
  }
  getLauncherDocStore().put(`prefs.${pluginId}`, name, value)
  return { ok: true }
}

/**
 * 一次取回全部声明偏好的生效值（P-2.5 · Raycast `getPreferenceValues` 的形状）。
 * 只回**清单里声明过的键**：值没设过就落默认值，未声明的键不存在——
 * 插件不能拿它探宿主里别人存了什么。
 */
/**
 * 一次取回全部声明偏好的生效值（P-2.5 · Raycast `getPreferenceValues` 的形状）。
 * 只回**清单里声明过的键**：值没设过就落默认值，未声明的键不存在——
 * 插件不能拿它探宿主里别人存了什么。
 */
export function listPluginPreferences(pluginId: string): {
  ok: boolean
  values?: Record<string, unknown>
  error?: string
} {
  const plugin = getPlugin(pluginId)
  if (!plugin) return { ok: false, error: 'no such plugin' }
  const store = getLauncherDocStore()
  const values: Record<string, unknown> = {}
  for (const pref of plugin.preferences ?? []) {
    const doc = store.get(`prefs.${pluginId}`, pref.name)
    values[pref.name] = doc ? doc.data : (pref.default ?? null)
  }
  return { ok: true, values }
}

// ─── M3.3 网络 API（主进程代理：绕 CORS，响应上限保护）───

const FETCH_MAX_BYTES = 2 * 1024 * 1024

const dnsPromise = import('node:dns') as Promise<typeof import('node:dns')>

/**
 * 禁止插件代理访问本地/内网/链路本地地址（防借主进程探测内网服务）。
 * 除字面量外还对主机名做 DNS 解析：解析结果中任一地址落在内网即拒绝
 * （防 DNS rebinding）；解析失败按拒绝处理（fail closed）。
 */
export async function isLocalTarget(url: URL): Promise<boolean> {
  const host = url.hostname.toLowerCase()
  if (isLocalAddressLiteral(host)) return true
  try {
    const dns = await dnsPromise
    const addrs = await dns.promises.lookup(host.replace(/^\[|\]$/g, ''), {
      all: true,
      verbatim: true
    })
    return addrs.some((a) => isLocalAddressLiteral(a.address))
  } catch {
    return true
  }
}

export async function proxyPluginFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<{ ok: boolean; status?: number; body?: string; contentType?: string; error?: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: 'invalid url' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'only http(s) supported' }
  }
  if (await isLocalTarget(parsed)) return { ok: false, error: 'local addresses are not allowed' }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: init?.headers,
      body: init?.body,
      // 不自动跟随重定向：外网 302 → http://127.0.0.1 会绕过上面的内网校验
      redirect: 'error',
      signal: controller.signal,
      // DNS 钉住（审查 I3）：连接层 lookup 逐地址复判内网，重绑定第二次解析被拦
      agent: pinningAgentSelector()
    } as Parameters<typeof fetch>[1])
    const contentType = response.headers.get('content-type') ?? ''
    // 响应体流式读取，按字节超限立即中止：先全量 text() 再 slice 的话，
    // 超大响应在截断发生前就已把整份内容读进主进程内存
    let received = 0
    let body = ''
    const decoder = new TextDecoder()
    try {
      if (response.body) {
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
          received += chunk.byteLength
          if (received > FETCH_MAX_BYTES) {
            controller.abort()
            return { ok: false, error: 'response too large' }
          }
          body += decoder.decode(chunk, { stream: true })
        }
        body += decoder.decode()
      } else {
        body = await response.text()
      }
    } finally {
      clearTimeout(timer)
    }
    return {
      ok: response.ok,
      status: response.status,
      contentType,
      body
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

function sendHook(ctx: PluginViewContext, type: string, data?: unknown): void {
  const view = ctx.view
  if (view.webContents.isDestroyed()) return
  // leafPluginHooks 由插件 preload 经 contextBridge 暴露（主世界可调用）
  const evalJs = `(function(){
    if (window.leafPluginHooks && typeof window.leafPluginHooks.emit === 'function') {
      try { window.leafPluginHooks.emit(${JSON.stringify(type)}, ${data ? JSON.stringify(data) : 'null'}); return 'ok' }
      catch (e) { return 'err: ' + e.message }
    }
    return 'no-hooks'
  })()`
  void view.webContents
    .executeJavaScript(evalJs)
    .then((r) => {
      if (r !== 'ok') console.warn('[Launcher] hook', type, '未送达:', r)
    })
    .catch(() => {})
}

function applyViewBounds(ctx: PluginViewContext, win: BrowserWindow): void {
  if (ctx.detached) return
  const [width] = win.getContentSize()
  // 声明式模式：胶囊原生渲染列表，插件视图缩为 0 高（纯数据源）
  if (ctx.declaredList) {
    ctx.view.setBounds({ x: 0, y: SEARCH_ROW_HEIGHT, width, height: 0 })
    return
  }
  const height = Math.max(
    MIN_PLUGIN_HEIGHT,
    Math.min(ctx.expandHeight, MAX_WINDOW_HEIGHT - SEARCH_ROW_HEIGHT)
  )
  ctx.view.setBounds({ x: 0, y: SEARCH_ROW_HEIGHT, width, height })
}

function applyWindowSize(ctx: PluginViewContext, win: BrowserWindow): void {
  if (ctx.detached) return
  // 声明式模式：窗口回到默认尺寸，由胶囊原生列表填充
  if (ctx.declaredList) {
    win.setContentSize(WINDOW_WIDTH, 480)
    return
  }
  const height = Math.max(
    SEARCH_ROW_HEIGHT + MIN_PLUGIN_HEIGHT,
    Math.min(SEARCH_ROW_HEIGHT + ctx.expandHeight, MAX_WINDOW_HEIGHT)
  )
  win.setContentSize(WINDOW_WIDTH, height)
}

/**
 * Action 命令的插件真的做出 UI（声明视图 / 副输入框 / 改高度）时升级为可见。
 * 规则是「无界面是缺省，出 UI 就给你」，而不是「声明了 action 就永远不许有界面」——
 * 后者会让插件作者对着一个永不显示的视图调试；且 Enter 之后插件自己想展示结果时也走得通。
 */
function promoteToVisible(ctx: PluginViewContext, win: BrowserWindow | null): void {
  if (!ctx.headless || ctx.attached) return
  if (ctx.headlessTimer) {
    clearTimeout(ctx.headlessTimer)
    ctx.headlessTimer = null
  }
  ctx.attached = true
  if (!win || win.isDestroyed()) return
  win.addBrowserView(ctx.view)
  applyViewBounds(ctx, win)
  applyWindowSize(ctx, win)
}

/** 给胶囊窗渲染端推送插件状态快照（副输入 placeholder + 声明式视图）。
 * 这是插件视图的唯一推送通道：列表/表单互斥，整份下发才不会互相覆盖 */
function notifyRenderer(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return
  const state = {
    open: !!active,
    pluginId: active?.plugin.id ?? null,
    pluginName: active?.plugin.name ?? null,
    subInputPlaceholder: active?.subInputPlaceholder ?? null,
    // 声明式列表（M3.1）：胶囊据此切换原生渲染
    declaredList: active?.declaredList ?? null,
    // React 表单视图（#11 M2）：与 declaredList 互斥
    declaredForm: active?.declaredForm ?? null,
    // P-2.6：列表加载态 / 空态文案（Raycast isLoading / emptyView 语义）
    declaredLoading: active?.declaredLoading ?? false,
    declaredEmptyMessage: active?.declaredEmptyMessage ?? null,
    // 插件视图栈（P-2④）：渲染端要靠这两个值决定面包屑的返回键与 ESC 的走向
    viewDepth: active?.viewStack.length ?? 0,
    canGoBack: active ? pluginCanGoBack(active.viewStack) : false,
    // P-2.2 的两把尺子也随快照下发：渲染端要靠它们判断「插件到底接管了搜索框没有」
    // （Action 命令打开又自关，一路 open=true→false，但从未挂过视图，搜索框不该被它清掉）
    headless: active?.headless ?? false,
    attached: active?.attached ?? false
  }
  win.webContents.send('launcher:plugin-changed', state)
}

/** 插件视图导航锁定：仅允许插件自身源与 devServer，禁止 window.open */
function attachNavigationGuards(view: BrowserView, plugin: InstalledPlugin): void {
  const wc = view.webContents
  const allowedPrefixes = [`plugin://${plugin.id.toLowerCase()}/`]
  if (plugin.devServer) allowedPrefixes.push(`${plugin.devServer}/`)

  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  wc.on('will-navigate', (e, url) => {
    const allowed = allowedPrefixes.some(
      (prefix) => url.startsWith(prefix) || url.replace(/\/+$/, '') === prefix.replace(/\/+$/, '')
    )
    if (!allowed) {
      console.warn('[Launcher] 已拦截插件导航:', plugin.id, '→', url)
      e.preventDefault()
    }
  })
}

/** 打开插件（胶囊窗）。已打开其他插件则先关闭。args = 命令参数值（多参数命令）。 */
export function openPlugin(
  win: BrowserWindow,
  pluginId: string,
  cmd: string | null = null,
  args?: Record<string, string>
): void {
  const plugin = getPlugin(pluginId)
  if (!plugin) {
    new Notification({ title: '启动器', body: `插件未安装：${pluginId}` }).show()
    return
  }
  if (!plugin.enabled) {
    // 停用的插件不得被打开（搜索层已过滤，这里兜住直接 IPC 调用的路径）
    new Notification({ title: '启动器', body: `插件已停用：${plugin.name}` }).show()
    return
  }

  closeActivePlugin(win)

  // P-2.1/2.2：Action 命令（manifest commands[].mode === 'action'）不挂视图，只跑逻辑
  const headless = isActionCommand(plugin.commands, cmd)

  // 安全：沙箱开启（preload 仅用 contextBridge/ipcRenderer，沙箱模式可用）；
  // 插件页面不允许导航出插件源/devServer，不允许 window.open——
  // 否则插件把页面导去远程后，preload 对新页面继续生效，受控 API 即告移交
  const view = new BrowserView({
    webPreferences: {
      preload: join(__dirname, '../preload/plugin.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // 插件页隐藏为纯逻辑宿主（声明模式/React 模式）：后台节流会冻结
      // setTimeout/rAF，导致 Callback 分发与视图提交无限延迟（#11 审查实证）
      backgroundThrottling: false
    }
  })
  attachNavigationGuards(view, plugin)

  const ctx: PluginViewContext = {
    plugin,
    view,
    cmd,
    args: args ?? null,
    detached: false,
    subInputPlaceholder: null,
    expandHeight: 360,
    declaredList: null,
    declaredForm: null,
    headless,
    attached: !headless,
    headlessTimer: null,
    declaredLoading: false,
    declaredEmptyMessage: null,
    viewStack: []
  }
  active = ctx
  viewsByWebContents.set(view.webContents.id, ctx)
  // Action 命令：视图创建但不挂窗——插件只跑逻辑，胶囊仍显示原来的列表
  if (!headless) win.addBrowserView(view)
  // 窗口标题反映插件状态（也便于自动化验收读取）
  win.setTitle(`Leaf Launcher · ${plugin.name}`)

  void view.webContents.loadURL(pluginEntryUrl(plugin))

  view.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (code === -3) return // Aborted：页面被替换/取消属正常
    console.error('[Launcher] 插件页面加载失败:', plugin.id, code, desc, url)
  })

  view.webContents.once('dom-ready', () => {
    // 加载完成前被 detach 的话，detach 路径已发过 Enter，这里不再重复
    if (ctx.detached) return
    if (ctx.headless && !ctx.attached) {
      // Action 命令：Enter/Ready 照发（插件靠它开工），但不占胶囊界面；
      // 到点既没出 UI 也没自己 close 就回收——第三方代码不能无限占着一个视图
      sendHook(ctx, 'Enter', { cmd, args: ctx.args })
      sendHook(ctx, 'Ready', null)
      ctx.headlessTimer = setTimeout(() => {
        if (active === ctx && !ctx.attached) closeActivePlugin(win)
      }, ACTION_COMMAND_TIMEOUT_MS)
      return
    }
    applyWindowSize(ctx, win)
    applyViewBounds(ctx, win)
    sendHook(ctx, 'Enter', { cmd, args: ctx.args })
    sendHook(ctx, 'Ready', null)
    notifyRenderer(win)
  })

  view.webContents.on('render-process-gone', () => {
    console.error('[Launcher] 插件渲染进程崩溃:', plugin.id)
    if (ctx.detached) {
      // detached 崩溃：关承载窗，走 closed 回调完成 Map 清理
      if (detachWin && !detachWin.isDestroyed()) detachWin.close()
    } else {
      closeActivePlugin(win)
    }
  })
}

/**
 * 开发热重载（devPlugins）/ 市场更新后的就地重载：
 * - 该插件有存活视图（活动或 detached）→ 刷新缓存 manifest、重置声明列表握手
 *   （declaredList 清空、视图/窗口尺寸恢复传统模式）、重新 loadURL(pluginEntryUrl)，
 *   dom-ready 后补发 Enter/Ready 钩子（等效重新打开，但保留窗口挂载状态）
 * - 无存活视图 → 只确认插件已安装。主进程不额外缓存清单（getPlugin 每次读 installed.json），
 *   下次 openPlugin 自然拿到新 manifest，无需处理
 */
export function reloadPluginView(
  pluginId: string,
  capsule: BrowserWindow | null = null
): { ok: boolean; reloaded: boolean; error?: string } {
  const plugin = getPlugin(pluginId)
  if (!plugin) return { ok: false, reloaded: false, error: 'plugin not installed' }
  let ctx: PluginViewContext | null = null
  for (const c of viewsByWebContents.values()) {
    if (c.plugin.id === pluginId) {
      ctx = c
      break
    }
  }
  if (!ctx) return { ok: true, reloaded: false }
  const target: PluginViewContext = ctx

  target.plugin = plugin
  target.declaredList = null
  target.subInputPlaceholder = null
  // devServer 可能已在 manifest 中更换：重建导航白名单
  // （will-navigate 监听会叠加，必须先移除旧白名单再重挂）
  target.view.webContents.removeAllListeners('will-navigate')
  attachNavigationGuards(target.view, plugin)

  const view = target.view
  void view.webContents.loadURL(pluginEntryUrl(plugin))
  view.webContents.once('dom-ready', () => {
    if (view.webContents.isDestroyed()) return
    sendHook(target, 'Enter', { cmd: target.cmd, args: target.args, detached: target.detached })
    sendHook(target, 'Ready', null)
    notifyRenderer(target.detached ? null : capsule)
  })
  // 声明式列表已清空：若挂在胶囊窗上，恢复传统模式的视图与窗口尺寸
  if (!target.detached && capsule && !capsule.isDestroyed() && active === target) {
    applyWindowSize(target, capsule)
    applyViewBounds(target, capsule)
  }
  return { ok: true, reloaded: true }
}

/** 关闭胶囊窗上挂载的插件视图 */
/** 打开指定插件视图的 DevTools（独立窗分离调试，ROADMAP：插件调试方式缺失是第三方开发最大障碍）。
 *  找不到该插件的存活视图返回 false（未打开 / 已关闭）。 */
export function openPluginDevtools(pluginId: string): boolean {
  for (const ctx of viewsByWebContents.values()) {
    if (ctx.plugin.id !== pluginId) continue
    if (ctx.view.webContents.isDestroyed()) continue
    ctx.view.webContents.openDevTools({ mode: 'detach' })
    return true
  }
  return false
}

/**
 * 无人值守跑一条插件命令（Automations 的 `'plugin'` 动作用，P-2③）。
 *
 * 三条设计上的实话：
 * - **只跑 action 模式**（`headlessRunBlocker` 判）：视图命令会在没人看着时弹界面；
 * - **不弹窗**：宿主用 `ensureLauncherWindow()`，创建时 show:false，这里也不 show；
 * - **成败只代表「投递到了插件」**：插件里的逻辑跑成什么样宿主看不到（Action 命令没有
 *   回调通道）。所以设置页那句提示写的是「已交给插件」而不是「执行成功」，不假装看得见。
 */
export function runPluginCommandDetached(
  pluginId: string,
  cmd: string,
  args?: Record<string, string>
): { ok: boolean; error?: string } {
  const blocker = headlessRunBlocker(getPlugin(pluginId), cmd, active !== null)
  if (blocker) return { ok: false, error: blocker }
  const win = ensureLauncherWindow()
  if (!win) return { ok: false, error: '建不出承载插件的窗口' }
  try {
    openPlugin(win, pluginId, cmd, args)
  } catch (error) {
    return { ok: false, error: `起不动：${(error as Error).message}` }
  }
  return { ok: true }
}

/**
 * 插件退一层（P-2④ 第二半）。已在第一层时返回 error 而不是关插件 ——
 * 「退回上一层」与「关掉插件」是两个动作，胶囊的 ESC 三段式分开处理，
 * 混在一起的结果是插件里的返回键把整个插件弹掉。
 */
/** 胶囊侧退当前插件的一层：活跃视图就是它自己，不需要按 sender 查 —— 查了反而拿不到 */
export function popActiveViewFromHost(): { ok: boolean; depth: number; error?: string } {
  if (!active) return { ok: false, depth: 0, error: 'no active plugin' }
  const popped = popLayer(active.viewStack) as PluginViewBackLayer[] | null
  if (!popped) return { ok: false, depth: active.viewStack.length, error: '已在插件的第一层' }
  active.viewStack = popped
  applyTopLayer(active)
  notifyRenderer(getLauncherWindow())
  return { ok: true, depth: popped.length }
}

export function popActiveView(senderId: number): { ok: boolean; depth: number; error?: string } {
  const ctx = viewsByWebContents.get(senderId)
  if (!ctx) return { ok: false, depth: 0, error: 'no plugin context' }
  const popped = popLayer(ctx.viewStack) as PluginViewBackLayer[] | null
  if (!popped) return { ok: false, depth: ctx.viewStack.length, error: '已在插件的第一层' }
  ctx.viewStack = popped
  applyTopLayer(ctx)
  notifyRenderer(getLauncherWindow())
  return { ok: true, depth: popped.length }
}

export function closeActivePlugin(win: BrowserWindow): void {
  if (!active) return
  const ctx = active
  sendHook(ctx, 'Leave', null)
  if (ctx.headlessTimer) {
    clearTimeout(ctx.headlessTimer)
    ctx.headlessTimer = null
  }
  // Action 命令的视图从未挂载，removeBrowserView 只对挂过的做
  if (ctx.attached) win.removeBrowserView(ctx.view)
  win.setContentSize(WINDOW_WIDTH, SEARCH_ROW_HEIGHT + 420)
  const wcId = ctx.view.webContents.id
  if (!ctx.view.webContents.isDestroyed()) {
    ;(ctx.view.webContents as unknown as { destroy: () => void }).destroy()
  }
  viewsByWebContents.delete(wcId)
  active = null
  win.setTitle('Leaf Launcher')
  notifyRenderer(win)
}

/** 插件 API：调整插件区高度 */
export function setExpandHeight(ctx: PluginViewContext, win: BrowserWindow, height: number): void {
  // 操作发送者自己的 ctx（此前操作全局 active：单 attached 视图下恰好一致，
  // 多视图时会跨插件写状态）
  // 与 preload 注释声明的范围一致；主进程是真正夹取点
  ctx.expandHeight = Math.max(120, Math.min(Math.round(height), 580))
  promoteToVisible(ctx, win)
  applyWindowSize(ctx, win)
  applyViewBounds(ctx, win)
}

/** 插件 API：设置副输入框 placeholder（由胶囊窗搜索框代为展示） */
export function setSubInput(ctx: PluginViewContext, win: BrowserWindow, placeholder: string): void {
  ctx.subInputPlaceholder = placeholder
  promoteToVisible(ctx, win)
  notifyRenderer(win)
}

/** 胶囊窗搜索框输入 → 插件 SubInputChange 钩子 */
export function relaySearchInput(value: string): void {
  if (!active) return
  sendHook(active, 'SubInputChange', { text: value })
}

/** 胶囊窗显隐通知插件 */
export function notifyWindowVisibility(visible: boolean): void {
  if (!active) return
  sendHook(active, visible ? 'Show' : 'Hide', null)
}

/** 分离：把插件 view 从胶囊窗迁移到独立窗口，返回是否成功 */
export function detachActivePlugin(capsuleWin: BrowserWindow): boolean {
  if (!active) return false
  // 单一分离窗：已有分离窗口时拒绝，避免静默销毁上一个插件的窗口
  if (detachWin && !detachWin.isDestroyed()) {
    new Notification({
      title: '启动器',
      body: '已有一个分离的插件窗口，请先关闭后再分离其他插件'
    }).show()
    return false
  }
  const ctx = active
  sendHook(ctx, 'Leave', null)
  capsuleWin.removeBrowserView(ctx.view)
  capsuleWin.setContentSize(WINDOW_WIDTH, SEARCH_ROW_HEIGHT + 420)

  const bounds = capsuleWin.getBounds()
  createDetachWindow(ctx, { x: bounds.x + 60, y: bounds.y + 60, width: WINDOW_WIDTH, height: 420 })

  active = null
  capsuleWin.setTitle('Leaf Launcher')
  notifyRenderer(capsuleWin)
  return true
}

// ─────────── detach 独立窗口 ───────────

let detachWin: BrowserWindow | null = null

function createDetachWindow(
  ctx: PluginViewContext,
  bounds: { x: number; y: number; width: number; height: number }
): void {
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 240,
    show: false,
    title: `${ctx.plugin.name} · Leaf 启动器`,
    backgroundColor: '#1e1e22',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })
  detachWin = win
  ctx.detached = true
  ctx.view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
  ctx.view.setAutoResize({ width: true, height: true })

  win.on('closed', () => {
    sendHook(ctx, 'Leave', null)
    if (!ctx.view.webContents.isDestroyed()) {
      const wcId = ctx.view.webContents.id
      viewsByWebContents.delete(wcId)
      ;(ctx.view.webContents as unknown as { destroy: () => void }).destroy()
    }
    // 仅当仍指向本窗口时置空，避免连续 detach 的 closed 异步交错误清新引用
    if (detachWin === win) detachWin = null
  })

  // 空白承载页：插件 view 全覆盖，不加载搜索 UI
  void win.loadURL('about:blank')

  win.once('ready-to-show', () => {
    win.addBrowserView(ctx.view)
    win.show()
    sendHook(ctx, 'Enter', { cmd: ctx.cmd, args: ctx.args, detached: true })
  })
}
