/**
 * @leaf/raycast-api · `@raycast/api` 兼容别名层（#11 M3）
 *
 * 定位（照 docs/REACT_API_DESIGN.md 的口径）：让**会写 Raycast 的人**用 Raycast 的组件
 * 形态写 Leaf 插件；「直接跑未改动的商店扩展」是明确非目标。本层只做形状适配，
 * 渲染仍全部走 leaf-plugin-sdk → JSON 视图协议 → 宿主原生渲染。
 *
 * 插件侧接法（不冒用 @raycast 这个 npm scope，由构建工具把包名指过来）：
 *   esbuild:  alias: { '@raycast/api': '@leaf/raycast-api' }
 *   tsconfig: paths: { '@raycast/api': ['node_modules/@leaf/raycast-api'] }
 *
 * 本层消化的形状差异：
 * - `List` 的条目在 Raycast 走 `items` prop → Leaf 是 children
 * - `List.Item` 的 `actions` 是 prop（且可不套 ActionPanel）→ Leaf 是 children 里的 ActionPanel
 * - `List.Item.accessories` 是 `{title?, value}[]` → Leaf 是 `string[]`
 * - 字段组件的键在 Raycast 新版是 `name`、标签是 `title`、初值是 `defaultValue` →
 *   Leaf 的 `id` / `label` / `initial`
 * - `Form.Submit` 是显式子元素 → Leaf 由宿主渲染提交按钮（取其 title 作 submitLabel）
 *
 * 宿主已有的能力已真接（P-2.3 / P-2.6）：Toast / LocalStorage / Cache / navigation.popToRoot /
 * List.isLoading / List.emptyView（收成一句 emptyMessage）。
 * 宿主确实没有的能力在**首次调用时** console.warn 一次并安全降级（Alert 模态框 /
 * getPreferenceValues / getSelectedText / open / HUD 族…），不做假实现。
 */
import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode
} from 'react'
import {
  Action as SdkAction,
  ActionPanel as SdkActionPanel,
  Detail as SdkDetail,
  Form as SdkForm,
  List as SdkList,
  start,
  useNavigation as useSdkNavigation,
  showToast,
  getLocalStorageItem,
  setLocalStorageItem,
  removeLocalStorageItem,
  getCacheItem,
  setCacheItem,
  removeCacheItem,
  showAlert,
  openExternalUrl,
  getPreferenceValues as sdkGetPreferenceValues,
  type AlertAction,
  type FormFieldProps,
  type FormSelectProps
} from 'leaf-plugin-sdk'

const warned = new Set<string>()

function notSupported(what: string): void {
  if (warned.has(what)) return
  warned.add(what)
  console.warn(`[leaf-raycast-api] ${what}：Leaf 宿主无对应能力，本次调用已忽略`)
}

/** 展开 Fragment / 数组为扁平元素列表，并补齐 key（Raycast 习惯把数组直接喂给
 * items / actions，不写 key 会在开发控制台刷「unique key」警告且元素状态易串位） */
function elements(node: ReactNode): ReactElement[] {
  const out: ReactElement[] = []
  Children.toArray(node).forEach((child, i) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) {
      out.push(...elements((child.props as { children?: ReactNode }).children))
      return
    }
    out.push(child.key === null ? cloneElementWithKey(child, keyFor(child, i)) : child)
  })
  return out
}

/** Raycast 的 List.Item `id` 正是 key 的来源；动作等没有 id 的用序号 */
function keyFor(el: ReactElement, index: number): string {
  const props = el.props as { id?: string | number; title?: string }
  if (props.id !== undefined && props.id !== null) return String(props.id)
  return `${typeof el.type === 'function' ? ((el.type as { displayName?: string }).displayName ?? el.type.name) : String(el.type)}-${props.title ?? ''}-${index}`
}

function cloneElementWithKey(el: ReactElement, key: string): ReactElement {
  return { ...el, key }
}

const isKind = (el: ReactElement, component: unknown): boolean => el.type === component

// ─── Action 族 ───

export interface ActionProps {
  title?: string
  shortcut?: string
  onAction?: (args?: unknown) => void
}

