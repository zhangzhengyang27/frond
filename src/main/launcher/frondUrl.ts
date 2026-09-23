/**
 * Frond · frond:// URL Scheme 路由解析 + 标签页匹配纯函数（B4）
 *
 * 刻意不 import electron：路由表解析、URL 规范化/匹配是纯字符串逻辑，
 * 单测可直接覆盖，不依赖 Electron 运行时。
 *
 * frond:// 路由表（B4）：
 * - frond://launcher        → 唤起胶囊窗
 * - frond://settings        → 显示并聚焦主窗设置路由
 * - frond://plugin/<id>     → 在胶囊窗打开对应插件
 * 未识别路由由调用方静默忽略并 log。
 */

/** 单个 frond:// 路由（判别联合，kind 为路由段） */
export type FrondRoute =
  | { kind: 'launcher' }
  | { kind: 'settings' }
  | { kind: 'plugin'; pluginId: string }

/** frond:// scheme 名（与 setAsDefaultProtocolClient 注册保持一致） */
export const FROND_SCHEME = 'frond'

/** decodeURIComponent 容错：畸形 % 序列按原样返回（深链来自系统，不可信） */
function safeDecodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

/**
 * 解析 frond:// 深链为路由对象；非 frond:// / 无法解析 / 未识别路由返回 null。
 * 容错：大小写不敏感（FROND://Launcher）、缺 `//` 的 frond:launcher 形态、
 * 尾随斜杠与多余 path 段、query/hash 忽略。
 */
export function parseFrondUrl(raw: unknown): FrondRoute | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!/^frond:/i.test(trimmed)) return null
  // 容错 frond:launcher（无 authority）形态 → 补 // 使 URL 解析器识别出 host
  const normalized = /^frond:\/\//i.test(trimmed) ? trimmed : trimmed.replace(/^frond:/i, 'frond://')
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    return null
  }
  // 非 special scheme 的 host 不会被 WHATWG 解析器自动小写，这里显式归一
  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)
  switch (host) {
    case 'launcher':
      return { kind: 'launcher' }
    case 'settings':
      return { kind: 'settings' }
    case 'plugin': {
      const pluginId = segments[0] ? safeDecodeSegment(segments[0]) : ''
      if (!pluginId) return null
      return { kind: 'plugin', pluginId }
    }
    default:
      return null
  }
}

/**
 * 标签页匹配用的 URL 规范化（Quicklinks 复用已有标签页，B4）：
 * - 仅 http(s)（与 Quicklink 白名单一致，其他协议不参与匹配）
 * - host（含端口）小写
 * - 去页面内锚点（hash 是同一页面内的位置，不构成「另一个标签页」）
 * - 去路径尾斜杠（https://a.com/x/ 与 /x 视为同一页；根路径除外）
 * - query 原样保留（精确匹配）
 * 非法输入返回 null（永不相等）。
 */
export function normalizeUrlForMatch(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  url.hash = ''
  let base = `${url.protocol}//${url.host.toLowerCase()}${url.pathname}`
  if (base.length > 1 && base.endsWith('/')) base = base.slice(0, -1)
  return base + url.search
}

/** 可参与标签页匹配的最小结构（BrowserTabsService.BrowserTab 的结构子集） */
export interface MatchableTab {
  url: string
}

/**
 * 在标签列表中精确查找与 targetUrl 规范化后相同的标签。
 * 双方都过 normalizeUrlForMatch：任一侧非法即视为不匹配。
 * 未命中返回 null，由调用方回退系统打开。
 */
export function findMatchingTab<T extends MatchableTab>(
  targetUrl: string,
  tabs: readonly T[] | null | undefined
): T | null {
  const target = normalizeUrlForMatch(targetUrl)
  if (!target || !tabs) return null
  for (const tab of tabs) {
    if (normalizeUrlForMatch(tab?.url) === target) return tab
  }
  return null
}
