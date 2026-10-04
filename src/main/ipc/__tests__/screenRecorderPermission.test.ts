import { describe, it, expect, vi } from 'vitest'

/**
 * B57-12 回归钉：screen-recorder:requestPermission 的平台分支。
 * 旧实现在 Windows 打开的是 ms-settings:privacy-microphone（麦克风页，
 * 复制粘贴错误）——Windows 桌面应用的屏幕捕获没有系统级权限面板，
 * 打开任何设置页都只会误导用户。断言口径：
 *  1. win32 不调用 shell.openExternal，返回「无需权限」的说明
 *  2. darwin 打开系统设置的屏幕录制面板
 */

vi.mock('electron', () => ({
  shell: {},
  desktopCapturer: {},
  app: {},
  systemPreferences: {}
}))

const { openPermissionSettingsOutcome } = await import('../screenRecorder')

describe('requestPermission 平台分支（B57-12）', () => {
  it('win32：不打开任何设置页，提示屏幕捕获无需系统权限', async () => {
    const openExternal = vi.fn(async () => {})
    const r = await openPermissionSettingsOutcome('win32', openExternal)
    expect(openExternal).not.toHaveBeenCalled()
    expect(r.success).toBe(false)
    expect(r.message).toContain('无需')
  })

  it('darwin：打开系统设置的屏幕录制面板', async () => {
    const openExternal = vi.fn(async () => {})
    const r = await openPermissionSettingsOutcome('darwin', openExternal)
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining('Privacy_ScreenCapture'))
    expect(r.success).toBe(true)
  })
})
