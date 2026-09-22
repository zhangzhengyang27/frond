/**
 * Leaf · Automations 存储与引擎（P-4④）
 *
 * 引擎与「怎么执行」完全解耦（tick 收 deps 注入），所以调度判据能单测：
 * 时钟、执行器、持久化都可换。真跑起来用的是 setInterval 每 30s 一次，
 * 去重靠「同一分钟只跑一次」（lastFiredAt 落在同一分钟桶里就跳过），
 * 所以 tick 频率比 30s 粗也不会漏、比 1s 细也不会重复跑。
 */
import { prefRepository } from '../../db/repos'
import { log } from '../../services/LogService'
import { dispatchMainAction, type MainAction } from '../../launcher/actionHandlers'
import { runPrompt } from '../../services/AIService'
import { runPluginCommandDetached } from '../../launcher/runtime'
import { cronError, cronMatches, firesPerDay, parseCron } from './cron'
import { typedHandle } from '../../ipc/typedIpc'
import { PLUGIN_MAX_ARGUMENTS } from '../../../shared/plugin-protocol'
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_ID_MAX,
  AUTOMATION_MAX_FIRES_PER_DAY,
  MAX_AUTOMATION_TASKS,
  MAX_AUTOMATION_TASKS_PER_PLUGIN,
  ownerPluginId,
  type AutomationAction,
  type AutomationOwner,
  type AutomationTask,
  type AutomationTaskView
} from '../../../shared/automation'

const PREF_KEY = 'automation.tasks'
const TICK_MS = 30_000
const MINUTE_MS = 60_000

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** 动作清洗（纯函数）：认不出的形态返回 null，调用方剔除并说明 */
export function sanitizeAction(raw: unknown): AutomationAction | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  if (typeof a.type !== 'string' || !AUTOMATION_ACTION_TYPES.includes(a.type as never)) return null
  switch (a.type) {
    case 'ai': {
      const prompt = str(a.prompt, 4000)
      return prompt ? { type: 'ai', prompt } : null
    }
    case 'copyText': {
      const text = typeof a.text === 'string' ? a.text.slice(0, 20_000) : ''
      return text ? { type: 'copyText', text } : null
    }
    case 'openUrl': {
      const url = str(a.url, 2000)
      // 无人值守时只放 http(s)：其它协议（file:// 之类）在这里没有正当用途
      if (!/^https?:\/\//i.test(url)) return null
      return { type: 'openUrl', url }
    }
    case 'app': {
      const path = str(a.path, 1000)
      // 只收绝对路径：主进程执行端那边还有 safeOpenablePath 一道闸
      if (!path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(path)) return null
      return { type: 'app', path }
    }
    case 'system': {
      const cmdId = str(a.cmdId, 80)
      return /^[A-Za-z0-9._:-]+$/.test(cmdId) ? { type: 'system', cmdId } : null
    }
    case 'plugin': {
      // 只取「跑哪个命令 + 参数」；pluginId 不在 action 里，来自任务的 owner——
      // 否则用户在设置页的 JSON 里写个别人的插件 id 就能替那个插件触发命令
      const cmd = str(a.cmd, 64)
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(cmd)) return null
      const raw =
        a.arguments && typeof a.arguments === 'object' && !Array.isArray(a.arguments)
          ? (a.arguments as Record<string, unknown>)
          : {}
      const args: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) {
        // 条数与 manifest 的 arguments 上限一致（插件能声明的参数就那么多，多的是垃圾）
        if (Object.keys(args).length >= PLUGIN_MAX_ARGUMENTS) break
        if (typeof k !== 'string' || !k || typeof v !== 'string') continue
        args[k.slice(0, 64)] = v.slice(0, 2000)
      }
      return Object.keys(args).length ? { type: 'plugin', cmd, arguments: args } : { type: 'plugin', cmd }
    }
  }
  return null
}

