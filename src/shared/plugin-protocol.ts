/**
 * Frond · 插件声明式 List 协议（M3.1）
 *
 * 插件不写 UI：通过 launcherApi.renderList(items) 提交数据，
 * 宿主（胶囊窗）用原生组件渲染列表 / Detail / 动作——第三方插件零 UI 代码
 * 获得 Raycast 质感。声明后插件 BrowserView 隐藏为纯数据源。
 *
 * 数据流：插件 view --plugapi:renderList--> 主进程(ctx.declaredList)
 *        --launcher:plugin-list--> 胶囊渲染端原生渲染
 * 动作流：胶囊回车 --launcher:plugin-run-action--> 主进程
 *        ├─ copy / open：宿主直接执行
 *        └─ callback：sendHook('Action', { item, action }) 回插件
 */

/** 插件列表条目 */
export interface PluginListItem {
  title: string
  subtitle?: string
  /** remixicon 名称（不含 ri- 前缀），缺省 plug-2 */
  icon?: string
  /** 关键词（搜索副输入框过滤由插件自管；这里用于宿主高亮兜底） */
  keywords?: string[]
  /** 右侧配件文本（如大小 / 日期） */
  accessories?: string[]
  /** Detail 面板内容（选中即显示；渲染格式由 detailFormat 决定） */
  detail?: string
  /** Detail 渲染格式：'text' 纯文本（缺省，向后兼容）；'markdown' 走 marked + sanitize 渲染 */
  detailFormat?: 'text' | 'markdown'
  /** 可用动作；首个为回车默认动作 */
  actions: PluginItemAction[]
}

export interface PluginItemAction {
  label: string
  /** copy=复制 payload 到剪贴板；open=系统打开 payload（URL/路径）；callback=回插件处理 */
  type: 'copy' | 'open' | 'callback'
  payload?: string
  /** 快捷键提示（展示用，如 ⌘C） */
  hint?: string
  /** #11 React 视图协议：SDK 生成的回调 id；宿主交互时经 Callback 钩子原样回传 */
  callbackId?: string
}

/** 插件提交的整份列表 */
export type PluginList = PluginListItem[]

// ─── Form 基元（M5.2）：胶囊内字段式表单的字段协议 ───

/** Form 字段控件类型（缺省 'text'；password 为单行掩码输入） */
export type FormFieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'password'

/** Form 基元字段 */
export interface FormField {
  key: string
  label: string
  /** 控件类型；缺省 'text' */
  type?: FormFieldType
  /** select 候选项（仅 type='select' 时生效） */
  options?: string[]
  placeholder?: string
  /** 初始值（checkbox 为 boolean，其余为 string） */
  initial?: string | boolean
}

/** 协议版本（plugin.json 可声明 declarative: true 走此协议） */
export const PLUGIN_LIST_PROTOCOL_VERSION = 1

// ─── 插件命令参数（多参数命令，对标 Raycast argument1-3）───

/** 参数控件类型（对标 Raycast：text / password / dropdown） */
export type PluginArgumentType = 'text' | 'password' | 'dropdown'

/** dropdown 候选项 */
export interface PluginArgumentOption {
  /** 展示文案 */
  title: string
  /** 提交给插件的值 */
  value: string
}

/** 命令参数声明（manifest.commands[].arguments，宿主清洗后使用） */
export interface PluginArgument {
  /** 参数名（启动时作为 args 的 key；重名保留首个） */
  name: string
  /** 控件类型；缺省 'text' */
  type?: PluginArgumentType
  placeholder?: string
  /** required 且提交为空时宿主拒绝执行（留在表单） */
  required?: boolean
  /** type='dropdown' 的候选项（缺失或清洗后为空 → 宿主降级为 text） */
  data?: PluginArgumentOption[]
}

/** 参数数量上限（对标 Raycast 最多 3 个参数） */
export const PLUGIN_MAX_ARGUMENTS = 3

// ─── 命令形态（View 命令 / Action 命令，对标 Raycast commands[].mode）───

/** 'view' = 打开插件界面（缺省）；'action' = 无界面执行，宿主不挂插件视图 */
export type PluginCommandMode = 'view' | 'action'

