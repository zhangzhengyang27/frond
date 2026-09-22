/**
 * Leaf · 命令源合并（P-7② 注册表合一）
 *
 * 为什么还要一层合并：命令**源**本来就不止一个（Registry 的 provider + 插件命令 +
 * 插件 searchable 条目 + Quicklinks），而它们曾在搜索框里同时出现同一件事的三份——
 * `ai:translate` 三条一模一样的行，外加 `firstparty:ai` 与 `ai:chat` 两个 id 一件事
 * （v-for 的 key 还会撞）。合一之后**同一件事不该再由两个源出**（系统命令那份已归一，
 * 见 `SystemCommandProvider`），这一层是那道规矩的执行者兼兜底。
 *
 * 它做两件事：
 * ① 给合并一个**确定次序**（先到先得，后面的重复条目丢弃）；
 * ② 把「重复」变成可断言的输出（duplicateKeys / duplicateTitles），
 *    由 `mergeCommands.test.ts` 守住：一个 cmdId 两行、一条命令两份文案，都在那里红。
 */
import type { CommandEntry } from './commands'

export interface MergeResult {
  entries: CommandEntry[]
  /** key 完全相同的被丢弃条目（多半是两处各写了一份） */
  duplicateKeys: string[]
  /** 标题 + 动作相同但 key 不同，形如 `被丢弃的 key ≡ 保留的 key` */
  duplicateTitles: string[]
}

/**
 * 动作签名 = **执行目标本身**，所以把整个 action 对象稳定序列化，
 * 而不是挑几个"看起来像标识"的字段拼。
 *
 * 两个真踩过的坑：
 * ① 用 `page ?? path ?? moduleId` 这种"取第一个非空"，会把「打开录屏模块」与
 *    「开始录制」比成同一个值，正常的模块行被当重复删掉；
 * ② 只拼 page/pageId/path/moduleId/url 五个字段（上一版），漏掉了 cmdId/text/cmd/
 *    pluginId/id —— 于是**同文案不同目标**的两条系统命令被合成一条：那对真数据是
 *    `system.hideAll` 与 `system.showDesktop`（当时两条的标题、副标题、图标全一样，
 *    只差 cmdId），留下来的那行标题写着「显示桌面」，干的却是「最小化全部窗口」。
 *    文案后来各归各了（见 SYSTEM_CMD_META 的注释），但这条判据不能松：
 *    同名不同目标的两条命令在系统命令与插件命令里都是合法存在的，
 *    合并器没有权利替用户挑一个。
 *
 * 函数/回调这类不可序列化的值统一记成 '?'+键名：同一动作模板的两条条目本来就该同签名。
 */
function stableSignature(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || value === undefined) return '·'
  const t = typeof value
  if (t === 'string') return `s:${value as string}`
  if (t === 'number' || t === 'boolean') return `n:${String(value)}`
  if (t === 'function') return '?'
  if (typeof value !== 'object') return `o:${String(value)}`
  const obj = value as object
  if (seen.has(obj)) return '#循环'
  seen.add(obj)
  if (Array.isArray(value)) {
    const inner = value.map((v) => stableSignature(v, seen)).join(',')
    seen.delete(obj)
    return `[${inner}]`
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  const inner = keys
    .map((k) => `${k}=${stableSignature((obj as Record<string, unknown>)[k], seen)}`)
    .join(',')
  seen.delete(obj)
  return `{${inner}}`
}

function actionSignature(entry: CommandEntry): string {
  return stableSignature(entry.action as unknown)
}

/**
 * @param sources 按优先级排列的命令源，**靠前的胜出**
 */
export function mergeCommandEntries(sources: CommandEntry[][]): MergeResult {
  const byKey = new Map<string, CommandEntry>()
  /** 动作签名 → 第一个占有它的条目 */
  const bySignature = new Map<string, { key: string; title: string }>()
  const duplicateKeys: string[] = []
  const duplicateTitles: string[] = []

  for (const source of sources) {
    for (const entry of source ?? []) {
      if (!entry || typeof entry.key !== 'string' || !entry.key) continue
      if (byKey.has(entry.key)) {
        duplicateKeys.push(entry.key)
        continue
      }
      const sig = actionSignature(entry)
      const owner = bySignature.get(sig)
      if (owner && owner.title === entry.title) {
        // 同标题同动作不同 id：留着就是界面上多一行，丢弃并记下来
        duplicateTitles.push(`${entry.key} ≡ ${owner.key}`)
        continue
      }
      byKey.set(entry.key, entry)
      if (!owner) bySignature.set(sig, { key: entry.key, title: entry.title })
    }
  }
  return { entries: [...byKey.values()], duplicateKeys, duplicateTitles }
}
