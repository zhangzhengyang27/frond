/**
 * Frond · macOS 权限面板（P-3.5）
 *
 * 修的是「静默依赖授权」：文本扩展 / 窗口切换 / 专注护盾 / Hyper Key 靠辅助功能，
 * 日历读事件靠 EventKit 授权，录屏靠屏幕录制——没授权时表现是「按了没反应」，
 * 用户不会想到要去系统设置里开。这里给三样：真状态、真申请、真跳转。
 *
 * 状态读取都选**无副作用**的那条路：
 * - 辅助功能：isTrustedAccessibilityClient(false)（true 会弹系统对话框）
 * - 屏幕录制：getMediaAccessStatus('screen')
 * - 日历：只读 EKEventStore.authorizationStatusForEntityType（不查事件、不拉弹窗）
 *
 * 申请能力三项不对等，界面按真话区分（见 canRequest）：
 * - 辅助功能：Electron 能把系统那条「打开系统设置」的对话框弹出来
 * - 日历：EventKit 的 requestFullAccess 会弹系统授权框
 * - 屏幕录制：**没有**可编程的申请口（askForMediaAccess 只收麦克风/摄像头），
 *   只能跳设置 + 授权后重启应用；这里不假装能一键申请
 */
import { shell, systemPreferences } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { typedHandle } from './typedIpc'

const execFileAsync = promisify(execFile)

export type PermissionId = 'accessibility' | 'calendar' | 'screenRecording'
export type PermissionState =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'restricted'
  | 'unknown'
  | 'unsupported'

export interface PermissionStatus {
  id: PermissionId
  label: string
  /** 这项权限在 Frond 里到底管什么——界面直接展示，不藏进 tooltip */
  usedBy: string
  state: PermissionState
  /** 能不能就地申请（屏幕录制不能，见文件头） */
  canRequest: boolean
  /** 状态读不出来 / 授权后要重启这类实话 */
  note?: string
}

/** 采集到的原始信号（与平台 API 解耦，纯函数据此合成状态表） */
export interface RawPermissionSignals {
  /** isTrustedAccessibilityClient(false)；null = 读不了 */
  accessibility: boolean | null
  /** getMediaAccessStatus('screen')；null = 读不了 */
  screen: string | null
  /** EKEventStore 授权枚举原值（0/1/2/3）；null = 读不了 */
  calendar: number | null
}

const META: Record<PermissionId, { label: string; usedBy: string; pane: string }> = {
  accessibility: {
    label: '辅助功能',
    usedBy: '文本扩展、窗口切换、专注护盾、Hyper Key、模拟粘贴',
    pane: 'Privacy_Accessibility'
  },
  calendar: {
    label: '日历',
    usedBy: '启动器空态的「下一个会议」、会议自动入会',
    pane: 'Privacy_Calendars'
  },
  screenRecording: {
    label: '屏幕录制',
    usedBy: '录屏与区域录制的画面采集',
    pane: 'Privacy_ScreenCapture'
  }
}

export const PERMISSION_IDS: PermissionId[] = ['accessibility', 'calendar', 'screenRecording']

/** EventKit 的 EKAuthorizationStatus → 档位（纯函数） */
export function classifyEventKitStatus(status: number | null): PermissionState {
  if (status === null) return 'unknown'
  if (status === 3) return 'granted'
  if (status === 2) return 'denied'
  if (status === 1) return 'restricted'
  if (status === 0) return 'not-determined'
  return 'unknown'
}

/** getMediaAccessStatus 的字符串 → 档位（纯函数，未知取值不猜） */
export function classifyMediaStatus(status: string | null): PermissionState {
  if (status === null) return 'unknown'
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'
  if (status === 'restricted') return 'restricted'
  if (status === 'not-determined') return 'not-determined'
  return 'unknown'
}

/**
 * 合成状态表（纯函数，可单测）。
 * 非 darwin 一律 unsupported：Windows 上没有这三类 TCC 授权，不该显示「未授权」吓人。
 */