export function Action(props: ActionProps): ReactElement {
  return createElement(SdkAction, {
    title: props.title ?? '操作',
    shortcut: props.shortcut,
    onAction: props.onAction
  })
}
Action.displayName = 'Action'

function mapped(
  props: Record<string, unknown>,
  fallbackTitle: string,
  type: 'copy' | 'open',
  payloadKey: string
): ReactElement {
  const payload = props[payloadKey]
  // Raycast 的 Action.* 用 `name` 作标签（旧版/文档里也见 title），两个都收
  const label = props.name ?? props.title
  return createElement(SdkAction, {
    title: typeof label === 'string' && label.trim() ? label : fallbackTitle,
    type,
    payload: typeof payload === 'string' ? payload : ''
  })
}

export function ActionCopy(props: { name?: string; title?: string; text?: string }): ReactElement {
  return mapped(props as Record<string, unknown>, '复制', 'copy', 'text')
}
export function ActionOpen(props: {
  name?: string
  title?: string
  target?: string
}): ReactElement {
  return mapped(props as Record<string, unknown>, '打开', 'open', 'target')
}
/** Action.Close ≈ 关闭扩展：Leaf 的「根视图 pop」正是关闭插件 */
export function ActionClose(props: { title?: string; name?: string }): ReactElement {
  const nav = useSdkNavigation()
  return createElement(SdkAction, {
    title: props.title ?? props.name ?? '关闭',
    type: 'callback',
    onAction: () => nav.pop()
  })
}
function unsupportedAction(props: { title?: string }): null {
  notSupported(`Action.${(props as { name?: string }).name ?? props?.title ?? ''}`)
  return null
}

Action.Copy = ActionCopy
Action.Open = ActionOpen
Action.Close = ActionClose
Action.SubmitForm = unsupportedAction
Action.ShowHUD = unsupportedAction
Action.HideHUD = unsupportedAction
Action.JSB = unsupportedAction

export function ActionPanel(props: { children?: ReactNode }): ReactElement {
  return createElement(SdkActionPanel, { children: props.children })
}
ActionPanel.displayName = 'ActionPanel'

/** actions prop（裸 Action / 数组 / Fragment / 已套 ActionPanel）→ <action-panel> 子元素 */
function actionsNode(actions: ReactNode, existing: ReactNode): ReactNode {
  const collected: ReactNode[] = []
  for (const el of elements(actions)) {
    if (isKind(el, ActionPanel))
      collected.push(...elements((el.props as { children?: ReactNode }).children))
    else collected.push(el)
  }
  const children = [...collected, ...elements(existing)]
  if (children.length === 0) return undefined
  return createElement(SdkActionPanel, null, children)
}

// ─── List 族 ───

export interface ListItemProps {
  id?: string | number
  title?: string
  subtitle?: string
  icon?: string
  accessories?: Array<{ title?: string; value: string } | string>
  actions?: ReactNode
  children?: ReactNode
  /** Leaf 专有：选中即展示的正文 */
  detail?: string
  detailFormat?: 'text' | 'markdown'
}

export function ListItem(props: ListItemProps): ReactElement {
  const { id, accessories, actions, children, ...forward } = props
  void id // Raycast 用 id 定位条目；Leaf 由视图栈位置承担
  return createElement(SdkList.Item, {
    ...forward,
    title: props.title ?? '',
    accessories: accessories?.map((a) =>
      typeof a === 'string' ? a : String(a.value ?? a.title ?? '')
    ),
    children: actionsNode(actions, children)
  })
}
ListItem.displayName = 'List.Item'

export function ListSection(props: {
  title?: string
  children?: ReactNode
  actions?: ReactNode
}): ReactElement {
  const { actions, ...forward } = props
  if (actions) notSupported('List.Section.actions（分组级动作）')
  return createElement(SdkList.Section, forward)
}
ListSection.displayName = 'List.Section'

