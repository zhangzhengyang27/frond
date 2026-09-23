/**
 * Frond · 自动入会判定（V4 P0-1 批次4 第三档，纯函数可单测）
 *
 * 对齐 Raycast Auto-Join：下一个会议开始后（含 1 分钟追认窗口）自动打开入会链接。
 * 只判定，不执行——调用方（CalendarService watcher）负责打开与去重。
 */

/** 追认窗口：watcher 间隔 + 唤起延迟的容差；错过 1 分钟不再补开（避免开会半小时后突然弹链接） */
export const AUTO_JOIN_WINDOW_MS = 60_000

export interface AutoJoinEvent {
  title: string
  startMs: number
  meetingUrl: string | null
}

/** 一次会议的唯一键（同标题同时段重复事件的去重粒度） */
export function autoJoinKey(event: AutoJoinEvent): string {
  return `${event.startMs}:${event.title}`
}

/** 是否应当自动入会：有链接 + 未入过 + 当前处于 [开始, 开始+窗口] */
export function autoJoinDue(
  event: AutoJoinEvent,
  now: number,
  joinedKeys: ReadonlySet<string>
): boolean {
  if (!event.meetingUrl) return false
  if (joinedKeys.has(autoJoinKey(event))) return false
  return now >= event.startMs && now <= event.startMs + AUTO_JOIN_WINDOW_MS
}
