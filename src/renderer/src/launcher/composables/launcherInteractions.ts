/**
 * 启动器交互纯函数集（B1 五件套）
 *
 * 从 LauncherApp.vue 抽出的可单测判定逻辑：
 *  - 数字直达：数字键 → 结果下标（0 = 第 10 条）
 *  - Pop to Root：空闲过期判定 / 隐藏窗口暂停时的剩余时间与恢复平移
 *  - 搜索历史导航：↑/↓ 循环游标（-1 表示未选中 = 空查询态）
 *  - 底部动作栏：主动作提示文案（跟随选中项类型）
 *
 * 全部无副作用、不依赖 DOM / IPC，便于 vitest 覆盖。
 */

/** Pop to Root 空闲阈值（毫秒）：胶囊窗内 60s 无交互自动回根 */
export const POP_TO_ROOT_TIMEOUT_MS = 60_000

/**
 * 数字键 → 结果下标。'1'-'9' → 0-8；'0' → 第 10 条（下标 9）；
 * 其余（含带修饰键的组合键判断交由调用方）返回 null。
 */
export function digitToIndex(key: string): number | null {
  if (key >= '1' && key <= '9') return Number(key) - 1
  if (key === '0') return 9
  return null
}

/** 空闲是否已过期（now 与 lastActivityAt 单位一致即可） */
export function isIdleExpired(lastActivityAt: number, now: number, timeoutMs: number): boolean {
  return now - lastActivityAt >= timeoutMs
}

/** 隐藏窗口暂停计时：暂停时刻的剩余空闲毫秒（已耗尽则为 0） */
export function idleRemainingMs(lastActivityAt: number, now: number, timeoutMs: number): number {
  return Math.max(0, timeoutMs - (now - lastActivityAt))
}

/** 恢复计时：把暂停期间（pausedAt → resumedAt）从空闲时长中扣除 */
export function shiftLastActivity(
  lastActivityAt: number,
  pausedAt: number,
  resumedAt: number
): number {
  return lastActivityAt + Math.max(0, resumedAt - pausedAt)
}

/**
 * 搜索历史导航游标（循环）：-1 表示未选中（空查询态），0..count-1 为历史条目。
 * ↑ 向更旧方向推进，翻过最旧一条后回到 -1（空查询）；
 * ↓ 反向，越过 -1 后跳到最旧一条（count-1）。count 为 0 时恒为 -1。
 */
export function nextHistoryCursor(cursor: number, count: number, direction: 'up' | 'down'): number {
  if (count <= 0) return -1
  if (direction === 'up') {
    return cursor + 1 >= count ? -1 : cursor + 1
  }
  return cursor - 1 < -1 ? count - 1 : cursor - 1
}

/** 底部动作栏主动作提示文案：跟随选中项的动作类型（回车语义） */
/**
 * 「只认最新一次」的异步拉取包装。
 *
 * 命令表是**推送驱动**重拉的，而两次推送可以挨得比一次拉取还近（连点插件开关、
 * 装完立刻启用）。不加这道闸，先发起的那次拉取晚回来就会**覆盖**后一次的结果，
 * 表现是「明明启用了，搜索框里却没有那几行」——而且下次唤起才好，最难复现。
 */
export function latestOnly<T>(
  run: () => Promise<T>,
  commit: (value: T) => void
): () => Promise<void> {
  let seq = 0
  return async (): Promise<void> => {
    const mine = ++seq
    const value = await run()
    if (mine === seq) commit(value)
    // 晚了就别提交：已经有更新的一趟在跑或已经跑完
  }
}

export function primaryActionLabel(actionType: string | undefined): string {
  switch (actionType) {
    case 'app':
    case 'module':
    case 'page':
    case 'file':
    case 'quicklink':
    case 'system':
    case 'openUrl':
      return '打开'
    case 'clipboardItem':
    case 'snippetItem':
    case 'copyText':
      return '复制'
    case 'shotPaste':
      return '粘贴'
    case 'searchQuery':
      return '填入'
    case 'ai':
      return '发送'
    default:
      return '执行'
  }
}

/**
 * 分区渲染槽位：保留 results 扁平下标，选中/滚动/数字直达仍按扁平序映射
 */
export interface ResultSlot<T> {
  item: T
  index: number
}

export interface ResultGroup<T> {
  label: string
  items: ResultSlot<T>[]
}

/**
 * Raycast 式分区（V5）：根态（无查询词）单列「建议」；
 * 查询态把文件类结果（action.type === 'file'）单列「文件」分区，其余归「结果」。
 * 返回空组不输出；槽位保留原扁平下标。
 */
export function groupResultsForDisplay<T extends { entry: { action: { type: string } } }>(
  results: T[],
  hasQuery: boolean
): Array<ResultGroup<T>> {
  if (!hasQuery) {
    return [{ label: '建议', items: results.map((item, index) => ({ item, index })) }]
  }
  const main: ResultSlot<T>[] = []
  const files: ResultSlot<T>[] = []
  results.forEach((item, index) => {
    const slot = { item, index }
    if (item.entry.action.type === 'file') files.push(slot)
    else main.push(slot)
  })
  const groups: Array<ResultGroup<T>> = [{ label: '结果', items: main }]
  if (files.length > 0) groups.push({ label: '文件', items: files })
  return groups
}

/**
 * 收藏置顶（P-1.4）：稳定二分——收藏过的行提到最前，组内与非组内都保持原顺序，
 * 因此不会推翻 searchEntries 的打分与 usageBoost。favorites 里没命中的 key 忽略。
 */
export function hoistFavorites<T extends { entry: { key: string } }>(
  rows: T[],
  favorites: string[]
): T[] {
  if (favorites.length === 0 || rows.length === 0) return rows
  const fav = new Set(favorites)
  const head: T[] = []
  const rest: T[] = []
  for (const row of rows) (fav.has(row.entry.key) ? head : rest).push(row)
  return head.length === 0 ? rows : [...head, ...rest]
}

/**
 * 参数初值（P-1.6）：用户在搜索词里已经打出的「标题之外的部分」。
 * `"github react"` + 标题 `GitHub` → `"react"`；标题不是查询的前缀就不猜（返回空）。
 * 大小写无关，因为应用/命令标题常是英文而用户可能按中文标题搜。
 */
export function argPrefill(query: string, title: string): string {
  const q = query.trim()
  const t = title.trim()
  if (!q || !t) return ''
  return q.toLowerCase().startsWith(t.toLowerCase()) ? q.slice(t.length).trim() : ''
}

/**
 * window/document 级监听封装：登记到调用方传入的退订表，卸载时统一释放。
 * 抽在 .ts 模块：lib.dom 类型（WindowEventMap 等）在 .vue script 块会被
 * no-undef 误判为未定义值（BUGS.md B9 同源问题）。
 */
type Unsubscribe = () => void

export function addWindowListener<K extends keyof WindowEventMap>(
  registry: Unsubscribe[],
  type: K,
  handler: (ev: WindowEventMap[K]) => void,
  opts?: AddEventListenerOptions
): void {
  window.addEventListener(type, handler, opts)
  registry.push(() => window.removeEventListener(type, handler, opts))
}

/** visibilitychange 的标准派发目标是 document（事件冒泡到 window），单独注册 */
export function addDocumentListener(
  registry: Unsubscribe[],
  type: string,
  handler: EventListener,
  opts?: AddEventListenerOptions
): void {
  document.addEventListener(type, handler, opts)
  registry.push(() => document.removeEventListener(type, handler, opts))
}