/**
 * fail-closed：只认字面量 'view' / 'action'，其余（含拼错的 'Acion'）一律 undefined
 * 即按缺省的 view 处理——拼错权限名等于没声明，拼错模式也不能让命令偷偷变成无界面。
 */
export function sanitizePluginCommandMode(raw: unknown): PluginCommandMode | undefined {
  return raw === 'action' || raw === 'view' ? raw : undefined
}

/**
 * 该命令是否无界面 Action 命令。cmd = manifest commands[].code；
 * null / 找不到对应命令 → false（按 view 走，宁多不少挂一次 UI）。
 */
export function isActionCommand(
  commands: Array<{ code: string; mode?: PluginCommandMode }> | undefined,
  cmd: string | null
): boolean {
  if (!commands?.length || typeof cmd !== 'string') return false
  return commands.find((c) => c.code === cmd)?.mode === 'action'
}

/** dropdown 候选项数量上限 */
export const PLUGIN_MAX_ARGUMENT_OPTIONS = 20

const ARGUMENT_TYPES: ReadonlySet<string> = new Set(['text', 'password', 'dropdown'])

function isValidArgOption(o: unknown): o is PluginArgumentOption {
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof (o as PluginArgumentOption).title === 'string' &&
    (o as PluginArgumentOption).title.trim() !== '' &&
    typeof (o as PluginArgumentOption).value === 'string' &&
    (o as PluginArgumentOption).value.trim() !== ''
  )
}

/**
 * 清洗 manifest 里的 arguments 声明（fail-closed）：
 * 非数组 → []；非法项剔除；重名保留首个；非法 type 降级 text；
 * dropdown 缺 data / 清洗后 data 为空 → 降级 text；data 封顶 20 项；数量封顶 3。
 */
export function sanitizePluginArguments(raw: unknown): PluginArgument[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: PluginArgument[] = []
  for (const item of raw) {
    if (out.length >= PLUGIN_MAX_ARGUMENTS) break
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.name !== 'string' || rec.name.trim() === '') continue
    if (seen.has(rec.name)) continue
    seen.add(rec.name)

    const type: PluginArgumentType =
      typeof rec.type === 'string' && ARGUMENT_TYPES.has(rec.type)
        ? (rec.type as PluginArgumentType)
        : 'text'

    const arg: PluginArgument = { name: rec.name, type }
    if (typeof rec.placeholder === 'string') arg.placeholder = rec.placeholder
    if (rec.required === true) arg.required = true

    if (type === 'dropdown') {
      const data = Array.isArray(rec.data)
        ? rec.data.filter(isValidArgOption).slice(0, PLUGIN_MAX_ARGUMENT_OPTIONS)
        : []
      if (data.length === 0) {
        arg.type = 'text' // 无候选的 dropdown 无法渲染，降级为文本输入
      } else {
        arg.data = data
      }
    }
    out.push(arg)
  }
  return out
}

// ─── 插件搜索条目（#5 插件双通道）───

/** 单条目数量上限（防第三方提交超量索引） */
export const PLUGIN_MAX_SEARCH_ITEMS = 300
/** 单条目关键词上限 */
export const PLUGIN_MAX_SEARCH_KEYWORDS = 8

/**
 * 插件向宿主提交的可搜索条目（对标 ueli getSearchResultItems）：
 * 插件打开时经 launcherApi.submitSearchItems 持久化到主进程，
 * 关闭后仍进根搜索。动作复用声明式 List 的 PluginItemAction。
 */
export interface PluginSearchItem {
  title: string
  subtitle?: string
  /** remixicon 名称（不含 ri- 前缀） */
  icon?: string
  /** 搜索命中关键词（根搜索按 title/subtitle/keywords 子串匹配） */
  keywords?: string[]
  badge?: string
  /** copy=复制 payload；open=打开 payload（http(s) 走浏览器，否则当路径）；callback=打开插件继续交互 */
  action: PluginItemAction
}

const SEARCH_ACTION_TYPES: ReadonlySet<string> = new Set(['copy', 'open', 'callback'])

