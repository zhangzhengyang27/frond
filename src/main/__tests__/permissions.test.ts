import { describe, it, expect } from 'vitest'
import {
  classifyEventKitStatus,
  classifyMediaStatus,
  buildPermissionStatuses,
  settingsDeepLink,
  isPermissionId,
  type RawPermissionSignals
} from '../ipc/permissions'

/**
 * macOS 权限面板（P-3.5）纯函数测试。
 *
 * 要拦的是「把状态读错档」这一类：权限档位错了界面的「已授权」就是假话，
 * 用户会以为功能坏了。EventKit 的枚举尤其容易记错（2 是 denied 不是 authorized，
 * CalendarService 里就为此留过一条注释）。
 */

const allGranted: RawPermissionSignals = { accessibility: true, screen: 'granted', calendar: 3 }

describe('classifyEventKitStatus', () => {
  it('0/1/2/3 各归其位，读不到算 unknown', () => {
    expect(classifyEventKitStatus(3)).toBe('granted')
    expect(classifyEventKitStatus(2)).toBe('denied')
    expect(classifyEventKitStatus(1)).toBe('restricted')
    expect(classifyEventKitStatus(0)).toBe('not-determined')
    expect(classifyEventKitStatus(null)).toBe('unknown')
    expect(classifyEventKitStatus(9)).toBe('unknown')
  })
})

describe('classifyMediaStatus', () => {
  it('五个已知取值 + 未知取值不猜', () => {
    expect(classifyMediaStatus('granted')).toBe('granted')
    expect(classifyMediaStatus('denied')).toBe('denied')
    expect(classifyMediaStatus('restricted')).toBe('restricted')
    expect(classifyMediaStatus('not-determined')).toBe('not-determined')
    expect(classifyMediaStatus('unknown')).toBe('unknown')
    expect(classifyMediaStatus(null)).toBe('unknown')
  })
})

describe('buildPermissionStatuses', () => {
  it('darwin：三项各自成档，全授权时不塞提示文案', () => {
    const rows = buildPermissionStatuses(allGranted, 'darwin')
    expect(rows.map((r) => r.id)).toEqual(['accessibility', 'calendar', 'screenRecording'])
    expect(rows.every((r) => r.state === 'granted')).toBe(true)
    expect(rows.find((r) => r.id === 'screenRecording')?.note).toBeUndefined()
  })

  it('辅助功能读成 false 就是 denied，不是「未确定」', () => {
    const rows = buildPermissionStatuses({ ...allGranted, accessibility: false }, 'darwin')
    expect(rows[0].state).toBe('denied')
  })

  it('信号读不到（null）→ unknown，界面不得报「已授权」', () => {
    const rows = buildPermissionStatuses(
      { accessibility: null, screen: null, calendar: null },
      'darwin'
    )
    expect(rows.map((r) => r.state)).toEqual(['unknown', 'unknown', 'unknown'])
  })

  it('非 darwin 一律 unsupported：Windows 没有这三类 TCC 授权，不该显示「未授权」吓人', () => {
    const rows = buildPermissionStatuses(
      { accessibility: null, screen: null, calendar: null },
      'win32'
    )
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.state === 'unsupported' && !r.canRequest)).toBe(true)
    expect(rows[0].note).toContain('不需要')
  })

  it('屏幕录制没有可编程申请口：canRequest=false 且带「重启」指引', () => {
    const rows = buildPermissionStatuses(
      { accessibility: true, screen: 'not-determined', calendar: 3 },
      'darwin'
    )
    const screen = rows.find((r) => r.id === 'screenRecording')
    expect(screen?.canRequest).toBe(false)
    expect(screen?.note).toContain('重启')
    // 另两项能就地申请
    expect(rows.find((r) => r.id === 'accessibility')?.canRequest).toBe(true)
    expect(rows.find((r) => r.id === 'calendar')?.canRequest).toBe(true)
  })
})

describe('settingsDeepLink / isPermissionId', () => {
  it('三项各有隐私面板锚点，未知 id 回落隐私总览', () => {
    expect(settingsDeepLink('accessibility')).toBe(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    )
    expect(settingsDeepLink('calendar')).toContain('Privacy_Calendars')
    expect(settingsDeepLink('screenRecording')).toContain('Privacy_ScreenCapture')
    expect(settingsDeepLink('privacy')).toBe(
      'x-apple.systempreferences:com.apple.preference.security?Privacy'
    )
  })

  it('IPC 入口按白名单收 id，别的一律不认', () => {
    expect(isPermissionId('calendar')).toBe(true)
    expect(isPermissionId('microphone')).toBe(false)
    expect(isPermissionId(undefined)).toBe(false)
    expect(isPermissionId('ACCESSIBILITY')).toBe(false)
  })
})
