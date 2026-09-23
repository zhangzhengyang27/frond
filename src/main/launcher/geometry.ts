/**
 * Frond · 胶囊窗几何（P-6⑤）
 *
 * 纯数据层：不 import electron，主进程之外也能跑单测。
 * 负责三件事——默认落点、按显示器记忆、Compact Mode 的高度，
 * 以及把这些落点插值成动画帧。
 *
 * 记忆用「按显示器 id 存一份矩形」而不是全局一份：
 * 拔屏/换排列后存的位置可能落在已经不存在的坐标上，所以**取用时必须再夹一次**
 * （`clampToWorkArea`），而不是信任存下来的值。
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

/** 单个矩形的坐标上限：远大于任何真实屏幕，只用来挡住脏数据被当坐标用 */
const MAX_COORD = 1_000_000
const MAX_SIZE = 10_000
/** 记住的显示器数量上限（多到这个数说明是被人手工塞进来的，不是真实使用） */
const MAX_REMEMBERED = 16

export const DEFAULT_VERTICAL_RATIO = 0.15

/** 默认落点：水平居中、垂直按 ratio（贴顶偏下一点，与改动前同一套算法） */
export function centeredBounds(
  work: WorkArea,
  width: number,
  height: number,
  verticalRatio = DEFAULT_VERTICAL_RATIO
): Rect {
  return {
    x: Math.round(work.x + (work.width - width) / 2),
    y: Math.round(work.y + work.height * verticalRatio),
    width,
    height
  }
}

/**
 * 把窗口夹进工作区：宽高超过屏幕时以宽高为准（窗口不被裁掉），
 * 结果永远满足 `x >= work.x && x + width <= work.x + work.width`。
 */
export function clampToWorkArea(bounds: Rect, work: WorkArea): Rect {
  const width = Math.min(bounds.width, work.width)
  const height = Math.min(bounds.height, work.height)
  const maxX = work.x + Math.max(0, work.width - width)
  const maxY = work.y + Math.max(0, work.height - height)
  return {
    x: Math.min(Math.max(bounds.x, work.x), maxX),
    y: Math.min(Math.max(bounds.y, work.y), maxY),
    width,
    height
  }
}

function isRectLike(v: unknown): v is Rect {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const n = r[key]
    if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) return false
  }
  const r2 = r as unknown as Rect
  return (
    r2.width > 0 &&
    r2.height > 0 &&
    r2.width <= MAX_SIZE &&
    r2.height <= MAX_SIZE &&
    Math.abs(r2.x) <= MAX_COORD &&
    Math.abs(r2.y) <= MAX_COORD
  )
}

/**
 * 存进 pref 的「按显示器记忆」表：`{ "1": {x,y,width,height} }`。
 * fail-closed——整份读不动就当作没有记忆（回到默认落点），
 * 单条非法只丢那一条；绝不把脏值当坐标使。
 */
export function parseBoundsMap(raw: unknown): Record<string, Rect> {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const out: Record<string, Rect> = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_REMEMBERED) break
    if (!key.trim() || !isRectLike(value)) continue
    out[key] = { ...value }
  }
  return out
}

export function serializeBoundsMap(map: Record<string, Rect>): string {
  return JSON.stringify(map)
}

/**
 * 取用一次落点：**记的是横纵落点，不是尺寸**。
 * 宽高每次按调用方要的那一份重算——记下来的高度一旦赢过请求高度，
 * 「拖过位置的用户」就再也拿不到 Compact Mode / 槽态收窗（窗按 520 高开着，
 * 里面只有一条栏，于是是一大片空窗）。
 * 没有记忆就用默认落点；两条路最后都再夹一次工作区。
 */
export function resolveBounds(
  map: Record<string, Rect>,
  displayId: string,
  work: WorkArea,
  size: { width: number; height: number }
): Rect {
  const remembered = map[displayId]
  if (!remembered) return centeredBounds(work, size.width, size.height)
  return clampToWorkArea({ ...remembered, width: size.width, height: size.height }, work)
}

/** 记一笔（写回同一个对象引用之外的副本，避免调用方持有活引用） */
export function rememberBounds(
  map: Record<string, Rect>,
  displayId: string,
  rect: Rect
): Record<string, Rect> {
  return { ...map, [displayId]: { ...rect } }
}

/**
 * Compact Mode 的目标矩形：**顶边不动、只收高度**。
 * 顶边不动是因为胶囊是「从上方拉开的一块面板」，收缩时如果上下都动，
 * 视觉上会变成整块在跳；高度不足时（贴屏幕顶）再往上让位。
 */
export function compactRect(full: Rect, compactHeight: number, work: WorkArea): Rect {
  const height = Math.max(1, Math.min(compactHeight, full.height))
  const topLimit = full.y + full.height - height
  return { ...full, height, y: Math.min(full.y, Math.max(work.y, topLimit)) }
}

/** 展开（回到完整高度）：同样顶边不动 */
export function expandRect(compact: Rect, fullHeight: number, work: WorkArea): Rect {
  const grown = { ...compact, height: fullHeight }
  return clampToWorkArea(grown, work)
}

/**
 * 淡入的起点：从落点**上方** offsetPx 处开始，最后落到位。
 * 夹一次是必需的——胶囊贴着屏幕顶时，往上让位会把它推出工作区（变成半条看不见）。
 */
export function enterRect(target: Rect, work: WorkArea, offsetPx = 12): Rect {
  return clampToWorkArea({ ...target, y: target.y - offsetPx }, work)
}

/** easeOutCubic（0-1）：起步快、收尾慢，读起来像「落位」而不是「飘过来」 */
export function easeOutCubic(t: number): number {
  const c = Math.min(Math.max(t, 0), 1)
  return 1 - (1 - c) ** 3
}

export function lerpRect(from: Rect, to: Rect, t: number): Rect {
  const k = easeOutCubic(t)
  const pick = (a: number, b: number): number => Math.round(a + (b - a) * k)
  return {
    x: pick(from.x, to.x),
    y: pick(from.y, to.y),
    width: pick(from.width, to.width),
    height: pick(from.height, to.height)
  }
}

/**
 * 动画帧序列：`durationMs` 内均匀切 `steps` 帧，返回每帧的矩形（**含最后一帧**）。
 * 步数为 0/负数时只给终点帧——不做「没有动画但停在起点」那种事。
 */
export function animationFrames(from: Rect, to: Rect, steps: number): Rect[] {
  if (steps <= 1) return [to]
  const out: Rect[] = []
  for (let i = 1; i <= steps; i++) out.push(lerpRect(from, to, i / steps))
  out[out.length - 1] = { ...to }
  return out
}