function isValidSearchAction(a: unknown): a is PluginItemAction {
  if (typeof a !== 'object' || a === null) return false
  const rec = a as Record<string, unknown>
  if (typeof rec.type !== 'string' || !SEARCH_ACTION_TYPES.has(rec.type)) return false
  return typeof rec.payload === 'string' && rec.payload.trim() !== ''
}

/**
 * 清洗插件提交的搜索条目（fail-closed）：
 * 非数组 → []；title 必填（trim 后非空，>120 截断）；action 非法 → 整条剔除；
 * keywords trim/去空/去重/封顶 8；subtitle/icon/badge 非字符串剔除；数量封顶 300。
 */
export function sanitizePluginSearchItems(raw: unknown): PluginSearchItem[] {
  if (!Array.isArray(raw)) return []
  const out: PluginSearchItem[] = []
  for (const item of raw) {
    if (out.length >= PLUGIN_MAX_SEARCH_ITEMS) break
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.title !== 'string') continue
    const title = rec.title.trim().slice(0, 120)
    if (!title) continue
    if (!isValidSearchAction(rec.action)) continue
    const entry: PluginSearchItem = {
      title,
      action: rec.action as PluginItemAction
    }
    if (typeof rec.subtitle === 'string') entry.subtitle = rec.subtitle.trim().slice(0, 200)
    if (typeof rec.icon === 'string') entry.icon = rec.icon.trim().slice(0, 40)
    if (typeof rec.badge === 'string') entry.badge = rec.badge.trim().slice(0, 20)
    if (Array.isArray(rec.keywords)) {
      const keywords: string[] = []
      for (const k of rec.keywords) {
        if (typeof k !== 'string') continue
        const trimmed = k.trim().slice(0, 30)
        if (trimmed && !keywords.includes(trimmed)) keywords.push(trimmed)
        if (keywords.length >= PLUGIN_MAX_SEARCH_KEYWORDS) break
      }
      if (keywords.length > 0) entry.keywords = keywords
    }
    out.push(entry)
  }
  return out
}

// ─── React 视图协议 v2（#11）───
//
// 插件声明 "api": "react" 后，经 launcherApi.renderView 提交 JSON 视图树
// （SDK 的 react-reconciler 序列化产物，函数 props 已替换为回调 id）。
// 主进程 parsePluginView 归一为 v1 的 PluginListItem[]（sections 拍平、
// detail 降级为占位条目），胶囊既有渲染管线零改动。

export type PluginApiMode = 'data' | 'react'

/** 条目动作（react 模式下 callback 动作携带 SDK 生成的回调 id） */
export interface PluginViewAction extends PluginItemAction {
  callbackId?: string
}

export interface PluginViewListItem {
  title: string
  subtitle?: string
  icon?: string
  accessories?: string[]
  keywords?: string[]
  detail?: string
  detailFormat?: 'text' | 'markdown'
  actions: PluginViewAction[]
}

export interface PluginViewSection {
  title?: string
  items: PluginViewListItem[]
}

export type PluginViewNode =
  | { $t: 'list'; sections?: PluginViewSection[]; items?: PluginViewListItem[] }
  | { $t: 'detail'; markdown?: string; text?: string; actions?: unknown }

/** 视图条目 / 正文上限 */
export const PLUGIN_MAX_VIEW_ITEMS = 300
export const PLUGIN_MAX_VIEW_TEXT = 100 * 1024

function sanitizeViewAction(a: unknown): PluginViewAction | null {
  if (typeof a !== 'object' || a === null) return null
  const rec = a as Record<string, unknown>
  if (typeof rec.type !== 'string' || !SEARCH_ACTION_TYPES.has(rec.type)) return null
  if (typeof rec.label !== 'string' || rec.label.trim() === '') return null
  const action: PluginViewAction = { label: rec.label.trim().slice(0, 60), type: rec.type as PluginItemAction['type'] }
  if (typeof rec.payload === 'string') action.payload = rec.payload.slice(0, 4096)
  if (typeof rec.callbackId === 'string' && rec.callbackId.trim() !== '') {
    action.callbackId = rec.callbackId.trim().slice(0, 64)
  }
  return action
}

