/**
 * Frond · 启动器插件专用 preload
 *
 * 通过 contextBridge 向插件页面暴露受控 API（window.launcherApi）。
 * 安全模型：contextIsolation 开启、nodeIntegration 关闭——插件拿不到
 * Electron/Node 原生能力，只能走这里的白名单通道（plugapi:*）。
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcKey, IpcRequest, IpcResponse } from '@shared/ipc-contract'

/**
 * 与 src/preload/typedIpc.ts 同实现，但这里必须本地留一份：sandbox 化的 preload
 * 只能 require 内置模块，两个入口共用一个模块时 rollup 会抽成 ./chunks/*.js，
 * Electron 直接报「Unable to load preload script: module not found」。
 */
function typedInvoke<K extends IpcKey>(
  channel: K,
  ...req: [IpcRequest<K>] extends [void] ? [] : [IpcRequest<K>]
): Promise<IpcResponse<K>> {
  return ipcRenderer.invoke(channel, req[0]) as Promise<IpcResponse<K>>
}

type HookType =
  | 'Enter'
  | 'Ready'
  | 'Leave'
  | 'Show'
  | 'Hide'
  | 'SubInputChange'
  | 'Action'
  | 'Callback'
type HookCallback = (data: unknown) => void

const hooks = new Map<HookType, Set<HookCallback>>()

function dispatch(type: HookType, data: unknown): void {
  const set = hooks.get(type)
  if (!set) return
  for (const cb of set) {
    try {
      cb(data)
    } catch (err) {
      console.error('[launcherApi] hook error:', err)
    }
  }
}

function on(type: HookType, cb: HookCallback): () => void {
  let set = hooks.get(type)
  if (!set) {
    set = new Set()
    hooks.set(type, set)
  }
  set.add(cb)
  return () => set?.delete(cb)
}

