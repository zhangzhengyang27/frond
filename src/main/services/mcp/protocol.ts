/**
 * Leaf · MCP 客户端的协议层（P-4②，纯函数）
 *
 * 只覆盖本产品的最小面：stdio 传输上的换行分隔 JSON-RPC 2.0，
 * 三个方法（initialize / tools/list / tools/call）加一个 notifications/initialized。
 * 不实现 resources / prompts / sampling / 进度通知——那些要等真需求。
 *
 * 与仓库其它层一致的口径：
 * - **来路不明的数据一律当外部输入**：帧长度有上限（服务器狂吐不能把主进程撑爆）、
 *   工具名不合法就丢掉那一条并回报数量，界面上说「N 个已忽略」而不是静默少几个；
 * - 不猜语义：响应形态不认识就是不认识，不当成空列表蒙混过去。
 */

import type { McpArgType, McpToolArg } from '../../../shared/mcp'

import type { McpArgType, McpToolArg } from '../../../shared/mcp'

/** 我们声称支持的协议版本（服务器回什么就记什么，不做兼容层） */
export const MCP_PROTOCOL_VERSION = '2025-06-18'
/** 单帧上限：正常工具清单远小于此，超限即判定流已坏 */
export const MAX_FRAME_BYTES = 4 * 1024 * 1024
/** 工具数量与文案的展示上限（与插件协议里的 100/300 同思路：给渲染端一个能承受的数） */
export const MAX_TOOLS_PER_SERVER = 100
const MAX_TEXT_LEN = 8 * 1024

export interface McpTool {
  name: string
  description: string
  /** 原样保留：界面只展示「要哪些参数」，不替服务器猜默认值 */
  inputSchema: Record<string, unknown>
}

/** 合法工具名：可读、可当命令 key 的片段用，不给 shell/路径留花样 */
const TOOL_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/

export function encodeMessage(msg: unknown): string {
  return `${JSON.stringify(msg)}
`
}

export function rpcRequest(id: number, method: string, params?: unknown): object {
  return { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) }
}

export function initializeRequest(id: number, clientName = 'leaf-launcher'): object {
  return rpcRequest(id, 'initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: clientName, version: '1.0' }
  })
}

export function initializedNotification(): object {
  return { jsonrpc: '2.0', method: 'notifications/initialized' }
}

export function toolsListRequest(id: number): object {
  return rpcRequest(id, 'tools/list', {})
}

export function toolCallRequest(id: number, name: string, args: Record<string, unknown>): object {
  return rpcRequest(id, 'tools/call', { name, arguments: args })
}

/**
 * 换行分帧器：stdout 可能半截到达，也可能一次多帧。
 * 返回本次可交付的完整帧；超上限或残留过长时给出 fatal 错误，调用方据此杀进程。
 */
export function createFrameParser(): {
  push: (chunk: string) => { frames: string[]; error: string | null }
  reset: () => void
} {
  let buf = ''
  return {
    /** @returns 完整帧（已 JSON.parse 失败的原样返回文本由调用方判）与致命错误 */
    push(chunk: string): { frames: string[]; error: string | null } {
      buf += chunk
      const frames: string[] = []
      for (;;) {
        const nl = buf.indexOf('\n')
        if (nl === -1) break
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (line.trim() === '') continue
        if (Buffer.byteLength(line, 'utf-8') > MAX_FRAME_BYTES) {
          return { frames, error: `单帧超过 ${MAX_FRAME_BYTES / 1024 / 1024}MB 上限` }
        }
        frames.push(line)
      }
      if (Buffer.byteLength(buf, 'utf-8') > MAX_FRAME_BYTES) {
        return { frames, error: `未闭合的帧超过 ${MAX_FRAME_BYTES / 1024 / 1024}MB 上限` }
      }
      return { frames, error: null }
    },
    reset(): void {
      buf = ''
    }
  }
}

/** initialize 响应 → 服务器信息（不认识的结构返回 null，不猜） */
export function parseInitializeResult(raw: unknown): {
  protocolVersion: string
  serverName: string
} | null {
  if (!raw || typeof raw !== 'object') return null
  const msg = raw as { result?: { protocolVersion?: unknown; serverInfo?: { name?: unknown } } }
  const r = msg.result
  if (!r || typeof r !== 'object') return null
  if (typeof r.protocolVersion !== 'string') return null
  const name =
    r.serverInfo && typeof r.serverInfo.name === 'string' ? r.serverInfo.name : '(未命名)'
  return { protocolVersion: r.protocolVersion.slice(0, 40), serverName: name.slice(0, 80) }
}

/**
 * tools/list 响应 → 工具表。
 * 非法条目**逐条剔除**并回报数量（静默少几个是最难查的表现）。
 */
