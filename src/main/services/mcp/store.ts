/**
 * Frond · MCP 服务器配置与 IPC（P-4②）
 *
 * 配置存在 pref_preferences('mcp.servers')。这份配置是**在本机执行命令的清单**，
 * 所以清洗从严、且渲染端只能按 id 操作已存配置：
 * IPC 的 setServers 虽接受完整配置（设置页表单链路如此），但 spawn 前有差分
 * 确认闸兜底——配置自上次用户确认（mcp.confirmedServers）后有变动时，连接弹
 * 系统级模态列出差分，拒绝即不启动任何进程（B40，纯逻辑见 mcpConfirm.ts）。
 */
import { prefRepository } from '../../db/repos'
import { typedHandle } from '../../ipc/typedIpc'
import { callToolOnServer, connectServer, serverViews, stopServer, stopAllServers } from './client'
import { coerceToolArgs, toolArgSpecs, type McpTool } from './protocol'
import { confirmMcpConfigChange, diffServers, serversHash } from './mcpConfirm'
import type { McpCallResult, McpServerView, McpStatus } from './client'
import type { McpToolArg, McpToolCommand } from '../../../shared/mcp'

const MCP_PREF_KEY = 'mcp.servers'
/** 工具清单缓存（P-4②「工具进根搜索」）：见下方 readToolCache 的理由 */
const TOOL_CACHE_PREF_KEY = 'mcp.toolCache'
const MAX_SERVERS = 12
const MAX_ARGS = 32
/** 进命令表的工具总数上限：一个服务器动辄上百个工具，胶囊不是工具目录 */
const MAX_TOOL_COMMANDS = 200
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/

export type { McpServerConfig } from './types'
import type { McpServerConfig } from './types'
import { log } from '../LogService'

/** 返回给渲染端的配置形态 */
export type McpServerPublic = Omit<McpServerConfig, 'env'> & { envKeys: string[] }

/**
 * 命令表监听（P-2④ 之前先补上的一格）：在设置页连上服务器 / 改了配置之后，
 * 胶囊里的工具行要**立刻**跟着变，而不是「收起再唤起才有」。
 * 与插件表那条推送同一个道理；用回调注入而不是让 service 去 import 启动器窗口模块。
 */
let onTableChanged: (() => void) | null = null

export function setMcpTableChangedListener(fn: () => void): void {
  onTableChanged = fn
}

function notifyTableChanged(): void {
  try {
    onTableChanged?.()
  } catch (e) {
    // 批 7b 空 catch 清账（原注释：推送失败不该让保存/连接本身变成失败：界面下一次唤起照样会重拉）
    log.debug('store', '推送失败不该让保存/连接本身变成失败：界面下一次唤起照样会重拉', e)
  }
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/**
 * 清洗外部输入的配置数组（纯函数）：非法条目逐条剔除，不整体失败。
 * 剔除原因不静默：返回值里带上，界面直接显示「第 N 条被拒：原因」。
 */
export function sanitizeMcpServers(raw: unknown): {
  servers: McpServerConfig[]
  rejected: Array<{ index: number; reason: string }>
} {
  const servers: McpServerConfig[] = []
  const rejected: Array<{ index: number; reason: string }> = []
  if (!Array.isArray(raw)) return { servers, rejected: [{ index: -1, reason: '不是数组' }] }
  const seen = new Set<string>()
  raw.forEach((item, index) => {
    if (servers.length >= MAX_SERVERS) {
      rejected.push({ index, reason: `超过 ${MAX_SERVERS} 个上限` })
      return
    }
    if (!item || typeof item !== 'object') {
      rejected.push({ index, reason: '不是对象' })
      return
    }
    const e = item as Record<string, unknown>
    const id = str(e.id, 32).toLowerCase()
    if (!ID_RE.test(id)) {
      rejected.push({ index, reason: 'id 非法（小写字母数字-_，1-32 位）' })
      return
    }
    if (seen.has(id)) {
      rejected.push({ index, reason: `id 重复：${id}` })
      return
    }
    const command = str(e.command, 400)
    if (!command) {
      rejected.push({ index, reason: 'command 为空' })
      return
    }
    if (/[\n\r]/.test(command) || command.includes(' ')) {
      // 带空格/换行的 command 十有八九是把「命令 + 参数」整串塞进了 command 字段：
      // 我们不开 shell，那样只会变成一个找不到的可执行文件名，与其静默失败不如拒收并说明
      rejected.push({ index, reason: 'command 只能是可执行文件本身，参数放 args' })
      return
    }
    const args = (Array.isArray(e.args) ? e.args : [])
      .map((a) => (typeof a === 'string' ? a.slice(0, 400) : ''))
      .filter((a) => a !== '')
      .slice(0, MAX_ARGS)
    const env: Record<string, string> = {}
    if (e.env && typeof e.env === 'object' && !Array.isArray(e.env)) {
      for (const [k, v] of Object.entries(e.env as Record<string, unknown>)) {
        if (Object.keys(env).length >= 16) break
        if (typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k))
          env[k] = v.slice(0, 2000)
      }
    }
    seen.add(id)
    servers.push({
      id,
      label: str(e.label, 60) || id,
      command,
      args,
      env,
      enabled: e.enabled !== false
    })
  })
  return { servers, rejected }
}

