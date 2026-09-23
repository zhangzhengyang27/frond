/* eslint-disable @typescript-eslint/no-empty-function -- host config 的 no-op 方法是 react-reconciler 惯例（Ink 同款） */
/**
 * React reconciler 宿主配置（#11，对标 Vicinae reconciler.ts / Ink 的 host config）：
 * React 组件树 → JSON 视图树（{$t, props, children}），函数 props（Action 的 onAction）
 * 序列化为回调 id。宿主（胶囊）解析 JSON 原生渲染，插件 DOM 永不进宿主。
 *
 * 提交节流：commit 完成后按帧合并提交（rAF，降级 setTimeout 16ms）。
 */
import type { ReactNode } from 'react'
import Reconciler from 'react-reconciler'
import { retainCallbacks } from './registry'
import type { ViewNode } from './types'

export type HostType =
  | 'list'
  | 'section'
  | 'list-item'
  | 'detail'
  | 'action-panel'
  | 'action'
  | 'form'
  | 'text-field'
  | 'textarea-field'
  | 'select-field'
  | 'checkbox-field'
  | 'date-field'
  | 'password-field'

export interface HostNode {
  type: HostType
  props: Record<string, unknown>
  children: HostNode[]
}

declare const launcherApi: {
  renderView: (view: unknown) => Promise<{ ok: boolean; count?: number; error?: string }>
}

/** 事件批（FSEvents 式节流提交） */
let pendingView: ViewNode | null = null
let submitScheduled = false

function scheduleSubmit(view: ViewNode): void {
  pendingView = view
  if (submitScheduled) return
  submitScheduled = true
  let fired = false
  const submit = (): void => {
    if (fired) return
    fired = true
    submitScheduled = false
    const view2 = pendingView
    pendingView = null
    if (!view2) return
    launcherApi.renderView(view2).then(
      (r) => {
        if (!r.ok) console.warn('[leaf-sdk] renderView rejected:', r.error ?? 'unknown')
      },
      (e: unknown) => {
        // 静默吞掉会让插件停在旧内容/空白且零诊断（审查 I2）
        console.warn('[leaf-sdk] renderView failed:', (e as Error)?.message ?? e)
      }
    )
  }
  // 调度用 queueMicrotask：隐藏页面（声明模式插件视图）的 rAF/setTimeout 会被
  // Chromium 后台节流冻结，回调后的视图提交将无限延迟（#11 审查实证）；
  // React commit 本身已按批次收敛，微任务直发即最及时且不被节流
  if (typeof queueMicrotask === 'function') queueMicrotask(submit)
  else setTimeout(submit, 0)
}

/** 函数 props → 回调 id（顶层 onAction 映射为 callbackId，其余函数嵌套清洗）；
 * 返回替换后的 props，并把用到的 id 收进 used */
function serializeProps(
  props: Record<string, unknown>,
  used: Set<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || value === undefined) continue
    if (typeof value === 'function') {
      const { registerCallback } = registryModule
      const id = registerCallback(value as (args?: unknown) => void)
      used.add(id)
      out[key === 'onAction' ? 'callbackId' : `cb:${key}`] = id
      continue
    }
    out[key] = sanitizeValue(value, key, used)
  }
  return out
}

/** 嵌套值清洗：对象/数组内的函数也替换为回调 id（可结构化克隆，审查 I2）。
 * 两道守卫：路径集命中 = 成环 → 该处置 null；深度上限兜住无环的病态深嵌套。
 * 不加守卫时环会在 commit 序列化里 RangeError，打坏 root 后整棵视图静默不提交
 * （#11 flake 同型故障，见 commitUpdate 注释） */
const MAX_NEST_DEPTH = 24