/** 任务清洗（纯函数）：id 重复、条数超限、cron 写坏都会被拒并带回原因 */
export function sanitizeTasks(raw: unknown): {
  tasks: AutomationTask[]
  rejected: Array<{ index: number; reason: string }>
} {
  const tasks: AutomationTask[] = []
  const rejected: Array<{ index: number; reason: string }> = []
  if (!Array.isArray(raw)) return { tasks, rejected: [{ index: -1, reason: '不是数组' }] }
  const seen = new Set<string>()
  raw.forEach((item, index) => {
    if (tasks.length >= MAX_AUTOMATION_TASKS) {
      rejected.push({ index, reason: `超过 ${MAX_AUTOMATION_TASKS} 条上限` })
      return
    }
    if (!item || typeof item !== 'object') {
      rejected.push({ index, reason: '不是对象' })
      return
    }
    const e = item as Record<string, unknown>
    const id = str(e.id, 32)
    if (!id || seen.has(id)) {
      rejected.push({ index, reason: id ? `id 重复：${id}` : '缺 id' })
      return
    }
    const cron = str(e.cron, 80)
    if (!parseCron(cron)) {
      rejected.push({ index, reason: `cron 不合法：${cronError(cron) ?? cron}` })
      return
    }
    const action = sanitizeAction(e.action)
    if (!action) {
      rejected.push({ index, reason: 'action 不合法（类型未知或关键字段为空）' })
      return
    }
    const owner = str(e.owner, 80)
    const plugin = ownerPluginId(owner || undefined)
    if (owner && !plugin) {
      // owner 只认 `plugin:<id>` 这一种写法；认不出的一律拒，而不是默默当用户任务
      // （悄悄降级成「无主」= 谁也管不了它，卸载插件时也清不掉）
      rejected.push({ index, reason: `owner 形态不认识：${owner}` })
      return
    }
    if (action.type === 'plugin' && !plugin) {
      rejected.push({ index, reason: '插件命令任务必须由插件自己登记（owner 形如 plugin:<id>）' })
      return
    }
    if (plugin) {
      const mine = tasks.filter((t) => ownerPluginId(t.owner) === plugin).length
      if (mine >= MAX_AUTOMATION_TASKS_PER_PLUGIN) {
        rejected.push({ index, reason: `每个插件最多 ${MAX_AUTOMATION_TASKS_PER_PLUGIN} 条` })
        return
      }
      const spec = parseCron(cron)
      const perDay = spec ? firesPerDay(spec) : 0
      if (spec && perDay > AUTOMATION_MAX_FIRES_PER_DAY) {
        rejected.push({
          index,
          reason: `太密了：一天 ${perDay} 次，插件任务上限 ${AUTOMATION_MAX_FIRES_PER_DAY} 次（约每 15 分钟一次）`
        })
        return
      }
    }
    seen.add(id)
    tasks.push({
      id,
      label: str(e.label, 60) || id,
      cron,
      enabled: e.enabled !== false,
      action,
      ...(owner ? { owner } : {}),
      // 触发历史只由引擎写：外部回传的一律丢弃，避免「导入配置」伪造 lastFiredAt 抑制一次触发
      lastFiredAt: null,
      lastOk: null
    })
  })
  return { tasks, rejected }
}

/** 合并触发历史：界面向后端回写配置时不能把「上次跑到什么时候」洗掉 */
export function mergeRunHistory(next: AutomationTask[], previous: AutomationTask[]): AutomationTask[] {
  const byId = new Map(previous.map((t) => [t.id, t]))
  return next.map((t) => {
    const old = byId.get(t.id)
    if (!old || old.cron !== t.cron || JSON.stringify(old.action) !== JSON.stringify(t.action)) return t
    return {
      ...t,
      lastFiredAt: old.lastFiredAt,
      lastOk: old.lastOk,
      ...(old.lastError ? { lastError: old.lastError } : {})
    }
  })
}

export function readTasks(): AutomationTask[] {
  const raw = prefRepository.get(PREF_KEY)
  if (!raw) return []
  try {
    return sanitizeTasks(JSON.parse(raw)).tasks
  } catch {
    return []
  }
}

export function writeTasks(tasks: AutomationTask[]): void {
  prefRepository.set(PREF_KEY, JSON.stringify(tasks))
}

export function taskViews(): AutomationTaskView[] {
  return readTasks().map((t) => ({
    ...t,
    cronValid: !!parseCron(t.cron),
    ...(parseCron(t.cron) ? {} : { cronError: cronError(t.cron) ?? '不合法' })
  }))
}

/* ── 插件登记自己的定时任务（P-2③「生命周期外执行」）─────────────────────
 * 一个插件能做的只有三件事：看自己那几条、加一条、撤一条。四条闸都在这里，
 * 因为「谁登记的不该由它自己说」：
 *   - owner 由调用方（plugapi handler 按 sender 身份）给，不在插件传的对象里；
 *   - 条数上限 MAX_AUTOMATION_TASKS_PER_PLUGIN；
 *   - 频率下限（firesPerDay，见 cron.ts）；
 *   - **只能排 mode:'action' 的命令**（视图命令会在没人看着时弹出界面）。
 */

export interface PluginScheduleInput {
  label?: unknown
  cron?: unknown
  cmd?: unknown
  arguments?: unknown
}

/** 一个插件此刻已登记的任务（界面/插件都用这个形状） */
export function listPluginTasks(pluginId: string): AutomationTaskView[] {
  const owner: AutomationOwner = `plugin:${pluginId}`
  return taskViews().filter((t) => t.owner === owner)
}