export function buildPermissionStatuses(
  signals: RawPermissionSignals,
  platform: NodeJS.Platform
): PermissionStatus[] {
  if (platform !== 'darwin') {
    return PERMISSION_IDS.map((id) => ({
      id,
      label: META[id].label,
      usedBy: META[id].usedBy,
      state: 'unsupported' as PermissionState,
      canRequest: false,
      note: '当前系统不需要这类授权'
    }))
  }
  const screen = classifyMediaStatus(signals.screen)
  return [
    {
      id: 'accessibility',
      label: META.accessibility.label,
      usedBy: META.accessibility.usedBy,
      state:
        signals.accessibility === null ? 'unknown' : signals.accessibility ? 'granted' : 'denied',
      canRequest: true
    },
    {
      id: 'calendar',
      label: META.calendar.label,
      usedBy: META.calendar.usedBy,
      state: classifyEventKitStatus(signals.calendar),
      canRequest: true
    },
    {
      id: 'screenRecording',
      label: META.screenRecording.label,
      usedBy: META.screenRecording.usedBy,
      state: screen,
      canRequest: false,
      // 没有可编程的申请口；授权后 macOS 还要求重启应用才生效
      note: screen === 'granted' ? undefined : '系统不提供一键申请，需在设置里打开开关后重启 Frond'
    }
  ]
}

/** 系统设置深链（macOS 13+ 的隐私面板锚点；未知 id 回落到隐私总览） */
export function settingsDeepLink(id: PermissionId | 'privacy'): string {
  const pane = id === 'privacy' ? 'Privacy' : (META[id]?.pane ?? 'Privacy')
  return `x-apple.systempreferences:com.apple.preference.security?${pane}`
}

async function readCalendarStatus(): Promise<number | null> {
  // 只读授权枚举：不查事件、不触发弹窗（JXA 起一个进程的成本，仅引导页用一次）
  const script =
    'ObjC.import("EventKit")\nString(Number($.EKEventStore.authorizationStatusForEntityType(0)))'
  try {
    const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
      timeout: 8000
    })
    const n = Number(String(stdout).trim())
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export async function probePermissions(): Promise<PermissionStatus[]> {
  if (process.platform !== 'darwin') {
    return buildPermissionStatuses(
      { accessibility: null, screen: null, calendar: null },
      process.platform
    )
  }
  let accessibility: boolean | null = null
  try {
    accessibility = systemPreferences.isTrustedAccessibilityClient(false)
  } catch {
    accessibility = null
  }
  let screen: string | null = null
  try {
    screen = systemPreferences.getMediaAccessStatus('screen')
  } catch {
    screen = null
  }
  const calendar = await readCalendarStatus()
  return buildPermissionStatuses({ accessibility, screen, calendar }, process.platform)
}

/** 就地申请：能弹系统框的弹，不能弹的直接返回跳转指引 */
export async function requestPermission(
  id: PermissionId
): Promise<{ fired: boolean; state: PermissionState; note?: string }> {
  if (process.platform !== 'darwin') {
    return { fired: false, state: 'unsupported', note: '当前系统不需要这类授权' }
  }
  if (id === 'accessibility') {
    // true = 让系统弹出「Frond 想控制这台电脑」对话框，带「打开系统设置」按钮
    const trusted = systemPreferences.isTrustedAccessibilityClient(true)
    return {
      fired: true,
      state: trusted ? 'granted' : 'denied',
      note: trusted ? undefined : '勾选后如未立即生效，请重启 Frond'
    }
  }
  if (id === 'calendar') {
    const { calendarService } = await import('../services/CalendarService')
    const { fired } = await calendarService.requestAccess()
    const state = classifyEventKitStatus(await readCalendarStatus())
    return {
      fired,
      state,
      note: fired ? '系统弹窗可能被其它窗口挡住，没看到就用「打开设置」' : undefined
    }
  }
  return { fired: false, state: 'unknown', note: '屏幕录制没有可编程申请口，请用「打开设置」' }
}

export async function openPermissionSettings(
  id: PermissionId | 'privacy'
): Promise<{ ok: boolean; error?: string }> {
  try {
    await shell.openExternal(settingsDeepLink(id))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export function isPermissionId(value: unknown): value is PermissionId {
  return typeof value === 'string' && (PERMISSION_IDS as string[]).includes(value)
}

export function registerPermissionsIpcHandlers(): void {
  typedHandle('permissions:probe', () => probePermissions())
  typedHandle('permissions:request', (_e, { id }) =>
    isPermissionId(id)
      ? requestPermission(id)
      : Promise.resolve({ fired: false, state: 'unknown' as PermissionState, note: '未知权限项' })
  )
  typedHandle('permissions:openSettings', async (_e, { id }) => {
    if (id !== 'privacy' && !isPermissionId(id)) {
      return { ok: false, error: '未知权限项' }
    }
    return openPermissionSettings(id)
  })
}