export function readMcpServers(): McpServerConfig[] {
  const raw = prefRepository.get(MCP_PREF_KEY)
  if (!raw) return []
  try {
    return sanitizeMcpServers(JSON.parse(raw)).servers
  } catch {
    return []
  }
}

export function writeMcpServers(list: McpServerConfig[]): void {
  prefRepository.set(MCP_PREF_KEY, JSON.stringify(list))
}

/** 上次用户在系统模态里确认过的配置快照（B40 差分确认的对照基准） */
const CONFIRMED_PREF_KEY = 'mcp.confirmedServers'

export function readConfirmedMcpServers(): McpServerConfig[] {
  const raw = prefRepository.get(CONFIRMED_PREF_KEY)
  if (!raw) return []
  try {
    return sanitizeMcpServers(JSON.parse(raw)).servers
  } catch {
    return []
  }
}

export function writeConfirmedMcpServers(list: McpServerConfig[]): void {
  prefRepository.set(CONFIRMED_PREF_KEY, JSON.stringify(list))
}

export function toPublic(cfg: McpServerConfig): McpServerPublic {
  const { env, ...rest } = cfg
  return { ...rest, envKeys: Object.keys(env) }
}

export interface McpOverview {
  servers: Array<
    McpServerPublic & {
      status: McpStatus
      tools: McpToolSummary[]
      skipped: number
      error?: string | undefined
      serverName?: string | undefined
    }
  >
  rejected: Array<{ index: number; reason: string }>
}

export interface McpToolSummary {
  name: string
  description: string
  required: string[]
}

/** 会话视图 + 配置（可缺省：残留会话没有配置）→ 渲染端一行 */
function summarize(view: McpServerView, cfg?: McpServerConfig): McpOverview['servers'][number] {
  const base: McpServerPublic = cfg
    ? toPublic(cfg)
    : { id: view.id, label: view.label, command: '', args: [], enabled: false, envKeys: [] }
  return {
    ...base,
    status: view.status,
    tools: view.tools.map((t) => ({
      name: t.name,
      description: t.description,
      required: requiredOf(t.inputSchema)
    })),
    skipped: view.skipped,
    error: view.error,
    serverName: view.serverName
  }
}

function requiredOf(schema: Record<string, unknown> | undefined): string[] {
  const req = schema?.required
  return Array.isArray(req)
    ? req.filter((x): x is string => typeof x === 'string').slice(0, 16)
    : []
}