export function parseToolList(raw: unknown): { tools: McpTool[]; skipped: number } {
  const empty = { tools: [] as McpTool[], skipped: 0 }
  if (!raw || typeof raw !== 'object') return { ...empty }
  const list = (raw as { result?: { tools?: unknown } }).result?.tools
  if (!Array.isArray(list)) return { ...empty }
  const tools: McpTool[] = []
  let skipped = 0
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      skipped++
      continue
    }
    const t = item as { name?: unknown; description?: unknown; inputSchema?: unknown }
    if (typeof t.name !== 'string' || !TOOL_NAME.test(t.name)) {
      skipped++
      continue
    }
    if (tools.length >= MAX_TOOLS_PER_SERVER) {
      skipped++
      continue
    }
    const schema =
      t.inputSchema && typeof t.inputSchema === 'object' && !Array.isArray(t.inputSchema)
        ? (t.inputSchema as Record<string, unknown>)
        : {}
    tools.push({
      name: t.name,
      description: typeof t.description === 'string' ? t.description.slice(0, MAX_TEXT_LEN) : '',
      inputSchema: schema
    })
  }
  return { tools, skipped }
}

/**
 * tools/call 响应 → 文本结果。
 * 只认 content[] 里 type:'text' 的部分（图片/资源本期不渲染，但**如实说明被忽略了几个**）；
 * isError 或非 JSON-RPC error 一律算失败并带上原因。
 */
export function parseToolCallResult(raw: unknown): {
  ok: boolean
  text: string
  ignoredContent: number
  error?: string
} {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, text: '', ignoredContent: 0, error: '响应不是对象' }
  }
  const msg = raw as {
    error?: { message?: unknown }
    result?: { content?: unknown; isError?: unknown }
  }
  if (msg.error) {
    const m = typeof msg.error.message === 'string' ? msg.error.message : '服务器返回错误'
    return { ok: false, text: '', ignoredContent: 0, error: m.slice(0, MAX_TEXT_LEN) }
  }
  const r = msg.result
  if (!r || typeof r !== 'object') {
    return { ok: false, text: '', ignoredContent: 0, error: '响应缺 result' }
  }
  const parts = Array.isArray(r.content) ? r.content : []
  const texts: string[] = []
  let ignored = 0
  for (const p of parts) {
    if (p && typeof p === 'object' && (p as { type?: unknown }).type === 'text') {
      const v = (p as { text?: unknown }).text
      if (typeof v === 'string') texts.push(v)
      else ignored++
    } else {
      ignored++
    }
  }
  const text = texts.join('\n').slice(0, MAX_TEXT_LEN * 4)
  const isError = r.isError === true
  return {
    ok: !isError,
    text,
    ignoredContent: ignored,
    error: isError ? text.slice(0, 400) || '服务器标记为失败' : undefined
  }
}

/** 从 inputSchema 里取必填参数名（界面提示用；解析不动就返回空） */
export function requiredArgNames(schema: Record<string, unknown> | undefined): string[] {
  if (!schema || typeof schema !== 'object') return []
  const req = (schema as { required?: unknown }).required
  if (!Array.isArray(req)) return []
  return req.filter((x): x is string => typeof x === 'string').slice(0, 16)
}

/** 一个工具最多排几格参数（再多就不是「顺手填一下」而是表单了，界面上也摆不下） */
export const MAX_ARGS_PER_TOOL = 6

/** 只认这四种标量：其余（array/object/enum/联合）填不出来，丢掉并计数 */
const SCALAR = new Set(['string', 'number', 'integer', 'boolean'])

/**
 * `inputSchema` → 能填的参数表（P-4②「工具进根搜索」的地基）。
 *
 * 只取**顶层 properties**里 type 是单个标量的那些：
 * - 嵌套对象/数组要的是编辑器不是搜索框里的一格，enum 要的是候选列表；
 * - `type` 写成数组（`['string','null']`）按不支持处理——猜哪个都有反例。
 * 丢掉的个数原样带回去（`droppedArgs`），界面说「另有 N 个参数不支持」而不是
 * 摆出一个提交上去必然被服务器拒的工具。
 * 顺序 = schema 里出现的顺序；必填的排前面（第一格预填时落在必填参数上）。
 */
export function toolArgSpecs(
  schema: Record<string, unknown> | undefined
): { args: McpToolArg[]; dropped: number } {
  const props = schema?.properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return { args: [], dropped: 0 }
  const required = new Set(requiredArgNames(schema))
  const args: McpToolArg[] = []
  let dropped = 0
  for (const [name, raw] of Object.entries(props)) {
    if (args.length >= MAX_ARGS_PER_TOOL) {
      dropped++
      continue
    }
    const type = (raw as { type?: unknown })?.type
    if (typeof type !== 'string' || !SCALAR.has(type)) {
      dropped++
      continue
    }
    const desc = (raw as { description?: unknown })?.description
    args.push({
      name,
      type: type as McpArgType,
      description: typeof desc === 'string' ? desc.trim().slice(0, 200) : '',
      required: required.has(name)
    })
  }
  // 必填的排前面：内联槽只有两格，第一格该是用户非填不可的那个
  args.sort((a, b) => Number(b.required) - Number(a.required))
  return { args, dropped }
}