function sanitizeValue(
  value: unknown,
  key: string,
  used: Set<string>,
  depth = 0,
  path = key,
  ancestors: WeakSet<object> = new WeakSet()
): unknown {
  if (typeof value === 'function') {
    const { registerCallback } = registryModule
    const id = registerCallback(value as (args?: unknown) => void)
    used.add(id)
    return `cb:${key}`
  }
  const isContainer = Array.isArray(value) || (typeof value === 'object' && value !== null)
  if (isContainer) {
    if (ancestors.has(value as object)) {
      console.warn(`[leaf-sdk] props 成环，该处已置 null：${path}`)
      return null
    }
    if (depth >= MAX_NEST_DEPTH) {
      console.warn(`[leaf-sdk] props 嵌套超 ${MAX_NEST_DEPTH} 层，已截断：${path}`)
      return null
    }
    ancestors.add(value as object)
    try {
      if (Array.isArray(value)) {
        return value.map((v, i) =>
          sanitizeValue(v, key, used, depth + 1, `${path}[${i}]`, ancestors)
        )
      }
      const nested: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        nested[k] = sanitizeValue(v, k, used, depth + 1, `${path}.${k}`, ancestors)
      }
      return nested
    } finally {
      ancestors.delete(value as object)
    }
  }
  return value
}

/** ActionPanel 子树 → actions 数组 */
function serializeActions(node: HostNode, used: Set<string>): Array<Record<string, unknown>> {
  const actions: Array<Record<string, unknown>> = []
  const collect = (nodes: HostNode[]): void => {
    for (const n of nodes) {
      if (n.type === 'action') {
        const serialized = serializeProps(n.props, used)
        if (typeof serialized.label === 'string') actions.push(serialized)
      } else if (n.type === 'action-panel') {
        collect(n.children)
      }
    }
  }
  collect(node.children)
  return actions
}

/** list 宿主节点 → 视图条目（section 拍平） */
function serializeList(node: HostNode, used: Set<string>): ViewNode {
  const items: Array<Record<string, unknown>> = []
  const walk = (children: HostNode[]): void => {
    for (const child of children) {
      if (child.type === 'section') {
        walk(child.children) // 分组拍平（v1 宿主不渲染分组标题）
        continue
      }
      if (child.type !== 'list-item') continue
      const item = serializeProps(child.props, used)
      const panel = child.children.find((c) => c.type === 'action-panel')
      if (panel) item.actions = serializeActions(panel, used)
      items.push(item)
    }
  }
  walk(node.children)
  // 审查 C2：v1 宿主不渲染分组标题，sections 一并输出会导致条目重复（宿主先吃
  // sections 再吃 items）——只发扁平 items；分组语义留协议 v3
  // v: 协议版本（审查 M1；宿主对缺失版本向后容忍）
  // loading 恒发布尔（宿主直接读，不必处理 undefined）；emptyMessage 只发非空串
  const emptyMessage =
    typeof node.props.emptyMessage === 'string' ? node.props.emptyMessage.trim() : ''
  return {
    v: 2,
    $t: 'list' as const,
    loading: node.props.loading === true,
    ...(emptyMessage ? { emptyMessage } : {}),
    items
  } as unknown as ViewNode
}

const FIELD_HOST_TYPES: ReadonlySet<string> = new Set([
  'text-field',
  'textarea-field',
  'select-field',
  'checkbox-field',
  'date-field',
  'password-field'
])

const FIELD_TYPE_BY_HOST: Record<string, string> = {
  'text-field': 'text',
  'textarea-field': 'textarea',
  'select-field': 'select',
  'checkbox-field': 'checkbox',
  'date-field': 'date',
  'password-field': 'password'
}

