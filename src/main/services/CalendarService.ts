/**
 * Leaf · CalendarService（V4 P0-1 批次4 第一档：系统日历只读）
 *
 * macOS 经 JXA + EventKit 读取（不捕捉不写回），TCC 日历权限按状态机处理：
 * - notDetermined：触发一次系统授权弹窗（fire-and-forget），本次返回 pending
 * - authorized：查询事件
 * - denied：返回 denied（渲染端提示去系统设置）
 * 非 macOS 直接 unsupported。
 *
 * 已在本机验证的技术点（2026-09-17）：ObjC.block 桥接、授权状态查询、
 * predicate 事件查询路径（见 docs/RAYCAST_GAP_ANALYSIS_V4.md）。
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { extractMeetingLink, type MeetingLink } from '../utils/meetingUrl'
import { autoJoinDue, autoJoinKey } from '../utils/autoJoin'
import { prefRepository } from '../db/repos'
import { isMac } from '../utils/platform'

const execFileAsync = promisify(execFile)

export type CalendarAuth = 'authorized' | 'denied' | 'notDetermined' | 'unsupported'

export interface CalendarEventView {
  title: string
  startMs: number
  endMs: number
  isAllDay: boolean
  meeting: MeetingLink | null
}

/** JXA 查询窗口上限（48h：覆盖「下一个会议」跨天场景，避免全量枚举） */
const QUERY_WINDOW_HOURS = 48
/** osascript 超时：Calendar 授权但日历极多时首查可能偏慢 */
const JXA_TIMEOUT_MS = 8000
/** 结果缓存：根搜索空态每次唤起都会取，JXA 进程冷启动有成本 */
const CACHE_TTL_MS = 30_000

/** JXA：查询 [start, end) 区间事件（上限 max 条防大日历拖垮） */
function buildQueryScript(startSec: number, endSec: number, max: number): string {
  return `ObjC.import("EventKit")
const store = $.EKEventStore.alloc.init
const status = Number($.EKEventStore.authorizationStatusForEntityType(0))
// EKAuthorizationStatus：0 notDetermined / 1 restricted / 2 denied / 3 authorized
if (status !== 3) { JSON.stringify({ status: status, events: [] }) } else {
const start = $.NSDate.alloc.initWithTimeIntervalSince1970(${startSec})
const end = $.NSDate.alloc.initWithTimeIntervalSince1970(${endSec})
const pred = store.predicateForEventsWithStartDateEndDateCalendars(start, end, store.calendarsForEntityType(0))
const evs = store.eventsMatchingPredicate(pred)
const n = Math.min(evs.count, ${max})
const out = []
for (let i = 0; i < n; i++) {
  const e = evs.objectAtIndex(i)
  out.push(JSON.stringify({
    title: String((e.title && e.title.js) || ''),
    start: Number(e.startDate ? e.startDate.timeIntervalSince1970 : 0),
    end: Number(e.endDate ? e.endDate.timeIntervalSince1970 : 0),
    allDay: !!(e.allDay && e.allDay.js),
    location: String((e.location && e.location.js) || '').slice(0, 300),
    notes: String((e.notes && e.notes.js) || '').slice(0, 500),
    url: String((e.URL && e.URL.absoluteString && e.URL.absoluteString.js) || '')
  }))
}
JSON.stringify({ status: 3, events: out })
}`
}

/** JXA：触发授权弹窗（fire-and-forget，结果由下次查询读取） */
const JXA_REQUEST_SCRIPT = `ObjC.import("EventKit")
const store = $.EKEventStore.alloc.init
const block = ObjC.block("void, BOOL", function() {})
store.requestFullAccessToEventsWithCompletion(block)
"requested"`

interface RawEvent {
  title: string
  start: number
  end: number
  allDay: boolean
  location: string
  notes: string
  url: string
}

function toView(raw: RawEvent): CalendarEventView {
  return {
    title: raw.title || '(无标题)',
    startMs: Math.round(raw.start * 1000),
    endMs: Math.round(raw.end * 1000),
    isAllDay: raw.allDay,
    meeting: extractMeetingLink(raw)
  }
}

class CalendarService {
  private cached: { at: number; next: CalendarEventView | null; auth: CalendarAuth } | null = null
  private joinedKeys = new Set<string>()
  private watcherTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 自动入会 watcher（V4 P0-1 批次4 第三档）：15s 一跳，开关从偏好实时读取；
   * 关闭时完全不动（不产生 JXA 调用）。每个会议只入会一次（joinedKeys 去重，
   * 上限 50 条滚动淘汰）。返回 true = 本次 tick 触发了入会。
   */
  startAutoJoinWatcher(): void {
    if (this.watcherTimer) return
    this.watcherTimer = setInterval(() => {
      void this.autoJoinTick()
    }, 15_000)
  }

  private async autoJoinTick(): Promise<void> {
    try {
      let raw: string | null = null
      try {
        raw = prefRepository.get('launcher:autoJoin')
      } catch {
        return // 数据库未就绪（极早启动）
      }
      if (raw !== 'true') return
      const { next } = await this.getNextEvent()
      if (!next?.meeting) return
      const candidate = { title: next.title, startMs: next.startMs, meetingUrl: next.meeting.url }
      if (!autoJoinDue(candidate, Date.now(), this.joinedKeys)) return
      this.joinedKeys.add(autoJoinKey(candidate))
      if (this.joinedKeys.size > 50) {
        this.joinedKeys.delete(this.joinedKeys.values().next().value as string)
      }
      const { shell } = await import('electron')
      await shell.openExternal(next.meeting.url)
    } catch {
      /* tick 失败静默：下一跳重试 */
    }
  }

