/**
 * Leaf · 搜索框内联参数槽（P-1.6b）
 *
 * Raycast 的行内补全：选中一条带参数的命令后，命令本身变成一颗不可编辑的 chip，
 * 参数一格一格排在后面，光标落在第一格，←/→ 换格，↵ 直接执行——
 * 不用先跳一页表单再填。本文件只管**该不该走内联、几格、缺了什么**这些判定，
 * DOM 与键盘都留在组件里（判定能被单测钉住，界面不能）。
 *
 * 一条刻意保守的规则：只有「≤2 格且都是文本/密码」才走内联。
 * dropdown 要候选列表、第 3 格起一屏放不下，这两种仍然进 FormPage——
 * 内联条不是把所有表单塞进搜索框，那是把易用性换成炫。
 */
import { quicklinkFieldNames, type CommandEntry } from './commands'
import type { McpToolArg } from './mcp'
import type { PluginArgument } from './plugin-protocol'

/** 一屏内联得下的最大格数；超了进 FormPage */
export const MAX_INLINE_SLOTS = 2

export interface ArgSlot {
  /** 提交时的 key（插件 args 的字段名 / Quicklink 的 {占位符}） */
  id: string
  /** 格子里的占位文案 */
  label: string
  /** 密码格（显示为掩码） */
  secret: boolean
  required: boolean
}

export type ArgLayout =
  /** 这条命令不接参数 */
  | { kind: 'none' }
  /** 在搜索框里内联填 */
  | { kind: 'inline'; slots: ArgSlot[] }
  /** 交给 FormPage（参数多、或有 dropdown） */
  | { kind: 'form'; reason: 'too-many' | 'dropdown' }

function pluginLayout(args: PluginArgument[]): ArgLayout {
  const list = args.filter((a) => typeof a?.name === 'string' && a.name.trim() !== '')
  if (list.length === 0) return { kind: 'none' }
  if (list.some((a) => a.type === 'dropdown')) return { kind: 'form', reason: 'dropdown' }
  if (list.length > MAX_INLINE_SLOTS) return { kind: 'form', reason: 'too-many' }
  return {
    kind: 'inline',
    slots: list.map((a) => ({
      id: String(a.name),
      label: (a.placeholder ?? '').trim() || String(a.name),
      secret: a.type === 'password',
      required: a.required === true
    }))
  }
}

/**
 * Quicklink：要填的格子 = `quicklinkFieldNames`（`{query}` 也算一格，加上命名占位符）。
 * 旧实现只数命名占位符，于是混合形态 `…/{query}?ref={org}` 只收 `org`，
 * 拼出来的地址里留着 `{query}` 字面量——参数收齐了却是坏链接。
 */
function quicklinkLayout(url: string): ArgLayout {
  const names = quicklinkFieldNames(url)
  if (names.length === 0) return { kind: 'none' }
  if (names.length > MAX_INLINE_SLOTS) return { kind: 'form', reason: 'too-many' }
  return {
    kind: 'inline',
    // URL 里缺了任何一个占位符都拼不出可用地址，所以 Quicklink 的参数一律必填
    slots: names.map((n) => ({
      id: n,
      // {query} 在 qlarg 表单里就叫「参数」，内联格子沿用同一个名字（两处两套叫法是白送的困惑）
      label: n === 'query' ? '参数' : n,
      secret: false,
      required: true
    }))
  }
}

/**
 * MCP 工具：格子的文案直接用 schema 里的 description（服务器写的，比我们再翻一层准）。
 *
 * 与插件那条的差别只有一个门槛的**方向**：插件没有 description 就没有占位，
 * MCP 的 description 是可选的、经常缺省，所以退回参数名。
 * 上限仍是两格——第 3 格起进 `mcparg` 表单（表单能显示「另有 N 个参数不支持」，内联格不行）。
 */
function mcpLayout(args: McpToolArg[]): ArgLayout {
  const list = args.filter((a) => typeof a?.name === 'string' && a.name.trim() !== '')
  if (list.length === 0) return { kind: 'none' }
  if (list.length > MAX_INLINE_SLOTS) return { kind: 'form', reason: 'too-many' }
  return {
    kind: 'inline',
    slots: list.map((a) => ({
      id: a.name,
      label: a.description || a.name,
      secret: false,
      required: a.required === true
    }))
  }
}

export function argLayoutOf(entry: CommandEntry): ArgLayout {
  const a = entry?.action
  if (!a) return { kind: 'none' }
  if (a.type === 'plugin') return pluginLayout(a.arguments ?? [])
  if (a.type === 'mcpTool') return mcpLayout(a.args ?? [])
  if (a.type === 'quicklink') return quicklinkLayout(String(a.url ?? ''))
  return { kind: 'none' }
}

/**
 * 初值：把「命令标题之外的尾巴」填进**第一个非密码格**（与 FormPage 那条预填同一规矩，
 * 不猜第二格；剩下的让用户 ←/→ 过去）。
 */
export function prefillSlots(slots: ArgSlot[], tail: string): string[] {
  const values = slots.map(() => '')
  const t = tail.trim()
  if (!t) return values
  const first = slots.findIndex((s) => !s.secret)
  if (first < 0) return values
  values[first] = t
  return values
}

/** 缺哪个必填格（返回槽位下标；界面上要高亮的就是这些格） */
export function missingRequiredIndexes(slots: ArgSlot[], values: string[]): number[] {
  const out: number[] = []
  slots.forEach((s, i) => {
    if (s.required && !(values[i] ?? '').trim()) out.push(i)
  })
  return out
}

/** ←/→ 换格：夹在两端，不绕圈（绕圈会让人找不到光标在哪） */
export function moveSlot(index: number, delta: number, count: number): number {
  if (count <= 0) return index
  return Math.min(count - 1, Math.max(0, index + delta))
}

/**
 * 退格能否退出参数模式：只有光标在第一格、且那一格已经空了。
 * 否则用户就是在删自己刚打的字。
 */
export function backspaceExits(index: number, value: string): boolean {
  return index === 0 && value.length === 0
}

/**
 * 提交给插件 / Quicklink 的 values：只带非空格子。
 * 必填格没在调用方检查过就别用这个函数提交（`missingRequiredIndexes` 那条路）。
 */
export function slotArgs(slots: ArgSlot[], values: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  slots.forEach((s, i) => {
    const v = values[i] ?? ''
    if (v !== '') out[s.id] = v
  })
  return out
}