/** form 宿主节点 → 表单视图（字段从 children 收集，onSubmit → submitId） */
function serializeForm(node: HostNode, used: Set<string>): ViewNode {
  const { registerCallback } = registryModule
  const fields: Array<Record<string, unknown>> = []
  let submitId: string | null = null
  const collect = (nodes: HostNode[]): void => {
    for (const child of nodes) {
      if (FIELD_HOST_TYPES.has(child.type)) {
        const p = child.props
        // 协议节点用 id（作者形态），主进程 parsePluginForm 归一为 FormField.key
        const field: Record<string, unknown> = {
          id: typeof p.id === 'string' ? p.id : `field${fields.length}`,
          label: typeof p.label === 'string' ? p.label : undefined,
          type: FIELD_TYPE_BY_HOST[child.type] ?? 'text'
        }
        if (typeof p.placeholder === 'string') field.placeholder = p.placeholder
        if (p.initial !== undefined) field.initial = p.initial
        if (Array.isArray(p.options)) field.options = p.options
        fields.push(field)
      } else if (child.type === 'action-panel' || child.type === 'list') {
        collect(child.children) // 容错：字段可被分组容器包裹
      }
    }
  }
  collect(node.children)
  if (typeof node.props.onSubmit === 'function') {
    submitId = registerCallback(node.props.onSubmit as (args?: unknown) => void)
    used.add(submitId)
  }
  const view: Record<string, unknown> = { v: 2, $t: 'form', submitId: submitId ?? '', fields }
  if (typeof node.props.submitLabel === 'string') view.submitLabel = node.props.submitLabel
  if (typeof node.props.title === 'string') view.title = node.props.title
  return view as unknown as ViewNode
}

function serializeNode(node: HostNode, used: Set<string>): ViewNode | null {
  if (node.type === 'form') return serializeForm(node, used)
  if (node.type === 'detail') {
    const markdown = typeof node.props.markdown === 'string' ? node.props.markdown : undefined
    const text = typeof node.props.text === 'string' ? node.props.text : undefined
    // Detail.actions（Raycast 详情级动作面板）：宿主把 detail 降级成「单条占位条目 +
    // 正文」，所以动作挂到那条占位条目上即可复用既有的 runPluginAction 通路
    const panel = node.children.find((c) => c.type === 'action-panel')
    const actions = panel ? serializeActions(panel, used) : undefined
    if (markdown !== undefined) return { $t: 'detail', markdown, ...(actions ? { actions } : {}) }
    if (text !== undefined) return { $t: 'detail', text, ...(actions ? { actions } : {}) }
    return null
  }
  if (node.type === 'list') return serializeList(node, used)
  return null
}

/** 根容器：render() 的 children 直接挂在容器节点上 */
const container: HostNode = { type: 'list', props: {}, children: [] }

// registry 以 lazy 方式引入（避免与组件文件形成初始化环）
import * as registryModule from './registry'