export interface ListProps {
  /** Raycast：条目经 items 传入 */
  items?: ReactNode
  children?: ReactNode
  searchBarPlaceholder?: string
  navigationTitle?: string
  /** P-2.6：已接到宿主（isLoading → loading） */
  isLoading?: boolean
  /** P-2.6：EmptyView 元素收成一句空态文案（宿主不渲染任意 React 子树） */
  emptyView?: ReactNode
}

/** Raycast 的 `<EmptyView title=… description=…/>` → Leaf 的一条空态文案 */
function emptyViewMessage(node: ReactNode): string | undefined {
  const el = (Array.isArray(node) ? node[0] : node) as ReactNode
  if (!isValidElement(el)) return undefined
  const p = (el.props ?? {}) as { title?: unknown; description?: unknown }
  const parts = [p.title, p.description].filter(
    (s): s is string => typeof s === 'string' && s.trim() !== ''
  )
  return parts.length > 0 ? parts.join(' — ') : undefined
}

/** Raycast 的 EmptyView 只作为 List.emptyView 传入、由宿主渲染成一句文案；自身不产出视图 */
export function EmptyView(_props: {
  title?: string
  description?: string
  children?: ReactNode
}): null {
  return null
}

export function List(props: ListProps): ReactElement {
  // 搜索框提示语由宿主统一提供（审查 I3 把这条从 SDK 摘掉过，别再当假 API 传下去）
  if (props.searchBarPlaceholder)
    notSupported('List.searchBarPlaceholder（胶囊占位文案由宿主控制）')
  return createElement(
    SdkList,
    {
      loading: props.isLoading === true,
      emptyMessage: props.emptyView ? emptyViewMessage(props.emptyView) : undefined
    },
    props.items ?? props.children
  )
}
List.displayName = 'List'
List.Item = ListItem
List.Section = ListSection

// ─── Detail ───

export interface DetailProps {
  markdown?: string
  navigationTitle?: string
  actions?: ReactNode
  children?: ReactNode
}

export function Detail(props: DetailProps): ReactElement {
  const { markdown, children, actions } = props
  // P-2.6：Detail.actions 接上了——宿主把 detail 降级成「占位条目 + 正文」，
  // 动作挂在那条占位条目上，胶囊既有的动作行与 runPluginAction 原样复用
  if (markdown) return createElement(SdkDetail, { markdown }, actions ?? null)
  // Raycast 新版把正文放 <Markdown /> 子组件：这里只吃纯文本子节点
  const text = Children.toArray(children)
    .map((c) =>
      typeof c === 'string'
        ? c
        : isValidElement(c)
          ? String((c.props as { text?: unknown }).text ?? '')
          : ''
    )
    .join('')
  if (Children.count(children) > 0 && !text) notSupported('Detail 的富组件子元素（Markdown 等）')
  return createElement(SdkDetail, { text })
}
Detail.displayName = 'Detail'

// ─── Form 族（字段组件全部委派给 SDK 的同名实现，不自己造宿主元素名） ───

interface RayField {
  id?: string
  name?: string
  title?: string
  label?: string
  placeholder?: string
  defaultValue?: string | boolean
  default?: string | boolean
  value?: string | boolean
}

/** 字段形状对齐 SDK 导出类型（不用 as never 糊掉不匹配） */
function toLeafField(props: RayField): FormFieldProps {
  return {
    id: props.id ?? props.name ?? '',
    label: props.title ?? props.label,
    placeholder: props.placeholder,
    initial: props.defaultValue ?? props.default ?? props.value
  }
}

export function FormTextField(props: RayField): ReactElement {
  return createElement(SdkForm.TextField, toLeafField(props))
}
export function FormTextArea(props: RayField): ReactElement {
  return createElement(SdkForm.TextArea, toLeafField(props))
}
export function FormPassword(props: RayField): ReactElement {
  return createElement(SdkForm.PasswordField, toLeafField(props))
}
export function FormDate(props: RayField): ReactElement {
  return createElement(SdkForm.DateField, toLeafField(props))
}
/** 协议里 checkbox 的 initial 是 boolean（plugin-protocol FormField） */
export function FormCheckbox(props: RayField): ReactElement {
  const p = toLeafField(props)
  p.initial = props.defaultValue === true || props.default === true
  return createElement(SdkForm.Checkbox, p)
}
export function FormDropdown(props: {
  id?: string
  name?: string
  title?: string
  label?: string
  defaultValue?: string
  children?: ReactNode
}): ReactElement {
  const options = elements(props.children)
    .map((el) => {
      const p = el.props as { value?: string; title?: string }
      return p.value ?? p.title ?? ''
    })
    .filter(Boolean)
  const field: FormSelectProps = { ...toLeafField(props), options }
  return createElement(SdkForm.Select, field)
}
FormDropdown.Item = function DropdownItem(_props: { title?: string; value?: string }): null {
  return null // 选项已由父级收集，子元素本身不产出节点
}