function sanitizeViewListItem(rec: Record<string, unknown>): PluginViewListItem | null {
  if (typeof rec.title !== 'string') return null
  const title = rec.title.trim().slice(0, 120)
  if (!title) return null
  const rawActions = Array.isArray(rec.actions) ? rec.actions : []
  const actions: PluginViewAction[] = []
  for (const a of rawActions) {
    const action = sanitizeViewAction(a)
    if (action) actions.push(action)
    if (actions.length >= 10) break
  }
  const item: PluginViewListItem = { title, actions }
  if (typeof rec.subtitle === 'string') item.subtitle = rec.subtitle.trim().slice(0, 200)
  if (typeof rec.icon === 'string') item.icon = rec.icon.trim().slice(0, 40)
  if (typeof rec.detail === 'string') {
    item.detail = rec.detail.slice(0, PLUGIN_MAX_VIEW_TEXT)
    item.detailFormat = rec.detailFormat === 'markdown' ? 'markdown' : 'text'
  }
  if (Array.isArray(rec.accessories)) {
    const acc = rec.accessories
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim().slice(0, 40))
      .filter((s) => s !== '')
      .slice(0, 3)
    if (acc.length > 0) item.accessories = acc
  }
  if (Array.isArray(rec.keywords)) {
    const kw = rec.keywords
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim().slice(0, 30))
      .filter((s) => s !== '')
      .slice(0, 8)
    if (kw.length > 0) item.keywords = kw
  }
  return item
}

/**
 * 列表视图的「非条目」元信息（对标 Raycast 的 isLoading / emptyView）：
 * 单独抽出来是因为解析结果仍是条目数组（宿主渲染管线不变），
 * 这两项只作为伴生状态随快照下发。
 */
export interface PluginListMeta {
  loading: boolean
  emptyMessage: string | null
}

export function parsePluginListMeta(raw: unknown): PluginListMeta {
  if (typeof raw !== 'object' || raw === null) return { loading: false, emptyMessage: null }
  const node = raw as Record<string, unknown>
  if (node.$t !== 'list') return { loading: false, emptyMessage: null }
  const empty = typeof node.emptyMessage === 'string' ? node.emptyMessage.trim().slice(0, 120) : ''
  return { loading: node.loading === true, emptyMessage: empty || null }
}

/**
 * 解析视图树 → v1 条目列表（fail-closed）：
 * - list：items + sections 拍平，非法 item/action 剔除，封顶 300
 * - detail：降级为「单条占位条目 + detail 正文」，复用胶囊 List-Detail 渲染
 */
export function parsePluginView(raw: unknown): PluginViewListItem[] {
  if (typeof raw !== 'object' || raw === null) return []
  const node = raw as Record<string, unknown>
  if (node.$t === 'detail') {
    const detail = typeof node.markdown === 'string'
      ? { text: node.markdown.slice(0, PLUGIN_MAX_VIEW_TEXT), format: 'markdown' as const }
      : typeof node.text === 'string'
        ? { text: node.text.slice(0, PLUGIN_MAX_VIEW_TEXT), format: 'text' as const }
        : null
    if (!detail) return []
    // Detail.actions（P-2.6）挂在占位条目上：SDK 侧已把 ActionPanel 序列化进 detail 节点
    //（见 frond-plugin-sdk reconciler serializeActions），宿主接住后复用既有的 runPluginAction
    // 通路。fail-closed 与 list 条目同一套清洗：非法动作剔除、封顶 10。
    const actions: PluginViewAction[] = []
    const rawActions = Array.isArray(node.actions) ? node.actions : []
    for (const a of rawActions) {
      const action = sanitizeViewAction(a)
      if (action) actions.push(action)
      if (actions.length >= 10) break
    }
    return [
      {
        title: '',
        detail: detail.text,
        detailFormat: detail.format,
        actions
      }
    ]
  }
  if (node.$t !== 'list') return []
  const out: PluginViewListItem[] = []
  const pushItems = (rawItems: unknown): void => {
    if (!Array.isArray(rawItems) || out.length >= PLUGIN_MAX_VIEW_ITEMS) return
    for (const item of rawItems) {
      if (out.length >= PLUGIN_MAX_VIEW_ITEMS) return
      if (typeof item !== 'object' || item === null) continue
      const parsed = sanitizeViewListItem(item as Record<string, unknown>)
      if (parsed) out.push(parsed)
    }
  }
  if (Array.isArray(node.sections)) {
    for (const section of node.sections.slice(0, 20)) {
      if (typeof section !== 'object' || section === null) continue
      pushItems((section as PluginViewSection).items)
    }
  }
  pushItems(node.items)
  return out
}