const reconciler = Reconciler({
  isPrimaryRenderer: true,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  createInstance(type: string, props: Record<string, unknown>): HostNode {
    return { type: type as HostType, props, children: [] }
  },
  createTextInstance(text: string): HostNode {
    return { type: 'action', props: { label: text, __text: true }, children: [] }
  },
  appendInitialChild(parent: HostNode, child: HostNode): void {
    parent.children.push(child)
  },
  appendChild(parent: HostNode, child: HostNode): void {
    parent.children.push(child)
  },
  appendChildToContainer(_c: HostNode, child: HostNode): void {
    container.children.push(child)
  },
  removeChild(parent: HostNode, child: HostNode): void {
    parent.children = parent.children.filter((c) => c !== child)
  },
  removeChildFromContainer(_c: HostNode, child: HostNode): void {
    container.children = container.children.filter((c) => c !== child)
  },
  insertBefore(parent: HostNode, child: HostNode, before: HostNode): void {
    const idx = parent.children.indexOf(before)
    if (idx === -1) parent.children.push(child)
    else parent.children.splice(idx, 0, child)
  },
  // 0.34 形参为 (instance, type, prevProps, nextProps, internalHandle)——无 updatePayload
  // （旧签名多一位会让 internalHandle(fiber) 落成 props，序列化时递归爆栈）
  commitUpdate(
    instance: HostNode,
    _type: string,
    _prevProps: Record<string, unknown>,
    nextProps: Record<string, unknown>
  ): void {
    instance.props = nextProps
  },
  finalizeInitialChildren(): boolean {
    return false
  },
  getChildHostContext(ctx: unknown): unknown {
    return ctx
  },
  getRootHostContext(ctx: unknown): unknown {
    return ctx
  },
  shouldSetTextContent(): boolean {
    return false
  },
  clearContainer(): void {
    container.children = []
  },
  prepareForCommit(): null {
    return null
  },
  resetAfterCommit(): void {
    const used = new Set<string>()
    const views = container.children
      .map((c) => serializeNode(c, used))
      .filter((v): v is ViewNode => v !== null)
    retainCallbacks(used)
    if (views.length === 1) scheduleSubmit(views[0])
    else if (views.length > 1) scheduleSubmit({ $t: 'list', items: [] })
  },
  preparePortalMount(): void {},
  getPublicInstance(node: HostNode): HostNode {
    return node
  },
  commitTextUpdate(instance: HostNode, _oldText: string, newText: string): void {
    if (instance.props && instance.props.__text) instance.props.label = newText
  },
  hideInstance(instance: HostNode): void {
    instance.props.__hidden = true
  },
  unhideInstance(instance: HostNode): void {
    instance.props.__hidden = false
  },
  hideTextInstance(instance: HostNode): void {
    instance.props.__hidden = true
  },
  unhideTextInstance(instance: HostNode): void {
    instance.props.__hidden = false
  },
  preparePortalRender(): void {},
  scheduleTimeout(): number {
    return 0
  },
  cancelTimeout(): void {},
  noTimeout: -1,
  now(): number {
    return Date.now()
  },
  getCurrentEventPriority(): number {
    return 1
  },
  resolveEventType(): null {
    return null
  },
  resolveEventTimeStamp(): number {
    return -1.1
  },
  setCurrentUpdatePriority(): void {},
  getCurrentUpdatePriority(): number {
    return 0
  },
  trackSchedulerEvent(): void {},
  shouldAttemptEagerTransition(): null {
    return null
  },
  resolveUpdatePriority(): number {
    return 1
  },
  resetFormInstance(): void {},
  requestPostPaintCallback(): void {},
  maySuspendCommit(): boolean {
    return false
  },
  preloadInstance(): boolean {
    return true
  },
  startSuspendingCommit(): void {},
  suspendInstance(): void {},
  waitForCommitToBeReady(): null {
    return null
  },
  NotPendingTransition: null,
  HostTransitionContext: { _currentValue: null } as never,
  getInstanceFromNode(): null {
    return null
  },
  prepareScopeUpdate(): void {},
  getInstanceFromScope(): null {
    return null
  },
  detachDeletedInstance(): void {},
  afterActiveInstanceBlur(): void {},
  supportsMicrotasks: true,
  scheduleMicrotask(fn: () => void): void {
    fn()
  }
})

let root: unknown = null
let mounted = false

/** SDK 入口：渲染 React 元素到胶囊（状态更新后 React 会自动增量 reconcile 并重新提交） */
export function render(element: ReactNode): void {
  if (!mounted) {
    // react-reconciler 要求先 createContainer 再 updateContainer（Ink 同款用法）
    root = reconciler.createContainer(
      container,
      1, // ConcurrentRoot（0 = LegacyRoot，0.34 实际忽略 tag）
      null, // hydrationCallbacks
      false, // isStrictMode
      null, // concurrentUpdatesByDefaultOverride
      'leaf-sdk', // identifierPrefix
      (error: Error) => console.error('[leaf-sdk] uncaught:', error.message),
      (error: Error) => console.error('[leaf-sdk] caught:', error.message),
      (error: Error) => console.warn('[leaf-sdk] recoverable:', error.message),
      null // onDefaultTransitionIndicator
    )
    mounted = true
  }
  reconciler.updateContainer(element, root, null, () => {})
}

/** 供测试/调试判断是否已挂载 */
export function isMounted(): boolean {
  return mounted
}
