/**
 * Frond · My Schedule 分组逻辑（纯函数，可单测）
 *
 * 日视图分组：今天 / 明天 / 周X（含日期）；全天事件排每组最前；
 * 跨越 startOfDay 归属按开始时间。
 */

export interface ScheduleEvent {
  title: string
  startMs: number
  endMs: number
  isAllDay: boolean
  meeting: { url: string; provider: string } | null
}

export interface ScheduleGroup {
  /** 分组标题：今天 / 明天 / 周三 09/24 */
  label: string
  items: ScheduleEvent[]
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 分组标题：0 = 今天，1 = 明天，其余 = 周X + 月/日 */
export function dayLabel(dayStart: number, now: Date): string {
  const d = new Date(dayStart)
  const today = startOfDay(now)
  if (dayStart === today) return '今天'
  if (dayStart === today + 24 * 3600 * 1000) return '明天'
  return `${WEEKDAYS[d.getDay()]} ${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/** 按天分组：跳过开始时间早于「今天零点」的事件；每组全天事件置顶，其余按开始时间升序 */
export function groupSchedule(events: ScheduleEvent[], now: Date): ScheduleGroup[] {
  const todayStart = startOfDay(now)
  const byDay = new Map<number, ScheduleEvent[]>()
  for (const e of events) {
    if (e.startMs < todayStart) continue
    const key = startOfDay(new Date(e.startMs))
    const bucket = byDay.get(key)
    if (bucket) bucket.push(e)
    else byDay.set(key, [e])
  }
  return [...byDay.keys()]
    .sort((a, b) => a - b)
    .map((key) => {
      const items = (byDay.get(key) ?? []).sort((a, b) => {
        if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
        return a.startMs - b.startMs
      })
      return { label: dayLabel(key, now), items }
    })
}

/** HH:mm 时间标签；全天事件返回「全天」 */
export function timeRange(e: ScheduleEvent): string {
  if (e.isAllDay) return '全天'
  const fmt = (ms: number): string => {
    const d = new Date(ms)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${fmt(e.startMs)} – ${fmt(e.endMs)}`
}