// ─── React 表单视图（#11 M2）───

export interface PluginFormNode {
  $t: 'form'
  title?: string
  submitLabel?: string
  /** 提交回调 id（SDK onSubmit 生成；宿主提交后经 Callback 钩子回传表单值） */
  submitId: string
  /** 字段协议复用 FormField（key/label/type/placeholder/options/initial） */
  fields: FormField[]
}

export const PLUGIN_MAX_FORM_FIELDS = 20

const FORM_FIELD_TYPES: ReadonlySet<string> = new Set([
  'text',
  'textarea',
  'select',
  'checkbox',
  'date',
  'password'
])

export interface ParsedPluginForm {
  title?: string
  submitLabel?: string
  submitId: string
  fields: FormField[]
}

/**
 * 解析表单视图节点（fail-closed）：submitId 必填、字段 id 必填且去重、
 * 非法类型降级 text、select 无选项降级 text、封顶 20 字段；无有效字段 → null。
 */
export function parsePluginForm(raw: unknown): ParsedPluginForm | null {
  if (typeof raw !== 'object' || raw === null) return null
  const node = raw as Record<string, unknown>
  if (node.$t !== 'form') return null
  if (typeof node.submitId !== 'string' || node.submitId.trim() === '') return null
  if (!Array.isArray(node.fields)) return null

  const fields: FormField[] = []
  const seenKeys = new Set<string>()
  for (const item of node.fields.slice(0, PLUGIN_MAX_FORM_FIELDS)) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.id !== 'string' || rec.id.trim() === '') continue
    const key = rec.id.trim().slice(0, 40)
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    const label = typeof rec.label === 'string' && rec.label.trim() !== ''
      ? rec.label.trim().slice(0, 60)
      : key
    let type: FormFieldType =
      typeof rec.type === 'string' && FORM_FIELD_TYPES.has(rec.type)
        ? (rec.type as FormFieldType)
        : 'text'
    const field: FormField = { key, label, type }
    if (typeof rec.placeholder === 'string') field.placeholder = rec.placeholder.slice(0, 200)
    if (type === 'checkbox') {
      field.initial = rec.initial === true
    } else if (typeof rec.initial === 'string') {
      field.initial = rec.initial.slice(0, 2000)
    }
    if (type === 'select') {
      const options = Array.isArray(rec.options)
        ? rec.options
            .filter((o): o is string => typeof o === 'string' && o.trim() !== '')
            .map((o) => o.trim().slice(0, 100))
            .slice(0, 20)
        : []
      if (options.length === 0) {
        type = 'text' // 无候选的 select 无法渲染，降级为文本输入
        field.type = 'text'
      } else {
        field.options = options
      }
    }
    fields.push(field)
  }
  if (fields.length === 0) return null

  const form: ParsedPluginForm = { submitId: node.submitId.trim().slice(0, 64), fields }
  if (typeof node.title === 'string' && node.title.trim() !== '') {
    form.title = node.title.trim().slice(0, 120)
  }
  if (typeof node.submitLabel === 'string' && node.submitLabel.trim() !== '') {
    form.submitLabel = node.submitLabel.trim().slice(0, 60)
  }
  return form
}

// ─── 插件敏感权限（声明制，2026-09-11 决策）───

/**
 * 敏感权限清单：manifest.permissions 声明后 plugapi 才放行；
 * 未声明的敏感 API 调用按各 API 现有失败形状静默拒绝（fail closed）。
 * 基础 API（UI/生命周期/db/preferences/notify）无需声明。
 */
export type PluginPermission =
  | 'clipboard.read'
  | 'clipboard.write'
  | 'fs.open'
  | 'net'
  /**
   * 让本插件的命令**在插件没开着的时候**被排程唤起（P-2③「生命周期外执行」）。
   * 单独一条而不是并入 net/fs.*：它的副作用是「第三方代码会在你没看它的时候跑」，
   * 用户该在导入确认框里单独看到这一项。
   */
  | 'schedule'

