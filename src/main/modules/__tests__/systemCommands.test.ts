import { describe, it, expect } from 'vitest'
import {
  MEDIA_KEYS,
  VOLUME_PRESETS,
  B3_COMMAND_IDS,
  getSystemCommandIds,
  getWindowActionIds,
  volumeIdOf,
  volumePercentOf,
  mediaKeyData1
} from '../systemCommands'
import { SYSTEM_CMD_META, WINDOW_CMD_META } from '@shared/commands'

/**
 * B3 系统命令补齐：纯逻辑单测。
 * - 音量档位映射（id ↔ 百分比，只认预设档位）
 * - 媒体键 data1 编码（NSSystemDefined 事件位运算）
 * - 命令 id 注册完整性（对照 Raycast System Actions 23 条清单的覆盖表）
 */

describe('音量档位映射', () => {
  it('预设档位为 Raycast 同款五档', () => {
    expect([...VOLUME_PRESETS]).toEqual([0, 25, 50, 75, 100])
  })

  it('volumeIdOf / volumePercentOf 双向往返', () => {
    for (const pct of VOLUME_PRESETS) {
      const id = volumeIdOf(pct)
      expect(id).toBe(`system.volume${pct}`)
      expect(volumePercentOf(id)).toBe(pct)
    }
  })

  it('非预设档位一律拒绝（防脚本拼出任意数字）', () => {
    expect(volumePercentOf('system.volume30')).toBeNull()
    expect(volumePercentOf('system.volume150')).toBeNull()
    expect(volumePercentOf('system.volume-25')).toBeNull()
    expect(volumePercentOf('system.volume')).toBeNull()
    expect(volumePercentOf('system.volumex')).toBeNull()
    expect(volumePercentOf('system.lock')).toBeNull()
    expect(volumePercentOf('')).toBeNull()
  })
})

describe('媒体键 data1 编码', () => {
  it('NX 键码对齐 IOKit ev_keymap.h（PLAY=16 / FAST=19 / REWIND=20）', () => {
    expect(MEDIA_KEYS.playPause).toBe(16)
    expect(MEDIA_KEYS.nextTrack).toBe(19)
    expect(MEDIA_KEYS.previousTrack).toBe(20)
  })

  it('data1 = 键码<<16 | 键状态<<8（0xA 按下 / 0xB 抬起）', () => {
    expect(mediaKeyData1(16, true)).toBe((16 << 16) | (0xa << 8))
    expect(mediaKeyData1(16, false)).toBe((16 << 16) | (0xb << 8))
    expect(mediaKeyData1(19, true)).toBe((19 << 16) | (0xa << 8))
    expect(mediaKeyData1(20, false)).toBe((20 << 16) | (0xb << 8))
  })
})

describe('B3 命令 id 注册完整性', () => {
  it('B3 共 13 条新命令 id（媒体 3 + 音量 5 + 退出 2 + 隐藏 1 + 通知 1 + 弹盘 1）', () => {
    expect(B3_COMMAND_IDS).toHaveLength(13)
    expect(new Set(B3_COMMAND_IDS).size).toBe(13)
  })

  it('getSystemCommandIds 包含全部 B3 命令', () => {
    const ids = getSystemCommandIds()
    for (const id of B3_COMMAND_IDS) {
      expect(ids).toContain(id)
    }
  })

  /**
   * Raycast System Actions 23 条清单覆盖表：
   * frondId 为 null = 本批次未实现（登记未尽项），其余必须已注册。
   */
  const RAYCAST_SYSTEM_ACTIONS: Array<{ action: string; frondId: string | null }> = [
    { action: 'Lock Screen 锁定屏幕', frondId: 'system.lock' },
    { action: 'Sleep 睡眠', frondId: 'system.sleep' },
    { action: 'Restart 重启', frondId: 'system.restart' },
    { action: 'Shut Down 关机', frondId: 'system.shutdown' },
    { action: 'Log Out 退出登录', frondId: null }, // 未实现（登记未尽项）
    { action: 'Empty Trash 清空废纸篓', frondId: 'system.emptyTrash' },
    { action: 'Toggle Mute 静音切换', frondId: 'system.muteToggle' },
    { action: 'Set Volume to 0%', frondId: 'system.volume0' },
    { action: 'Set Volume to 25%', frondId: 'system.volume25' },
    { action: 'Set Volume to 50%', frondId: 'system.volume50' },
    { action: 'Set Volume to 75%', frondId: 'system.volume75' },
    { action: 'Set Volume to 100%', frondId: 'system.volume100' },
    { action: 'Play / Pause 播放暂停', frondId: 'system.playPause' },
    { action: 'Next 下一首', frondId: 'system.nextTrack' },
    { action: 'Previous 上一首', frondId: 'system.previousTrack' },
    { action: 'Quit All Applications 退出所有应用', frondId: 'system.quitAllApps' },
    {
      action: 'Quit All Except Frontmost 退出其他应用',
      frondId: 'system.quitAllAppsExceptFrontmost'
    },
    { action: 'Hide All Except Frontmost 隐藏其他窗口', frondId: 'system.hideAllExceptFrontmost' },
    { action: 'Show Desktop 显示桌面', frondId: 'system.showDesktop' },
    { action: 'Show Screen Saver 屏幕保护', frondId: 'system.screensaver' },
    { action: 'Dismiss Notifications 清除通知', frondId: 'system.dismissNotifications' },
    { action: 'Eject All Disks 弹出所有磁盘', frondId: 'system.ejectAllDisks' },
    { action: 'Hide All Apps 隐藏所有窗口', frondId: 'system.hideAll' }
  ]

  it('覆盖表除登记项外全部已注册（22/23）', () => {
    const ids = new Set(getSystemCommandIds())
    const unregistered = RAYCAST_SYSTEM_ACTIONS.filter(
      (row) => row.frondId !== null && !ids.has(row.frondId)
    )
    expect(unregistered).toEqual([])
    expect(RAYCAST_SYSTEM_ACTIONS.filter((row) => row.frondId === null)).toHaveLength(1)
  })
})

describe('系统/窗口命令元数据防漂移（V4）', () => {
  it('getSystemCommandIds 全部 id 都有 SYSTEM_CMD_META（否则胶囊动态清单缺展示文案）', () => {
    for (const id of getSystemCommandIds()) {
      expect(SYSTEM_CMD_META[id], `SYSTEM_CMD_META 缺少 ${id}`).toBeDefined()
    }
  })

  it('getWindowActionIds 全部 id 都有 WINDOW_CMD_META（否则胶囊动态清单缺展示文案）', () => {
    for (const id of getWindowActionIds()) {
      expect(WINDOW_CMD_META[id], `WINDOW_CMD_META 缺少 ${id}`).toBeDefined()
    }
  })

  it('shared 元数据不含主进程已不存在的死条目', () => {
    const ids = new Set([...getSystemCommandIds(), ...getWindowActionIds()])
    const dead = Object.keys({ ...SYSTEM_CMD_META, ...WINDOW_CMD_META }).filter(
      (id) => !ids.has(id)
    )
    expect(dead).toEqual([])
  })
})