/** 汇总视图：配置顺序在前，未配置的残留会话在后 */
export function mcpOverview(): McpOverview {
  const configs = readMcpServers()
  const views = new Map(
    serverViews(configs.map((c) => ({ id: c.id, label: c.label }))).map((v) => [v.id, v])
  )
  const servers = configs.map((c) =>
    summarize(views.get(c.id) ?? { ...emptyView(c.id), label: c.label }, c)
  )
  const extras = [...views.keys()]
    .filter((id) => !configs.some((c) => c.id === id))
    .map((id) => summarize(views.get(id) ?? emptyView(id)))
  return { servers: [...servers, ...extras], rejected: [] }
}

function emptyView(id: string): McpServerView {
  return { id, label: id, status: 'stopped', tools: [], skipped: 0 }
}

/**
 * 保存配置。
 *
 * env 有一条容易踩的规则：渲染端读到的配置里**没有 env 值**（可能装着 token），
 * 所以界面回传的 JSON 通常不含 env——这时要沿用本机原值，
 * 否则「改个 label」就把凭据洗掉了。只有显式带 env 字段才替换。
 */
export function saveMcpServers(raw: unknown): {
  servers: McpServerPublic[]
  rejected: Array<{ index: number; reason: string }>
} {
  const { servers, rejected } = sanitizeMcpServers(raw)
  const previous = new Map(readMcpServers().map((s) => [s.id, s.env]))
  const providedHasEnv = new Set(
    Array.isArray(raw)
      ? raw
          .filter(
            (x): x is Record<string, unknown> =>
              !!x && typeof x === 'object' && 'env' in (x as object)
          )
          .map((x) =>
            (typeof (x as { id?: unknown }).id === 'string'
              ? (x as { id: string }).id
              : ''
            ).toLowerCase()
          )
      : []
  )
  for (const s of servers) {
    if (!providedHasEnv.has(s.id) && Object.keys(s.env).length === 0) {
      s.env = { ...(previous.get(s.id) ?? {}) }
    }
  }
  writeMcpServers(servers)
  // 配置一改，原来连着的会话全部停用：新列表里没有的 id 更不能留进程
  stopAllServers()
  pruneToolCache()
  notifyTableChanged()
  return { servers: servers.map(toPublic), rejected }
}

/** 只按已存配置的 id 连接：渲染端递不进 command */
export async function connectById(id: string): Promise<McpServerView> {
  const all = readMcpServers()
  const cfg = all.find((s) => s.id === id)
  if (!cfg) return { ...emptyView(id), status: 'error', error: '配置里没有这个服务器' }
  if (!cfg.enabled)
    return { ...emptyView(cfg.id), label: cfg.label, status: 'error', error: '该服务器已停用' }
  // B40 差分确认：配置自上次用户确认后有变动（或从未确认过）时，spawn 前弹
  // 系统模态列出差分；拒绝则不启动任何进程。E2E 旁路与 pluginConfirm 同口径
  const confirmed = readConfirmedMcpServers()
  if (process.env.FROND_E2E !== '1' && serversHash(all) !== serversHash(confirmed)) {
    const allowed = await confirmMcpConfigChange(diffServers(all, confirmed))
    if (!allowed) {
      return {
        ...emptyView(cfg.id),
        label: cfg.label,
        status: 'error',
        error: 'MCP 配置变更未确认，已拒绝连接（重新连接可在弹窗中允许）'
      }
    }
    writeConfirmedMcpServers(all)
  }
  const view = await connectServer({
    id: cfg.id,
    command: cfg.command,
    args: cfg.args,
    env: cfg.env
  })
  if (view.status === 'ready') {
    cacheTools(cfg, view.tools)
    // 工具清单是这一次连接才落进缓存的：不推一下，命令表要等到下次唤起才看得到
    notifyTableChanged()
  }
  return view
}

/* ── 工具清单缓存（P-4②「工具进根搜索」）───────────────────────────────────
 * 为什么要有这份缓存：连接是**用户在设置页点一下**才发生的，而搜索框每次唤起都要列命令。
 * 没有缓存只有两条路，两条都不能接受——① 开胶囊就 spawn 全部已启用的服务器
 * （每个都是一条常驻子进程，代价与「用户没打算用 MCP」完全不匹配）；
 * ② 只显示当前连着的（那多数时候搜索框里一个工具都没有，等于没做）。
 * 所以：**连上时把 tools/list 落到 pref，命令表读缓存，回车那一刻才按需真连接**。
 * 缓存只用于展示与排参数格，执行前一定按**活会话**的工具表再校验一遍（见 runMcpTool）。
 */