/**
 * 决定能不能替某个插件加一条任务——**纯函数**，读写都在外面那层薄壳里。
 * 抽出来的理由与其它清洗一样：四条闸（总数、每插件数、mode:'action'、频率）判错一次
 * 就是「第三方代码在没人看的时候被唤得太勤」，这种判据必须能在毫秒级的单测里钉住。
 *
 * 返回的 `task` 是清洗过、可以直接落盘的那份；`error` 是给插件看的原话。
 */
export function planPluginTask(
  pluginId: string,
  input: PluginScheduleInput,
  existing: AutomationTask[],
  isHeadlessCmd: (cmd: string) => boolean
): { ok: true; task: AutomationTask } | { ok: false; error: string } {
  const owner = `plugin:${pluginId}`
  // 总闸先过：MAX_AUTOMATION_TASKS 那份额度是留给用户的，不能被一个插件占满，
  // 而 sanitizeTasks 只数它自己拿到的那一批
  if (existing.length >= MAX_AUTOMATION_TASKS) {
    return { ok: false, error: `定时任务总数已到上限 ${MAX_AUTOMATION_TASKS} 条` }
  }
  if (existing.filter((t) => t.owner === owner).length >= MAX_AUTOMATION_TASKS_PER_PLUGIN) {
    return { ok: false, error: `每个插件最多 ${MAX_AUTOMATION_TASKS_PER_PLUGIN} 条定时任务` }
  }
  const cmd = str(input.cmd, 64)
  if (!cmd) return { ok: false, error: '没写要跑哪条命令' }
  if (!isHeadlessCmd(cmd))
    return { ok: false, error: `只能排 mode:'action' 的命令：${cmd} 不是（或不存在）` }
  const cron = str(input.cron, 80)
  const spec = parseCron(cron)
  if (!spec) return { ok: false, error: `cron 不合法：${cronError(cron) ?? cron}` }
  const perDay = firesPerDay(spec)
  if (perDay > AUTOMATION_MAX_FIRES_PER_DAY) {
    return {
      ok: false,
      error: `太密了：一天 ${perDay} 次，上限 ${AUTOMATION_MAX_FIRES_PER_DAY} 次（约每 15 分钟一次）`
    }
  }
  const action = sanitizeAction({ type: 'plugin', cmd, arguments: input.arguments })
  if (!action || action.type !== 'plugin') return { ok: false, error: '参数形态不认识' }
  // id 由宿主生成（插件传什么都不认）：两条任务共享一个 id 的话，撤销会撤错那条。
  // 长度必须 ≤ AUTOMATION_ID_MAX——sanitizeTasks 会把超长的**截断**，那样这里以为唯一的
  // id 落盘后可能与别人撞上，所以插件 id 与时刻都压进 base36 而不是拼原文。
  const id = (
    's' +
    pluginId.slice(-6) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  ).slice(0, AUTOMATION_ID_MAX)
  const label = str(input.label, 60) || `插件任务 · ${cmd}`
  const { tasks: checked, rejected } = sanitizeTasks([
    { id, label, cron, enabled: true, action, owner }
  ])
  if (rejected.length > 0 || checked.length === 0) {
    return { ok: false, error: rejected[0]?.reason ?? '没存下' }
  }
  return { ok: true, task: checked[0] }
}

/**
 * 加一条。「已经有一条同样的」不算错误——插件重启时重复登记是常态，
 * 报错只会逼它先去查列表。返回带 id，插件之后才撤得掉。
 */
export function addPluginTask(
  pluginId: string,
  input: PluginScheduleInput,
  isHeadlessCmd: (cmd: string) => boolean
): { ok: boolean; id?: string; error?: string } {
  const tasks = readTasks()
  const plan = planPluginTask(pluginId, input, tasks, isHeadlessCmd)
  if (!plan.ok) return { ok: false, error: plan.error }
  writeTasks([...tasks, plan.task])
  return { ok: true, id: plan.task.id }
}

export function removePluginTask(pluginId: string, id: string): { ok: boolean; error?: string } {
  const owner = `plugin:${pluginId}`
  const tasks = readTasks()
  const target = tasks.find((t) => t.id === id)
  if (!target) return { ok: false, error: '没有这条任务' }
  // 只能撤自己的：id 是宿主生成的，但校验不能指望这个
  if (target.owner !== owner) return { ok: false, error: '这条任务不是本插件登记的' }
  writeTasks(tasks.filter((t) => t.id !== id))
  return { ok: true }
}

/** 卸载插件时清干净：留着的话下次装回来会看到不属于它的旧任务 */
export function removeTasksOwnedByPlugin(pluginId: string): number {
  const owner = `plugin:${pluginId}`
  const tasks = readTasks()
  const rest = tasks.filter((t) => t.owner !== owner)
  const removed = tasks.length - rest.length
  if (removed > 0) writeTasks(rest)
  return removed
}