export function FormSubmit(_props: { title?: string }): null {
  return null
}
export function FormDescription(_props: { text?: string }): null {
  return null
}
export function FormSeparator(): null {
  return null
}

export interface FormProps {
  children?: ReactNode
  onSubmit?: (values: Record<string, string | boolean>) => void
  enableFiltering?: boolean
  navigationTitle?: string
}

export function Form(props: FormProps): ReactElement {
  let submitLabel: string | undefined
  const fields: ReactNode[] = []
  for (const el of elements(props.children)) {
    if (isKind(el, FormSubmit)) {
      const title = (el.props as { title?: string }).title
      if (title) submitLabel = title
      continue // 提交按钮由宿主渲染
    }
    if (isKind(el, FormDescription) || isKind(el, FormSeparator)) continue
    fields.push(el)
  }
  return createElement(SdkForm, { onSubmit: props.onSubmit, submitLabel, children: fields })
}
Form.displayName = 'Form'
Form.TextField = FormTextField
Form.TextArea = FormTextArea
Form.Password = FormPassword
Form.Date = FormDate
Form.Checkbox = FormCheckbox
Form.Dropdown = FormDropdown
Form.Submit = FormSubmit
Form.Description = FormDescription
Form.Separator = FormSeparator
Form.Tags = function FormTags(props: RayField): ReactElement {
  notSupported('Form.Tags（降级为单行文本）')
  return FormTextField(props)
}

// ─── 导航与挂载 ───

export function useNavigation(): {
  push: (el: ReactNode) => void
  pop: () => void
  popToRoot: () => void
  pushAndClearStack: (el: ReactNode) => void
  close: () => void
} {
  const nav = useSdkNavigation()
  return {
    push: nav.push,
    pop: nav.pop,
    pushAndClearStack: (el: ReactNode): void => {
      nav.popToRoot()
      nav.push(el)
    },
    close: nav.pop,
    popToRoot: nav.popToRoot
  }
}

/** Leaf 需要显式挂载入口组件（Raycast 由宿主调 main()） */
export function render(element: ReactNode): void {
  start(element)
}

// ─── 已接宿主的能力（P-2.3：不再是 notSupported） ───

export const Toast = {
  show: (styleOrOptions?: unknown, message?: unknown): void => {
    showToast(styleOrOptions, typeof message === 'string' ? message : undefined)
  }
}

export const LocalStorage = {
  getItem: async (key: string): Promise<string | undefined> => getLocalStorageItem(key),
  setItem: async (key: string, value: string): Promise<void> => setLocalStorageItem(key, value),
  removeItem: async (key: string): Promise<void> => removeLocalStorageItem(key)
}

/** Raycast 的 Cache 是独立 API 名（带 ttl 秒），不是 LocalStorage 的别名 */
export const Cache = {
  getCacheItem: async (key: string): Promise<string | undefined> => getCacheItem(key),
  setCacheItem: async (key: string, value: string, ttl?: number): Promise<void> =>
    setCacheItem(key, value, ttl),
  removeCacheItem: async (key: string): Promise<void> => removeCacheItem(key)
}

// ─── Alert（P-2.5：宿主原生模态框，dialog.showMessageBox）───