export const PLUGIN_PERMISSION_LABELS: Record<PluginPermission, string> = {
  'clipboard.read': '读取剪贴板',
  'clipboard.write': '写入剪贴板',
  'fs.open': '打开本地文件',
  net: '访问网络',
  schedule: '按计划运行本插件的命令'
}

/** 敏感 preload API → 所需权限（launcher/ipc.ts 强制执行） */
export const SENSITIVE_PLUGIN_API_PERMISSIONS: Record<string, PluginPermission> = {
  readText: 'clipboard.read',
  copyText: 'clipboard.write',
  openPath: 'fs.open',
  fetch: 'net',
  // open(url) 归到 net 而不是 fs.open：它的副作用是「把链接交给外部去取」，
  // 与 fetch 同类；fs.open 说的是本地文件系统
  openUrl: 'net'
  // alert / toast / hide 这类纯 UI 原语**故意不在这里**：它们不读用户的数据，
  // 要防的是「拿它骗用户点确认」和「刷屏」——前者靠标题必带插件名 +
  // destructive 走 warning 样式，后者靠同插件同时只一条模态框（launcher/pluginAlert）。
  // 加一条权限声明只会让每个插件的 manifest 多一行没人看得懂的字。
  //
  // schedule 也不在这里：排程通道走 plugapi:schedule* 那三根管子，
  // 由 launcher/ipc.ts 按 sender 直接查 hasPluginPermission('schedule')。
}

export function isPluginPermission(value: unknown): value is PluginPermission {
  return typeof value === 'string' && value in PLUGIN_PERMISSION_LABELS
}

// ─── 插件平台 API 的三道清洗（P-2.5）───
//
// ⚠ 恢复说明：本节的三个清洗函数随 2026-09-22 桌面删除事故丢失，语义按
// src/shared/__tests__/pluginPlatformApis.test.ts 里既有用例逐条重建（那份测试没丢，
// 是它把边界钉死的：哪些输入必须整条剔除、哪些只丢一个字段、哪些必须拒绝）。

/** 偏好项数量上限（防第三方声明超量设置项刷爆设置页） */
export const PLUGIN_MAX_PREFERENCES = 20
/** name 会当存储键用：剪短就等于换键，故超长只能整条剔除 */
const PREFERENCE_NAME_MAX = 64
const PREFERENCE_LABEL_MAX = 60
const PREFERENCE_DEFAULT_MAX = 500
const PREFERENCE_OPTION_MAX = 120
const PREFERENCE_TYPES = new Set(['text', 'select', 'checkbox'])

export type PluginPreferenceType = 'text' | 'select' | 'checkbox'

/** pluginStore 与 manifest 读的是这个名字；别名而不是第二份定义，免得两处漂移 */
export type PluginPreferenceDeclaration = PluginPreference

export interface PluginPreference {
  name: string
  label: string
  type: PluginPreferenceType
  default?: string | boolean
  options?: string[]
}

/**
 * 声明式偏好设置清洗。
 *
 * 取舍：能影响「存到哪个键 / 用什么控件」的字段出错一律整条剔除，
 * 只有纯显示用的 label 允许截断 —— 截断比剔除更坏，键被剪短之后
 * 插件 getPreference() 用的就不是同一个键了。password 之类不认识的 type
 * 也不降级成文本框（那等于把口令明文摆在设置页里）。
 */