const launcherApi = {
  /** 插件上下文（id/名称/触发命令/命令参数值，args 由胶囊参数表单收集） */
  getContext: () => typedInvoke('plugapi:getContext'),

  /** 提交 React 视图树（#11；需 manifest api: 'react'，主进程归一为声明式列表渲染） */
  renderView: (view: unknown) => typedInvoke('plugapi:renderView', { view }),

  /** 提交可搜索条目集（#5 双通道；需 manifest searchable: true，覆盖式持久化到主进程，关闭插件后仍进根搜索） */
  submitSearchItems: (items: unknown[]) => typedInvoke('plugapi:submitSearchItems', { items }),

  /** 调整插件区高度（胶囊窗模式；范围 120-580） */
  setExpandHeight: (height: number) => typedInvoke('plugapi:setExpandHeight', { height }),

  /** 把胶囊窗搜索框设为插件的副输入框（输入变化走 onSubInputChange） */
  setSubInput: (placeholder: string) => typedInvoke('plugapi:setSubInput', { placeholder }),

  /** 系统通知（标题为插件名） */
  notify: (body: string) => typedInvoke('plugapi:notify', { body }),

  copyText: (text: string) => typedInvoke('plugapi:copyText', { text }),
  readText: () => typedInvoke('plugapi:readText'),

  openPath: (path: string) => typedInvoke('plugapi:openPath', { path }),

  /**
   * open(url)（P-2.5）：把链接交给系统浏览器。需 manifest permissions 声明 'net'，
   * 协议只收 http/https/mailto（file: 与自定义 scheme 能把参数塞进别的应用）。
   */
  openUrl: (url: string) => typedInvoke('plugapi:openUrl', { url }),

  /**
   * Alert（P-2.5）：宿主原生模态框。回被按下的动作 id；只弹「好」的确认框回 null。
   * actions 由调用方（插件代码）给，主进程截断并封顶到 4 个。
   */
  alert: (input: { title?: string; message: string; actions?: unknown[] }) =>
    typedInvoke('plugapi:alert', {
      title: String(input?.title ?? ''),
      message: String(input?.message ?? ''),
      actions: Array.isArray(input?.actions) ? input.actions : []
    }),

  /** 分离为独立窗口（胶囊窗模式） */
  detach: () => typedInvoke('plugapi:detach'),

  /** 关闭插件（回到搜索列表） */
  close: () => typedInvoke('plugapi:close'),

  /** 生命周期钩子：onEnter / onReady / onLeave / onShow / onHide / onSubInputChange / onAction */
  onEnter: (cb: HookCallback) => on('Enter', cb),
  onReady: (cb: HookCallback) => on('Ready', cb),
  onLeave: (cb: HookCallback) => on('Leave', cb),
  onShow: (cb: HookCallback) => on('Show', cb),
  onHide: (cb: HookCallback) => on('Hide', cb),
  onSubInputChange: (cb: HookCallback) => on('SubInputChange', cb),
  /** #11 React 视图协议：宿主交互回调（条目动作携带的回调 id 经此分发） */
  onCallback: (cb: HookCallback) => on('Callback', cb),
  /** 声明式列表的 callback 动作（M3.1）：payload = { item, action, itemIndex, actionIndex } */
  onAction: (cb: HookCallback) => on('Action', cb),

  /** 数据 API：插件命名空间内的 KV 文档（launcher_docs 表） */
  db: {
    put: (id: string, data: unknown) => typedInvoke('plugapi:dbPut', { id, data }),
    get: (id: string) => typedInvoke('plugapi:dbGet', { id }),
    remove: (id: string) => typedInvoke('plugapi:dbRemove', { id }),
    list: () => typedInvoke('plugapi:dbList')
  },

  /** ─── 声明式 List 协议（M3.1）：提交数据由宿主原生渲染，插件无需写 UI ─── */
  /**
   * 声明式列表。`{ push: true }` = 「我进下一层」，宿主把当前层留在栈里；
   * 不带就是**当前层重绘**（搜索型插件每敲一个字都调它，那些不该长出一层返回栈）。
   * `id` 是给渲染端的稳定 key：同一层重绘不换 id，输入焦点与滚动位置才留得住。
   */
  renderList: (items: unknown, opts?: { push?: boolean; id?: string }) =>
    typedInvoke('plugapi:renderList', { items, push: opts?.push === true, id: opts?.id ?? '' }),
  /** 退一层；已在插件第一层时 ok=false（那种情况下该由胶囊的 ESC 关插件） */
  popView: () => typedInvoke('plugapi:popView'),
  clearList: () => typedInvoke('plugapi:clearList'),

  /** ─── M3.2 偏好（值存主进程 kv，仅限清单声明的键）─── */
  preferences: {
    /** 一次取回声明过的全部偏好（P-2.5：getPreferenceValues 的落点） */
    all: () => typedInvoke('plugapi:listPreferences'),
    get: (name: string) => typedInvoke('plugapi:getPreference', { name }),
    set: (name: string, value: unknown) => typedInvoke('plugapi:setPreference', { name, value })
  },

  /**
   * ─── P-2③ 定时任务（插件生命周期外执行）───
   * 需要在 plugin.json 里声明 `schedule` 权限；没声明时 list 返回空表、add/remove 带回原因。
   * 能排的只有**本插件自己的 mode:'action' 命令**（视图命令会在没人看着时弹界面），
   * 每个插件最多 3 条、最快每 15 分钟一次，登记后在「设置 → 定时任务」里看得见也能删。
   */
  schedule: {
    list: () => typedInvoke('plugapi:scheduleList'),
    add: (task: {
      label?: string
      cron: string
      cmd: string
      arguments?: Record<string, string>
    }) => typedInvoke('plugapi:scheduleAdd', task),
    remove: (id: string) => typedInvoke('plugapi:scheduleRemove', { id })
  },

  /** ─── M3.3 网络代理（绕 CORS，15s 超时，2MB 上限）─── */
  fetch: (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) => typedInvoke('plugapi:fetch', { url, init })
}

export type LauncherPluginApi = typeof launcherApi

contextBridge.exposeInMainWorld('launcherApi', launcherApi)

// 主进程 sendHook 通过 executeJavaScript 调用（运行在主世界），
// contextIsolation 下经 contextBridge 暴露桥接入口
contextBridge.exposeInMainWorld('frondPluginHooks', {
  emit: (type: HookType, data: unknown): void => dispatch(type, data)
})
