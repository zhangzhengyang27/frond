/**
 * Frond · 系统日历只读 IPC（V4 P0-1 批次4 第一档）
 *
 * - calendar:status   授权状态（渲染端引导授权用）
 * - calendar:next     下一个会议（根搜索空态展示）
 */
import { calendarService } from '../services/CalendarService'
import { typedHandle } from './typedIpc'

export function registerCalendarIpc(): void {
  typedHandle('calendar:status', async () => {
    const { auth } = await calendarService.getNextEvent()
    return { auth }
  })

  typedHandle('calendar:requestAccess', async () => calendarService.requestAccess())

  typedHandle('calendar:next', async () => {
    const { auth, next } = await calendarService.getNextEvent()
    return { auth, next }
  })

  // 创建日程（V4 P0-1 批次4 第三档）；失败弹系统通知（渲染端 executeCommand 不展示错误）
  typedHandle('calendar:createEvent', async (_e, input: unknown) => {
    const data = (input ?? {}) as { title?: unknown; startMs?: unknown; endMs?: unknown }
    const result = await calendarService.createEvent({
      title: typeof data.title === 'string' ? data.title : '',
      startMs: typeof data.startMs === 'number' ? data.startMs : 0,
      endMs: typeof data.endMs === 'number' ? data.endMs : 0
    })
    if (!result.ok && result.error) {
      try {
        const { Notification } = await import('electron')
        new Notification({ title: '创建日程失败', body: result.error }).show()
      } catch {
        /* 通知失败静默 */
      }
    }
    return result
  })

  // 未来 7 天日程（My Schedule 页，V4 P0-1 批次4 第二档）
  typedHandle('calendar:schedule', async () => {
    const { auth, events } = await calendarService.getSchedule(7)
    return { auth, events }
  })
}
