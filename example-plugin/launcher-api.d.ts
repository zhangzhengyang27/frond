/**
 * Frond · 插件 API 类型声明（给插件作者编辑器补全用）
 *
 * 与 `src/shared/plugin-protocol.ts`（协议）和 `src/preload/plugin.ts`（桥）保持同步；
 * 三处不一致时**以那两个文件为准**，本文件只是抄一份可读的。
 * 用法：插件目录里放一份，或在 tsconfig 里 `"include": ["launcher-api.d.ts"]`。
 */

/** 声明式列表的一条动作。type 白名单外一律按 callback 处理 */
export interface PluginListAction {
  label?: string
  type?: 'copy' | 'open' | 'callback'
  /** copy=要复制的文本；open=URL 或本地路径；callback=回 onAction 的自定义载荷 */
  payload?: string
}

/** 声明式列表的一行（宿主原生渲染，插件不写 UI） */
export interface PluginListItem {
  title: string
  subtitle?: string
  /** remixicon 名，不含 `ri-` 前缀；缺省 plug-2 */
  icon?: string
  keywords?: string[]
  /** 右侧配件文本，最多 3 项 */
  accessories?: string[]
  /** 选中时显示的详情面板，≤5000 字符 */
  detail?: string
  detailFormat?: 'text' | 'markdown'
  actions?: PluginListAction[]
}

export interface PluginContext {
  pluginId: string
  name: string
  /** 触发本次打开的命令 code；直接打开时为 null */
  cmd: string | null
}

export interface PluginFetchResult {
  ok: boolean
  status?: number
  body?: string
  contentType?: string
  error?: string
}

export interface PluginPreferenceResult {
  ok: boolean
  value?: unknown
  error?: string
}

export interface PluginDoc {
  id: string
  data: unknown
  updatedAt: number
}

export interface PluginScheduledTask {
  id: string
  label?: string
  /** 标准 5 字段 cron（本机本地时间），最快每 15 分钟一次 */
  cron: string
  /** 本插件的一条 mode:'action' 命令 code */
  cmd: string
  arguments?: Record<string, string>
}

export interface LauncherPluginApi {
  getContext(): Promise<PluginContext | null>

  /** ─── 声明式列表（M3.1）─── */
  /**
   * 提交整份列表。`{ push: true }` 表示「我进下一层」（宿主压栈）；
   * 不带就是当前层重绘 —— 搜索型插件每次输入都调它，那些不该长出返回栈。
   * `id` 是稳定 key：同层重绘不换 id，输入焦点与滚动位置才留得住。
   */
  renderList(items: PluginListItem[], opts?: { push?: boolean; id?: string }): Promise<boolean>
  popView(): Promise<{ ok: boolean }>
  clearList(): Promise<boolean>
  /** 视图协议（P-2.1）：声明式 View，宿主渲染 */
  renderView(view: unknown): Promise<boolean>
  submitSearchItems(items: unknown[]): Promise<boolean>

  /** ─── 胶囊 UI 控制 ─── */
  setSubInput(placeholder: string): Promise<boolean>
  setExpandHeight(height: number): Promise<boolean>

  /** ─── 受控副作用（需 permissions 声明）─── */
  notify(body: string): Promise<boolean>
  copyText(text: string): Promise<boolean>
  readText(): Promise<string>
  openPath(path: string): Promise<boolean>
  openUrl(url: string): Promise<boolean>
  alert(input: { title?: string; message: string; actions?: string[] }): Promise<string | null>
  detach(): Promise<boolean>
  close(): Promise<boolean>

  /** ─── 本插件文档库（无需权限）─── */
  db: {
    put(id: string, data: unknown): Promise<{ id: string }>
    get(id: string): Promise<PluginDoc | null>
    remove(id: string): Promise<{ ok: boolean }>
    list(): Promise<PluginDoc[]>
  }

  /** ─── 偏好：只能读写 plugin.json 里声明过的键 ─── */
  preferences: {
    all(): Promise<{ ok: boolean; values?: Record<string, unknown>; error?: string }>
    get(name: string): Promise<PluginPreferenceResult>
    set(name: string, value: unknown): Promise<{ ok: boolean; error?: string }>
  }

  /** ─── 定时任务（P-2③，需 schedule 权限；每插件最多 3 条）─── */
  schedule: {
    list(): Promise<{ tasks: PluginScheduledTask[]; error?: string }>
    add(task: {
      label?: string
      cron: string
      cmd: string
      arguments?: Record<string, string>
    }): Promise<{ ok: boolean; task?: PluginScheduledTask; error?: string }>
    remove(id: string): Promise<{ ok: boolean; error?: string }>
  }

  /** ─── 网络代理（M3.3，需 net 权限）：绕 CORS，15s 超时，2MB 上限 ─── */
  fetch(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
  ): Promise<PluginFetchResult>

  /** ─── 生命周期钩子 ─── */
  /** 宿主发的是 `{ cmd, args, detached? }`（runtime.ts:643/704/900）—— 键名是 cmd */
  onEnter(cb: (data: { cmd: string | null; args?: unknown; detached?: boolean }) => void): void
  onReady(cb: (data: null) => void): void
  onLeave(cb: (data: null) => void): void
  onShow(cb: (data: null) => void): void
  onHide(cb: (data: null) => void): void
  onSubInputChange(cb: (data: { text: string }) => void): void
  onCallback(cb: (data: unknown) => void): void
  onAction(
    cb: (data: {
      item: PluginListItem
      action: PluginListAction
      itemIndex: number
      actionIndex: number
    }) => void
  ): void
}

declare global {
  interface Window {
    launcherApi: LauncherPluginApi
  }
}

export {}
