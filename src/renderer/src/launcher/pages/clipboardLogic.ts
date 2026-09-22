/**
 * ClipboardPage 私有纯函数（B2 List-Detail 重构抽出）
 *
 * 只做数据变换，不依赖 DOM / Electron —— 供 vitest 直接单测：
 *  - 日期分组（今天/昨天/更早，本地日界，DST 安全）
 *  - 相对时间 / 详情绝对时间（「今天 14:32」）
 *  - 类型标签 / 尺寸摘要 / 列表标题
 *  - 类型筛选
 * 数据字段全部来自 preload clipHist.list()（含 ClipboardHistoryService 的 sourceApp）。
 */

export type ClipKind = 'text' | 'image' | 'files' | 'link'

/** 渲染层列表条目（= clipHist.list() 返回项 + sourceApp） */
export interface ClipItemLike {
  id: string
  kind: ClipKind
  text?: string
  paths?: string[]
  filePath?: string
  width?: number
  height?: number
  pinned?: boolean
  sourceApp?: string
  /** 图片条目的 OCR 文本（异步回填，可能暂缺） */
  ocrText?: string
  createdAt: number
}

export type DateGroupKey = 'today' | 'yesterday' | 'earlier'
export type GroupKey = 'pinned' | DateGroupKey
export type KindFilter = 'all' | ClipKind

const GROUP_LABELS: Record<GroupKey, string> = {
  pinned: '置顶',
  today: '今天',
  yesterday: '昨天',
  earlier: '更早'
}

export const KIND_LABELS: Record<ClipKind, string> = {
  text: '文本',
  link: '链接',
  image: '图片',
  files: '文件'
}

/** 本地零点时间戳（分组日界基准） */
function localMidnight(t: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * createdAt → 本地日界分组。未来时间戳按「今天」处理；
 * DST 切换日（23/25 小时）用 Math.round 消除 ±1h 偏差。
 */
export function dateGroupOf(ts: number, now: number): DateGroupKey {
  const days = Math.round((localMidnight(now) - localMidnight(ts)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return 'earlier'
}

export interface ClipGroup<T extends ClipItemLike> {
  key: GroupKey
  label: string
  items: T[]
}

/**
 * 列表分组：置顶组固定在最前（保持既有「置顶排序不变」行为），
 * 其余按 今天/昨天/更早；组内保持传入顺序（调用方已按 createdAt 倒序排好）。
 * 空组不输出。
 */
export function groupItems<T extends ClipItemLike>(items: T[], now: number): ClipGroup<T>[] {
  const order: GroupKey[] = ['pinned', 'today', 'yesterday', 'earlier']
  const buckets = new Map<GroupKey, T[]>([
    ['pinned', []],
    ['today', []],
    ['yesterday', []],
    ['earlier', []]
  ])
  for (const it of items) {
    buckets.get(it.pinned ? 'pinned' : dateGroupOf(it.createdAt, now))?.push(it)
  }
  return order
    .filter((k) => (buckets.get(k)?.length ?? 0) > 0)
    .map((k) => ({ key: k, label: GROUP_LABELS[k], items: buckets.get(k) as T[] }))
}

/** 类型筛选（纯前端过滤） */
export function filterByKind<T extends ClipItemLike>(items: T[], filter: KindFilter): T[] {
  if (filter === 'all') return items
  return items.filter((i) => i.kind === filter)
}

/** 相对时间（一天内有效）；更早返回空串，由调用方回退绝对日期 */
export function relativeTime(ts: number, now: number): string {
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return ''
}

/** 列表副标题时间（保持既有展示：刚刚/N 分钟前/N 小时前/M月D日） */
export function listTimeLabel(ts: number, now: number): string {
  const rel = relativeTime(ts, now)
  if (rel) return rel
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 详情绝对时间：今天 14:32 / 昨天 09:05 / 3月5日 14:32 / 2025年12月31日 23:59 */
export function formatAbsTime(ts: number, now: number): string {
  const d = new Date(ts)
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const group = dateGroupOf(ts, now)
  if (group === 'today') return `今天 ${hm}`
  if (group === 'yesterday') return `昨天 ${hm}`
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return sameYear ? `${md} ${hm}` : `${d.getFullYear()}年${md} ${hm}`
}

/** 详情「复制时间」值：绝对时间优先，一天内补充相对时间（刚刚不再重复补充） */
export function detailTime(ts: number, now: number): string {
  const abs = formatAbsTime(ts, now)
  const rel = relativeTime(ts, now)
  if (!rel || rel === '刚刚') return abs
  return `${abs} · ${rel}`
}

export function kindLabelOf(kind: ClipKind): string {
  return KIND_LABELS[kind] ?? kind
}

/**
 * 详情「字符数/尺寸/文件数」行值：
 * text/link → 字符数；image → 宽 × 高；files → 文件个数
 */
export function sizeSummaryOf(item: ClipItemLike): string {
  if (item.kind === 'image') {
    if (typeof item.width === 'number' && typeof item.height === 'number') {
      return `${item.width} × ${item.height}`
    }
    return '未知尺寸'
  }
  if (item.kind === 'files') {
    return `${(item.paths ?? []).length} 个文件`
  }
  return `${(item.text ?? '').length} 字符`
}

/** 列表主标题（保持既有展示逻辑） */
export function titleOf(item: ClipItemLike): string {
  if (item.kind === 'image') return `图片 ${item.width ?? '?'} × ${item.height ?? '?'}`
  if (item.kind === 'files') {
    const paths = item.paths ?? []
    if (paths.length === 1) {
      return paths[0].split(/[\\/]/).pop() ?? paths[0]
    }
    return `${paths[0] ?? ''} 等 ${paths.length} 个文件`
  }
  const firstLine = (item.text ?? '').split('\n')[0].trim()
  return firstLine.slice(0, 60) || '空文本'
}