/**
 * 界面交回来的字符串 → 服务器要的 JSON 值（用参数表定型）。
 *
 * 数字格填了「abc」时**不猜**：原样发过去让服务器报错，比本地静默丢掉一个参数好
 * （静默丢参数 = 工具按「没传这个参数」的语义跑了，用户看到的是错的结果）。
 * 空串 = 没填，整个键不发（必填与否由界面那关管）。
 */
export function coerceToolArgs(
  specs: McpToolArg[],
  raw: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of specs) {
    const v = raw[s.name]
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (t === '') continue
    if (s.type === 'boolean') {
      if (/^(true|1|yes|是)$/i.test(t)) out[s.name] = true
      else if (/^(false|0|no|否)$/i.test(t)) out[s.name] = false
      else out[s.name] = t // 认不出来的写法原样发，让服务器说
      continue
    }
    if (s.type === 'number' || s.type === 'integer') {
      const n = Number(t)
      if (Number.isFinite(n) && (s.type === 'number' || Number.isInteger(n))) {
        out[s.name] = n
        continue
      }
      out[s.name] = t
      continue
    }
    out[s.name] = v
  }
  return out
}


/** 一个工具最多排几格参数（再多就不是「顺手填一下」而是表单了，界面上也摆不下） */
export const MAX_ARGS_PER_TOOL = 6

/** 只认这四种标量：其余（array/object/enum/联合）填不出来，丢掉并计数 */
const SCALAR = new Set(['string', 'number', 'integer', 'boolean'])

/**
 * `inputSchema` → 能填的参数表（P-4②「工具进根搜索」的地基）。
 *
 * 只取**顶层 properties**里 type 是单个标量的那些：
 * - 嵌套对象/数组要的是编辑器不是搜索框里的一格，enum 要的是候选列表；
 * - `type` 写成数组（`['string','null']`）按不支持处理——猜哪个都有反例。
 * 丢掉的个数原样带回去（`droppedArgs`），界面说「另有 N 个参数不支持」而不是
 * 摆出一个提交上去必然被服务器拒的工具。
 * 顺序 = schema 里出现的顺序；必填的排前面（第一格预填时落在必填参数上）。
 */
export function toolArgSpecs(
  schema: Record<string, unknown> | undefined
): { args: McpToolArg[]; dropped: number } {
  const props = schema?.properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return { args: [], dropped: 0 }
  const required = new Set(requiredArgNames(schema))
  const args: McpToolArg[] = []
  let dropped = 0
  for (const [name, raw] of Object.entries(props)) {
    if (args.length >= MAX_ARGS_PER_TOOL) {
      dropped++
      continue
    }
    const type = (raw as { type?: unknown })?.type
    if (typeof type !== 'string' || !SCALAR.has(type)) {
      dropped++
      continue
    }
    const desc = (raw as { description?: unknown })?.description
    args.push({
      name,
      type: type as McpArgType,
      description: typeof desc === 'string' ? desc.trim().slice(0, 200) : '',
      required: required.has(name)
    })
  }
  // 必填的排前面：内联槽只有两格，第一格该是用户非填不可的那个
  args.sort((a, b) => Number(b.required) - Number(a.required))
  return { args, dropped }
}

/**
 * 界面交回来的字符串 → 服务器要的 JSON 值（用参数表定型）。
 *
 * 数字格填了「abc」时**不猜**：原样发过去让服务器报错，比本地静默丢掉一个参数好
 * （静默丢参数 = 工具按「没传这个参数」的语义跑了，用户看到的是错的结果）。
 * 空串 = 没填，整个键不发（必填与否由界面那关管）。
 */
export function coerceToolArgs(
  specs: McpToolArg[],
  raw: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of specs) {
    const v = raw[s.name]
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (t === '') continue
    if (s.type === 'boolean') {
      if (/^(true|1|yes|是)$/i.test(t)) out[s.name] = true
      else if (/^(false|0|no|否)$/i.test(t)) out[s.name] = false
      else out[s.name] = t // 认不出来的写法原样发，让服务器说
      continue
    }
    if (s.type === 'number' || s.type === 'integer') {
      const n = Number(t)
      if (Number.isFinite(n) && (s.type === 'number' || Number.isInteger(n))) {
        out[s.name] = n
        continue
      }
      out[s.name] = t
      continue
    }
    out[s.name] = v
  }
  return out
}