/** Raycast 的 Action 形状：`new Alert.Action(name, id?, style?)` */
export class AlertActionItem {
  readonly name: string
  readonly id: string
  readonly style: 'primary' | 'destructive' | 'cancel' | 'default'
  constructor(name: string, id?: string, style?: 'primary' | 'destructive' | 'cancel' | 'default') {
    this.name = name
    this.id = id ?? name
    this.style = style ?? 'default'
  }
}

export interface AlertOptions {
  title: string
  message?: string
  actions?: AlertActionItem[]
  primaryAction?: AlertActionItem
  dangerAction?: AlertActionItem
  cancelAction?: AlertActionItem
  /** 原生模态框没有输入框——传了会被明确 warn，不静默丢掉 */
  enableInput?: boolean
  inputPlaceholder?: string
  defaultValue?: string
}

/** 顺序按 Raycast 的呈现习惯：primary → danger → 其余 → cancel（Escape 天然是它） */
function collectAlertActions(options: AlertOptions): AlertActionItem[] {
  const out: AlertActionItem[] = []
  const push = (a?: AlertActionItem): void => {
    if (a && !out.some((x) => x.id === a.id)) out.push(a)
  }
  push(options.primaryAction)
  push(options.dangerAction)
  for (const a of options.actions ?? []) push(a)
  push(options.cancelAction)
  return out.slice(0, 4) // 与宿主 sanitizeAlertRequest 的封顶一致，超出的这里就截掉
}

async function showRaycastAlert(options: AlertOptions): Promise<AlertActionItem | null> {
  if (options.enableInput) {
    notSupported('Alert.enableInput（原生模态框没有输入框，本次按无输入呈现）')
  }
  const items = collectAlertActions(options)
  const dto: AlertAction[] = items.map((a) => ({
    id: a.id,
    title: a.name,
    // 'primary' 在这里就是缺省样式：谁是主操作由 defaultId 决定，不由样式决定
    style: a.style === 'cancel' ? 'cancel' : a.style === 'destructive' ? 'destructive' : 'default'
  }))
  const pressed = await showAlert({
    title: options.title,
    message: options.message ?? '',
    actions: dto
  })
  if (pressed === null) return null
  return items.find((a) => a.id === pressed) ?? null
}

export const Alert = {
  Action: AlertActionItem,
  show: showRaycastAlert
}

/** Raycast 的 `alert(title, message)` 便捷形态：只有一个确认按钮，resolve null */
export async function alert(
  titleOrOptions: string | AlertOptions,
  message?: string
): Promise<AlertActionItem | null> {
  if (typeof titleOrOptions === 'string') {
    return showRaycastAlert({ title: titleOrOptions, message })
  }
  return showRaycastAlert(titleOrOptions)
}

/**
 * 一次取回清单声明过的全部偏好。
 * **与 Raycast 的差别**：那边同步、这里 async（值要跨进程问主进程）。
 * 从 Raycast 移植时漏掉 await 会读到 undefined，所以 PLUGIN_DEV 里点名写了这条。
 */
export async function getPreferenceValues<T = Record<string, unknown>>(): Promise<T> {
  return sdkGetPreferenceValues<T>()
}

/** 把链接交给系统浏览器（需 manifest permissions 声明 'net'，协议限 http/https/mailto） */
export async function open(url: string): Promise<void> {
  const ok = await openExternalUrl(String(url ?? ''))
  if (!ok)
    notSupported(
      `open（被宿主拒绝：协议不在白名单，或 manifest 未声明 net 权限）: ${String(url).slice(0, 80)}`
    )
}

// ─── 仍然不提供的具名导出（宿主无对应能力，调用时说明并安全降级） ───

/**
 * 为什么只有它留着：读选中文本要 macOS 辅助功能权限下的 AX API（kAXSelectedText），
 * 本仓的宿主侧还没有这一层。常见的「模拟 ⌘C 再读剪贴板」在这里**不能用**——
 * Leaf 自己记录剪贴板历史，模拟一次复制就会往用户的历史里塞一条，
 * 那是拿用户的真实数据换一次便利。见 P-4⑤ Screen Awareness 那条真机待办。
 */
export function getSelectedText(): Promise<string> {
  notSupported('getSelectedText（返回空串）')
  return Promise.resolve('')
}