export function sanitizePluginPreferences(raw: unknown): PluginPreference[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: PluginPreference[] = []
  for (const item of raw) {
    if (out.length >= PLUGIN_MAX_PREFERENCES) break
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.name !== 'string' || rec.name.trim() === '') continue
    if (rec.name.length > PREFERENCE_NAME_MAX) continue // 键超长：只能丢，不能剪
    if (seen.has(rec.name)) continue
    if (typeof rec.label !== 'string' || rec.label.trim() === '') continue // 无法展示 = 等于没声明
    seen.add(rec.name)

    let type: PluginPreferenceType
    if (rec.type === undefined) type = 'text'
    else if (typeof rec.type === 'string' && PREFERENCE_TYPES.has(rec.type))
      type = rec.type as PluginPreferenceType
    else continue

    const pref: PluginPreference = {
      name: rec.name,
      label: rec.label.slice(0, PREFERENCE_LABEL_MAX),
      type
    }

    if (type === 'select') {
      const options = Array.isArray(rec.options)
        ? rec.options.filter(
            (o): o is string => typeof o === 'string' && o !== '' && o.length <= PREFERENCE_OPTION_MAX
          )
        : []
      if (options.length === 0) continue // 无候选的 select 换了个控件，整条丢
      pref.options = options
      if (typeof rec.default === 'string' && options.includes(rec.default)) pref.default = rec.default
    } else if (type === 'checkbox') {
      if (typeof rec.default === 'boolean') pref.default = rec.default
    } else if (typeof rec.default === 'string' && rec.default.length <= PREFERENCE_DEFAULT_MAX) {
      pref.default = rec.default
    }
    out.push(pref)
  }
  return out
}

/** 交给 shell.openExternal 的 URL 长度上限：超限直接拒，不截断成一条「还能打开」的地址 */
export const PLUGIN_MAX_OPENABLE_URL = 2048
/** 宿主策略允许的协议：file:/data:/自定义 scheme 都不许（能读本地盘、能起任意 handler） */
const OPENABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function sanitizePluginOpenableUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.length > PLUGIN_MAX_OPENABLE_URL) return null
  let url: URL
  try {
    url = new URL(trimmed) // 协议相对 //example.com 与 'not a url' 都在这里落空
  } catch {
    return null
  }
  if (!OPENABLE_PROTOCOLS.has(url.protocol)) return null
  if (url.protocol === 'mailto:' && url.href.slice('mailto:'.length).trim() === '') return null
  return url.href
}

/** 一条模态框最多摆几颗按钮（再多就不是提示而是选择恐惧） */
export const PLUGIN_MAX_ALERT_ACTIONS = 4
const ALERT_TITLE_MAX = 80
const ALERT_MESSAGE_MAX = 600
const ALERT_STYLES = new Set(['default', 'cancel', 'destructive'])

export type SanitizedAlertStyle = 'default' | 'cancel' | 'destructive'

export interface SanitizedAlertAction {
  id: string
  title: string
  style: SanitizedAlertStyle
}

export interface SanitizedAlert {
  title: string
  message: string
  actions: SanitizedAlertAction[]
}

/**
 * 插件 alert 请求清洗：宿主确实会弹**原生模态框**，所以这里必须苛刻。
 * 没有 message 直接拒（弹一个空框只会吓人）；动作缺 id/title 的剔除、id 去重、
 * style 只认三种（拼错的降级成 default 而不是丢掉，按钮内容还在）。
 */
export function sanitizeAlertRequest(raw: unknown): SanitizedAlert | null {
  if (typeof raw !== 'object' || raw === null) return null
  const rec = raw as Record<string, unknown>
  if (typeof rec.message !== 'string' || rec.message.trim() === '') return null

  const actions: SanitizedAlertAction[] = []
  const seen = new Set<string>()
  if (Array.isArray(rec.actions)) {
    for (const item of rec.actions) {
      if (actions.length >= PLUGIN_MAX_ALERT_ACTIONS) break
      if (typeof item !== 'object' || item === null) continue
      const a = item as Record<string, unknown>
      if (typeof a.id !== 'string' || a.id === '' || seen.has(a.id)) continue
      if (typeof a.title !== 'string' || a.title.trim() === '') continue
      seen.add(a.id)
      actions.push({
        id: a.id,
        title: a.title.slice(0, ALERT_TITLE_MAX),
        style:
          typeof a.style === 'string' && ALERT_STYLES.has(a.style)
            ? (a.style as SanitizedAlertStyle)
            : 'default'
      })
    }
  }
  return {
    title: typeof rec.title === 'string' ? rec.title.slice(0, ALERT_TITLE_MAX) : '',
    message: rec.message.slice(0, ALERT_MESSAGE_MAX),
    actions
  }
}
