import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * crash:* 三通道（opt-in 崩溃上报）：主进程 handler 极薄——归一化入参后
 * 透传 CrashReportService。这里冻结的是「通道注册 + 入参归一化」这两件事。
 */

const handlers = new Map<string, (event: unknown, req: unknown) => unknown>()

const crashMock = vi.hoisted(() => ({
  getStatus: vi.fn(() => ({ optIn: false, pendingCount: 2 })),
  setOptIn: vi.fn((enabled: boolean) => ({ optIn: enabled === true, pendingCount: 0 })),
  openIssueTemplate: vi.fn(() => ({ ok: true }))
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, req: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../../services/CrashReportService', () => ({ crashReport: crashMock }))

import { registerCrashIpcHandlers } from '../crash'

const invoke = async (channel: string, req: unknown): Promise<unknown> => {
  const h = handlers.get(channel)
  if (!h) throw new Error(`handler 未注册: ${channel}`)
  return await h({}, req)
}

beforeEach(() => {
  handlers.clear()
  vi.clearAllMocks()
  registerCrashIpcHandlers()
})

describe('crash:* IPC', () => {
  it('三条通道都注册', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'crash:getStatus',
      'crash:openIssueTemplate',
      'crash:setOptIn'
    ])
  })

  it('getStatus 透传 service 返回', async () => {
    const res = (await invoke('crash:getStatus', undefined)) as { pendingCount: number }
    expect(res.pendingCount).toBe(2)
    expect(crashMock.getStatus).toHaveBeenCalledTimes(1)
  })

  it('setOptIn 把 enabled 归一化为布尔再传', async () => {
    await invoke('crash:setOptIn', { enabled: true })
    expect(crashMock.setOptIn).toHaveBeenCalledWith(true)
    await invoke('crash:setOptIn', { enabled: 1 as unknown as boolean })
    expect(crashMock.setOptIn).toHaveBeenLastCalledWith(false)
  })

  it('openIssueTemplate 透传', async () => {
    const res = (await invoke('crash:openIssueTemplate', undefined)) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(crashMock.openIssueTemplate).toHaveBeenCalledTimes(1)
  })
})