/**
 * 把动作映射到主进程执行端。
 *
 * 'ai' 单独走（要落进会话而不是开关窗）；'plugin' 也单独走，而且**插件身份取自任务的
 * owner 而不是 action 里**——action 里没有 pluginId 这个字段，设置页那份 JSON 就伪造不出
 * 「以别的插件的名义跑它的命令」。
 */
async function executeAction(
  action: AutomationAction,
  pluginId: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (action.type === 'ai') {
    const res = await runPrompt(action.prompt)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  if (action.type === 'plugin') {
    // 同步返回（起视图不需要 await），成败与原因由 runtime 那三道闸判
    return runPluginCommandDetached(pluginId ?? '', action.cmd, action.arguments)
  }
  const main: MainAction =
    action.type === 'copyText'
      ? { type: 'copyText', text: action.text }
      : action.type === 'openUrl'
        ? { type: 'openUrl', url: action.url }
        : action.type === 'app'
          ? { type: 'app', path: action.path }
          : { type: 'system', cmdId: action.cmdId }
  const res = await dispatchMainAction(main)
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

export interface TickDeps {
  now: () => Date
  tasks: () => AutomationTask[]
  save: (tasks: AutomationTask[]) => void
  run: (
    action: AutomationAction,
    pluginId: string | null
  ) => Promise<{ ok: boolean; error?: string }>
}

/**
 * 一次心跳：把「这一分钟该跑的」都跑掉。返回触发的 id 列表。
 * 三个判据缺一不可：启用的、cron 命中当前分钟的、这一分钟桶还没跑过的。
 */
export async function tick(deps: TickDeps): Promise<string[]> {
  const now = deps.now()
  const bucket = Math.floor(now.getTime() / MINUTE_MS)
  const tasks = deps.tasks()
  const fired: string[] = []
  const updated: AutomationTask[] = []

  for (const t of tasks) {
    let next = t
    if (t.enabled) {
      const spec = parseCron(t.cron)
      const alreadyFired = t.lastFiredAt !== null && Math.floor(t.lastFiredAt / MINUTE_MS) === bucket
      if (spec && cronMatches(spec, now) && !alreadyFired) {
        next = { ...t, lastFiredAt: now.getTime() }
        fired.push(t.id)
        try {
          const res = await deps.run(t.action, ownerPluginId(t.owner))
          next = { ...next, lastOk: res.ok, ...(res.ok ? {} : { lastError: res.error ?? '执行失败' }) }
        } catch (error) {
          next = { ...next, lastOk: false, lastError: (error as Error).message }
        }
      }
    }
    updated.push(next)
  }
  if (fired.length > 0) deps.save(updated)
  return fired
}

let timer: NodeJS.Timeout | null = null

export function startAutomationEngine(): void {
  if (timer) return
  const deps: TickDeps = {
    now: () => new Date(),
    tasks: readTasks,
    save: writeTasks,
    run: executeAction
  }
  const beat = async (): Promise<void> => {
    try {
      const fired = await tick(deps)
      if (fired.length > 0) log.info(`[Automation] 触发 ${fired.join(', ')}`)
    } catch (error) {
      log.error('[Automation] 心跳失败', { error: (error as Error).message })
    }
  }
  timer = setInterval(() => void beat(), TICK_MS)
  // 不挡退出：定时器句柄不参与事件循环保活
  timer.unref?.()
  void beat()
}

export function stopAutomationEngine(): void {
  if (timer) clearInterval(timer)
  timer = null
}

/** 供设置页「立刻跑一次」用：绕过去重，直接执行并回报结果 */
/** 保存外部提交的列表：清洗 → 保留触发历史 → 落盘，并把被拒的条目原样带回 */
export function saveTasksFrom(raw: unknown): {
  tasks: AutomationTaskView[]
  rejected: Array<{ index: number; reason: string }>
} {
  const { tasks, rejected } = sanitizeTasks(raw)
  writeTasks(mergeRunHistory(tasks, readTasks()))
  return { tasks: taskViews(), rejected }
}

export async function runTaskNow(id: string): Promise<{ ok: boolean; error?: string }> {
  const t = readTasks().find((x) => x.id === id)
  if (!t) return { ok: false, error: '没有这个任务' }
  try {
    return await executeAction(t.action, ownerPluginId(t.owner))
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** 注册 Automations 的四根通道（设置页读写 + 手动跑一次） */
export function registerAutomationIpc(): void {
  typedHandle('automation:list', () => taskViews())
  typedHandle('automation:save', (_e, { tasks }) => saveTasksFrom(tasks))
  typedHandle('automation:runNow', (_e, { id }) => runTaskNow(String(id ?? '')))
  typedHandle('automation:setEnabled', (_e, { id, enabled }) => {
    const tasks = readTasks().map((t) => (t.id === id ? { ...t, enabled: !!enabled } : t))
    writeTasks(tasks)
    return taskViews()
  })
}