interface CachedTool {
  name: string
  description: string
  args: McpToolArg[]
  droppedArgs: number
}
type ToolCache = Record<string, { label: string; cachedAt: number; tools: CachedTool[] }>

function readToolCache(): ToolCache {
  const raw = prefRepository.get(TOOL_CACHE_PREF_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: ToolCache = {}
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!ID_RE.test(id) || !v || typeof v !== 'object') continue
      const e = v as { label?: unknown; cachedAt?: unknown; tools?: unknown }
      if (!Array.isArray(e.tools)) continue
      out[id] = {
        label: typeof e.label === 'string' ? e.label.slice(0, 60) : id,
        cachedAt: typeof e.cachedAt === 'number' ? e.cachedAt : 0,
        tools: e.tools
          .slice(0, 100)
          .map(cacheTool)
          .filter((t): t is CachedTool => !!t)
      }
    }
    return out
  } catch {
    return {}
  }
}

/** 逐条清洗缓存里的一条工具（缓存是**我们自己**写进去的，但存储层不是可信边界） */
function cacheTool(raw: unknown): CachedTool | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as { name?: unknown; description?: unknown; args?: unknown; droppedArgs?: unknown }
  if (typeof t.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(t.name)) return null
  const args = Array.isArray(t.args)
    ? t.args
        .map((a): McpToolArg | null => {
          if (!a || typeof a !== 'object') return null
          const s = a as {
            name?: unknown
            type?: unknown
            description?: unknown
            required?: unknown
          }
          if (typeof s.name !== 'string' || !s.name) return null
          if (
            s.type !== 'string' &&
            s.type !== 'number' &&
            s.type !== 'integer' &&
            s.type !== 'boolean'
          )
            return null
          return {
            name: s.name.slice(0, 64),
            type: s.type,
            description: typeof s.description === 'string' ? s.description.slice(0, 200) : '',
            required: s.required === true
          }
        })
        .filter((x): x is McpToolArg => !!x)
        .slice(0, 6)
    : []
  return {
    name: t.name,
    description: typeof t.description === 'string' ? t.description.slice(0, 300) : '',
    args,
    droppedArgs: typeof t.droppedArgs === 'number' ? Math.max(0, Math.floor(t.droppedArgs)) : 0
  }
}

function writeToolCache(cache: ToolCache): void {
  prefRepository.set(TOOL_CACHE_PREF_KEY, JSON.stringify(cache))
}

/** 连接成功后落缓存；tools 是那份**未裁剪**的协议结果，这里就地算参数表 */
export function cacheTools(cfg: { id: string; label: string }, tools: McpTool[]): void {
  const cache = readToolCache()
  cache[cfg.id] = {
    label: cfg.label.slice(0, 60),
    cachedAt: Date.now(),
    tools: tools.slice(0, 100).map((t) => {
      const { args, dropped } = toolArgSpecs(t.inputSchema)
      return { name: t.name, description: t.description.slice(0, 300), args, droppedArgs: dropped }
    })
  }
  writeToolCache(cache)
}

/** 缓存跟着配置走：配置里没了的 id，缓存与进程一起清 */
function pruneToolCache(): void {
  const ids = new Set(readMcpServers().map((s) => s.id))
  const cache = readToolCache()
  const kept: ToolCache = {}
  for (const [id, v] of Object.entries(cache)) if (ids.has(id)) kept[id] = v
  writeToolCache(kept)
}

/**
 * 命令表：缓存里、且服务器**处于启用状态**的那些工具。
 * 停用的一律不出（搜索框里摆一条回车必失败的行是噪音，不是功能）。
 */
/** 单测用的读缓存出口：断言「缓存里到底剩了谁」，不去猜 pref 的序列化形状 */
export function readToolCacheForTest(): Record<string, unknown> {
  return readToolCache()
}

