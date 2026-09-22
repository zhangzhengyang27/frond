// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { useUsageBoost } from '../useUsageBoost'
import type { CommandEntry } from '@shared/commands'

/**
 * V4 P0-3：frecency 全类型加权。
 * - module 动作：entry.key 与裸 moduleId 双 key 回落（旧记录格式兼容）
 * - 其他类型：按 entry.key 记录即加权（app/syscmd/quicklink:…）
 * - 无记录 → 0
 */

const moduleEntry: CommandEntry = {
  key: 'module:pomodoro',
  icon: 'timer',
  title: '番茄钟',
  subtitle: '',
  badge: '功能',
  action: { type: 'module', moduleId: 'pomodoro', path: '/pomodoro' }
}

const appEntry: CommandEntry = {
  key: 'app:/Applications/Foo.app',
  icon: 'app',
  title: 'Foo',
  subtitle: '',
  badge: '应用',
  action: { type: 'app', path: '/Applications/Foo.app' }
}

const sysEntry: CommandEntry = {
  key: 'syscmd:system.lock',
  icon: 'lock',
  title: '锁定屏幕',
  subtitle: '',
  badge: '系统',
  action: { type: 'system', cmdId: 'system.lock' }
}

function mockUsageApi(
  stats: Array<{ moduleId: string; useCount: number; usedAt: number }>
): void {
  ;(window as unknown as { api: unknown }).api = {
    usage: { getStats: async () => stats }
  }
}

describe('useUsageBoost 全类型 frecency（V4 P0-3）', () => {
  beforeEach(() => {
    mockUsageApi([
      { moduleId: 'app:/Applications/Foo.app', useCount: 8, usedAt: 300 },
      { moduleId: 'pomodoro', useCount: 16, usedAt: 200 },
      { moduleId: 'syscmd:system.lock', useCount: 2, usedAt: 100 }
    ])
  })

  it('module 动作按裸 moduleId 命中（旧记录格式兼容）', async () => {
    const { refresh, boost } = useUsageBoost()
    await refresh()
    expect(boost(moduleEntry)).toBeGreaterThan(0)
  })

  it('非 module 动作按 entry.key 命中（app / system）', async () => {
    const { refresh, boost } = useUsageBoost()
    await refresh()
    expect(boost(appEntry)).toBeGreaterThan(0)
    expect(boost(sysEntry)).toBeGreaterThan(0)
  })

  it('新近记录的加权高于陈旧记录（rank 0 > rank 2，同量级频次下）', async () => {
    const { refresh, boost } = useUsageBoost()
    await refresh()
    expect(boost(appEntry)).toBeGreaterThan(boost(sysEntry))
  })

  it('无记录的条目加权为 0', async () => {
    const { refresh, boost } = useUsageBoost()
    await refresh()
    expect(
      boost({
        key: 'app:/Applications/Never.app',
        icon: 'app',
        title: 'Never',
        subtitle: '',
        badge: '应用',
        action: { type: 'app', path: '/Applications/Never.app' }
      })
    ).toBe(0)
  })

  it('读取失败时不加权（不抛错）', async () => {
    ;(window as unknown as { api: unknown }).api = {
      usage: {
        getStats: async () => {
          throw new Error('db closed')
        }
      }
    }
    const { refresh, boost } = useUsageBoost()
    await expect(refresh()).resolves.toBeUndefined()
    expect(boost(appEntry)).toBe(0)
  })
})