  /** 下一个会议（现在起 48h 内最早的非全天事件）；未授权/无事件返回 null + auth 状态 */
  async getNextEvent(): Promise<{ auth: CalendarAuth; next: CalendarEventView | null }> {
    if (!isMac()) return { auth: 'unsupported', next: null }
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return { auth: this.cached.auth, next: this.cached.next }
    }
    const nowSec = Math.floor(Date.now() / 1000)
    const { auth, events } = await this.queryEvents(nowSec, nowSec + QUERY_WINDOW_HOURS * 3600, 20)
    const meetings = events
      .filter((e) => !e.allDay && e.end * 1000 > Date.now())
      .sort((a, b) => a.start - b.start)
    const next = meetings[0] ? toView(meetings[0]) : null
    this.cached = { at: Date.now(), auth, next }
    return { auth, next }
  }

  /** 未来 N 天日程（My Schedule 页；含全天事件，按开始时间升序） */
  async getSchedule(days = 7): Promise<{ auth: CalendarAuth; events: CalendarEventView[] }> {
    if (!isMac()) return { auth: 'unsupported', events: [] }
    const nowSec = Math.floor(Date.now() / 1000)
    const endSec = nowSec + days * 24 * 3600
    const { auth, events } = await this.queryEvents(nowSec, endSec, 60)
    return {
      auth,
      events: events.map(toView).sort((a, b) => a.startMs - b.startMs)
    }
  }

  /**
   * 创建日程（V4 P0-1 批次4 第三档；需要日历写权限，requestFullAccessToEvents 已覆盖）。
   * 日历取系统「新事件默认日历」（defaultCalendarForNewEvents），不可写时回落第一个可写日历。
   */
  async createEvent(input: {
    title: string
    startMs: number
    endMs: number
  }): Promise<{ ok: boolean; error?: string }> {
    if (!isMac()) return { ok: false, error: '当前平台不支持' }
    if (!input.title.trim()) return { ok: false, error: '标题不能为空' }
    if (!(input.endMs > input.startMs)) return { ok: false, error: '结束时间必须晚于开始时间' }
    const script = `ObjC.import("EventKit")
const store = $.EKEventStore.alloc.init
const status = Number($.EKEventStore.authorizationStatusForEntityType(0))
if (status !== 3) { JSON.stringify({ ok: false, error: 'calendar-not-authorized:' + status }) } else {
let cal = store.defaultCalendarForNewEvents
if (!cal || !cal.allowsContentModifications) {
  const cals = store.calendarsForEntityType(0)
  for (let i = 0; i < cals.count; i++) {
    const c = cals.objectAtIndex(i)
    if (c.allowsContentModifications) { cal = c; break }
  }
}
if (!cal) { JSON.stringify({ ok: false, error: 'no-writable-calendar' }) } else {
const ev = $.EKEvent.eventWithEventStore(store)
ev.title = ${JSON.stringify(input.title.trim())}
ev.startDate = $.NSDate.alloc.initWithTimeIntervalSince1970(${Math.floor(input.startMs / 1000)})
ev.endDate = $.NSDate.alloc.initWithTimeIntervalSince1970(${Math.floor(input.endMs / 1000)})
ev.calendar = cal
const ok = store.saveEventSpanError(ev, 0, null)
JSON.stringify({ ok: !!ok })
}
}`
    try {
      const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
        timeout: JXA_TIMEOUT_MS
      })
      const parsed = JSON.parse(String(stdout || '{}')) as { ok: boolean; error?: string }
      if (parsed.ok) {
        this.cached = null // 新事件可能就是「下一个会议」，清缓存让空态立即可见
        return { ok: true }
      }
      return {
        ok: false,
        error:
          parsed.error === 'calendar-not-authorized' ||
          parsed.error?.startsWith('calendar-not-authorized')
            ? '日历未授权：请先授权日历访问'
            : (parsed.error ?? '写入失败')
      }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  /** notDetermined 时主动触发系统授权弹窗（用户同意后下一次查询即有数据） */
  async requestAccess(): Promise<{ fired: boolean }> {
    if (!isMac()) return { fired: false }
    try {
      await execFileAsync('osascript', ['-l', 'JavaScript', '-e', JXA_REQUEST_SCRIPT], {
        timeout: 5000
      })
      return { fired: true }
    } catch {
      return { fired: false }
    }
  }

  private async queryEvents(
    startSec: number,
    endSec: number,
    max: number
  ): Promise<{
    auth: CalendarAuth
    events: RawEvent[]
  }> {
    try {
      const { stdout } = await execFileAsync(
        'osascript',
        ['-l', 'JavaScript', '-e', buildQueryScript(startSec, endSec, max)],
        { timeout: JXA_TIMEOUT_MS }
      )
      const parsed = JSON.parse(String(stdout || '{}')) as {
        status: number
        events: RawEvent[]
      }
      if (parsed.status !== 2) {
        // notDetermined：顺手把授权弹窗拉起来（下次查询生效）
        if (parsed.status === 0) void this.requestAccess()
        return {
          auth:
            parsed.status === 2 ? 'authorized' : parsed.status === 1 ? 'denied' : 'notDetermined',
          events: []
        }
      }
      return { auth: 'authorized', events: parsed.events ?? [] }
    } catch (error) {
      // 超时/无辅助工具等：静默降级为无日程（不阻塞启动器）
      console.warn('[Calendar] 查询失败:', (error as Error).message)
      return { auth: 'notDetermined', events: [] }
    }
  }
}

export const calendarService = new CalendarService()

