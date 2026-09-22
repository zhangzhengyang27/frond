/**
 * Leaf · 窗口几何纯函数（V4 P1-7 批次3：gaps 支持 + 可测性重构）
 *
 * 背景：mac 侧窗口脚本此前在 AppleScript 内联做分数算术（Finder 桌面 bounds
 * 当 workArea），无法单测也无法统一加 gap。本模块把「动作 → 目标矩形」收敛为
 * 纯函数，mac 用 Electron screen.workArea（与 Finder 桌面 bounds 同源）在 JS
 * 侧算好矩形，AppleScript 只负责 set position/size；Windows 侧因需按前台窗口
 * 所在屏取 WorkingArea 仍在 PowerShell 内算，但使用同一套分数语义与 gap。
 *
 * gap 语义（Raycast Window Gaps）：窗口与屏幕边缘之间的留白（px）。
 * 只作用于本动作涉及的单窗口边缘；窗口之间的间隙无法在单窗口动作内表达。
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 可在无「当前窗口矩形」输入时计算的动作 */
export type GeometryAction =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'maximize'
  | 'maximizeHeight'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'thirdFirst'
  | 'thirdFirstTwo'
  | 'thirdCenter'
  | 'thirdLastTwo'
  | 'thirdLast'
  | 'sixthTopLeft'
  | 'sixthTopCenter'
  | 'sixthTopRight'
  | 'sixthBottomLeft'
  | 'sixthBottomCenter'
  | 'sixthBottomRight'

/** 需要当前窗口矩形（保持尺寸/位置类动作） */
export type CurrentAwareAction = 'maximizeWidth' | 'center'

const clampInt = (v: number): number => Math.round(v)

/** workArea 按四周 gap 内缩 */
function inset(area: Rect, gap: number): Rect {
  const g = Math.max(0, Math.round(gap))
  return {
    x: area.x + g,
    y: area.y + g,
    width: Math.max(0, area.width - 2 * g),
    height: Math.max(0, area.height - 2 * g)
  }
}

/**
 * 计算窗口动作的目标矩形。
 * - maximizeWidth / center 需要 currentWindow（缺省时抛错，调用方应先探测窗口矩形）
 * - 返回值取整（AppleScript / SetWindowPos 均要求整数）
 */
export function computeWindowRect(
  action: GeometryAction | CurrentAwareAction,
  workArea: Rect,
  gap: number,
  currentWindow?: Rect
): Rect {
  const a = inset(workArea, gap)
  const third = a.width / 3
  const sixth = a.width / 6
  const halfH = a.height / 2
  const halfW = a.width / 2
  const needCurrent = (): Rect => {
    if (!currentWindow) throw new Error(`action ${action} requires current window rect`)
    return currentWindow
  }
  switch (action) {
    case 'left':
      return { x: a.x, y: a.y, width: halfW, height: a.height }
    case 'right':
      return { x: a.x + halfW, y: a.y, width: halfW, height: a.height }
    case 'top':
      return { x: a.x, y: a.y, width: a.width, height: halfH }
    case 'bottom':
      return { x: a.x, y: a.y + halfH, width: a.width, height: halfH }
    case 'maximize':
    case 'maximizeHeight':
      return { x: a.x, y: a.y, width: a.width, height: a.height }
    case 'maximizeWidth': {
      const cur = needCurrent()
      return { x: a.x, y: cur.y, width: a.width, height: cur.height }
    }
    case 'center': {
      const cur = needCurrent()
      const w = Math.min(cur.width, a.width)
      const h = Math.min(cur.height, a.height)
      return { x: a.x + (a.width - w) / 2, y: a.y + (a.height - h) / 2, width: w, height: h }
    }
    case 'topLeft':
      return { x: a.x, y: a.y, width: halfW, height: halfH }
    case 'topRight':
      return { x: a.x + halfW, y: a.y, width: halfW, height: halfH }
    case 'bottomLeft':
      return { x: a.x, y: a.y + halfH, width: halfW, height: halfH }
    case 'bottomRight':
      return { x: a.x + halfW, y: a.y + halfH, width: halfW, height: halfH }
    case 'thirdFirst':
      return { x: a.x, y: a.y, width: third, height: a.height }
    case 'thirdFirstTwo':
      return { x: a.x, y: a.y, width: 2 * third, height: a.height }
    case 'thirdCenter':
      return { x: a.x + third, y: a.y, width: third, height: a.height }
    case 'thirdLastTwo':
      return { x: a.x + third, y: a.y, width: 2 * third, height: a.height }
    case 'thirdLast':
      return { x: a.x + 2 * third, y: a.y, width: third, height: a.height }
    case 'sixthTopLeft':
      return { x: a.x, y: a.y, width: sixth, height: halfH }
    case 'sixthTopCenter':
      return { x: a.x + third, y: a.y, width: third, height: halfH }
    case 'sixthTopRight':
      return { x: a.x + 5 * sixth, y: a.y, width: sixth, height: halfH }
    case 'sixthBottomLeft':
      return { x: a.x, y: a.y + halfH, width: sixth, height: halfH }
    case 'sixthBottomCenter':
      return { x: a.x + third, y: a.y + halfH, width: third, height: halfH }
    case 'sixthBottomRight':
      return { x: a.x + 5 * sixth, y: a.y + halfH, width: sixth, height: halfH }
  }
}

/** 统一取整输出（SetWindowPos / AppleScript 需要整数坐标） */
export function roundRect(rect: Rect): Rect {
  return {
    x: clampInt(rect.x),
    y: clampInt(rect.y),
    width: clampInt(rect.width),
    height: clampInt(rect.height)
  }
}
