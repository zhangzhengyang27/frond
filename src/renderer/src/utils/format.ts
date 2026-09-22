/**
 * Leaf · 渲染层时间格式化共享工具
 *
 * 收敛史：formatDuration 原为录屏域 6 处重复实现；时间戳系列原为
 * 启动台/番茄钟/片段等 11 处各自的 formatTime。语义以现存实现为准。
 */

const pad2 = (n: number): string => n.toString().padStart(2, '0')

/** 秒数 → "HH:MM:SS"（含小时）或 "MM:SS" */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`
}

/** 倒计时秒数 → "MM:SS"，分钟位不封顶（番茄钟显示约定：125:00 而非 02:05:00） */
export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

/** 时间戳 → 当天时刻 "HH:mm" */
export function formatClock(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 时间戳 → "HH:mm:ss" */
export function formatClockWithSeconds(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** 时间戳 → "YYYY-MM-DD HH:mm" */
export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 时间戳 → 今天显示 "HH:mm"，更早显示 "MM/DD"（补零） */
export function formatSmartDate(ts: number): string {
  const d = new Date(ts)
  if (d.toDateString() === new Date().toDateString()) return formatClock(ts)
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
}

/** 时间戳 → 今天显示 "HH:mm"，更早显示 "M/D"（不补零，悬浮便签约定） */
export function formatShortDate(ts: number): string {
  const d = new Date(ts)
  if (d.toDateString() === new Date().toDateString()) return formatClock(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 时间戳 → "今天 HH:mm" / "明天 HH:mm" / "M月D日 HH:mm"（提醒列表约定） */
export function formatRelativeDay(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === now.toDateString()) return `今天 ${formatClock(ts)}`
  if (d.toDateString() === tomorrow.toDateString()) return `明天 ${formatClock(ts)}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${formatClock(ts)}`
}