export function mcpToolCommands(): McpToolCommand[] {
  const enabled = new Map(readMcpServers().map((s) => [s.id, s]))
  const out: McpToolCommand[] = []
  for (const [id, entry] of Object.entries(readToolCache())) {
    const cfg = enabled.get(id)
    if (!cfg || !cfg.enabled) continue
    for (const t of entry.tools) {
      if (out.length >= MAX_TOOL_COMMANDS) break
      out.push({
        serverId: id,
        serverLabel: cfg.label || entry.label,
        tool: t.name,
        description: t.description,
        args: t.args,
        droppedArgs: t.droppedArgs
      })
    }
  }
  return out
}

/**
 * 从搜索框跑一个工具：认 id + 工具名，别的都不认。
 *
 * 两条门槛：
 * - 没连着就先连（**回车那一刻**才 spawn，而不是每次唤起胶囊）；
 * - 工具名必须出现在**活会话**的工具表里才发出去——缓存可能已经过期（服务器改了工具名），
 *   按缓存放行就等于让渲染端拿任意字符串去调 tools/call。
 * 参数按活会话那份 schema 定型（coerceToolArgs 只认 schema 里列出的键，多余的键丢掉）。
 */
export async function runMcpTool(
  id: string,
  tool: string,
  args: Record<string, string>
): Promise<McpCallResult> {
  const fail = (error: string): McpCallResult => ({ ok: false, text: '', ignoredContent: 0, error })
  const cfg = readMcpServers().find((s) => s.id === id)
  if (!cfg) return fail('配置里没有这个服务器')
  if (!cfg.enabled) return fail('该服务器已停用')
  let view = serverViews([{ id: cfg.id, label: cfg.label }]).find((v) => v.id === id)
  if (!view || view.status !== 'ready') view = await connectById(id)
  if (!view || view.status !== 'ready') return fail(view?.error ?? '连接失败')
  const live = view.tools.find((t) => t.name === tool)
  if (!live) return fail(`服务器上没有工具「${tool}」（可能已改名），去 MCP 设置页重连一次`)
  return callToolOnServer(id, tool, coerceToolArgs(toolArgSpecs(live.inputSchema).args, args ?? {}))
}

// 连接成功 / 服务器清单变化都要广播命令表变更（source='mcp'），渲染端据此只重拉
// MCP 那一路。此前全仓没有任何 'mcp' 推送 —— 「设置页连上服务器，回到搜索框搜不到
// 工具」修了又犯（LauncherApp 的推送处理器注释里就写着这段历史）。
// 动态 import：launcher/ipc 顶层有 electron 的具名导入，静态引入会把它带进
// 不 mock electron 的单测环境（Named export not found）。
async function notifyMcpTableChanged(): Promise<void> {
  const m = await import('../../launcher/ipc')
  m.notifyCommandTableChanged('mcp')
}

export function registerMcpIpc(): void {
  typedHandle('mcp:overview', () => mcpOverview())
  typedHandle('mcp:setServers', (_e, { servers }) => {
    const res = saveMcpServers(servers)
    void notifyMcpTableChanged()
    return res
  })
  typedHandle('mcp:connect', async (_e, { id }) => {
    const view = await connectById(String(id ?? ''))
    if (view.status === 'ready') void notifyMcpTableChanged()
    return view
  })
  typedHandle('mcp:stop', (_e, { id }) => {
    stopServer(String(id ?? ''))
    return true
  })
  typedHandle('mcp:callTool', (_e, { id, tool, args }) =>
    callToolOnServer(
      String(id ?? ''),
      String(tool ?? ''),
      args && typeof args === 'object' ? args : {}
    )
  )
  typedHandle('mcp:toolCommands', () => mcpToolCommands())
  typedHandle('mcp:runTool', (_e, { id, tool, args }) =>
    runMcpTool(String(id ?? ''), String(tool ?? ''), args && typeof args === 'object' ? args : {})
  )
}

export { stopAllServers as stopAllMcpServers }
