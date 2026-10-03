import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * B52① 渲染端日志通道：log:add 把渲染端的 console 事件写进主进程 LogService
 * 环形缓冲——此前渲染端 172 处 console.* 全部蒸发（preload 的 log 命名空间只有
 * export/getMode/setMode），日志导出对渲染端不可见。
 */

const handlers = new Map<string, (event: unknown, req: unknown) => unknown>()

const logMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  getMode: vi.fn(() => 'local'),
  setMode: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, req: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  },
  dialog: { showMessageBox: vi.fn() },
  shell: { showItemInFolder: vi.fn() }
}))

vi.mock('../../services/LogService', () => ({ log: logMock }))

import { registerLogIpcHandlers } from '../log'

const invoke = async (channel: string, req: unknown): Promise<unknown> => {
  const h = handlers.get(channel)
  if (!h) throw new Error(`handler 未注册: ${channel}`)
  return await h({}, req)
}

beforeEach(() => {
  handlers.clear()
  vi.clearAllMocks()
  registerLogIpcHandlers()
})

describe('log:add 渲染端日志落主进程（B52①）', () => {
  it('error 级：scope/message 传给 LogService.error，error 只带 message+stack', async () => {
    const res = (await invoke('log:add', {
      level: 'error',
      scope: 'renderer',
      message: '[SnippetList] 读取片段列表失败',
      error: { message: 'boom', stack: 'Error: boom\n    at x' }
    })) as { ok: boolean }
    expect(res.ok).toBe(true)
    expect(logMock.error).toHaveBeenCalledWith('renderer', '[SnippetList] 读取片段列表失败', {
      message: 'boom',
      stack: 'Error: boom\n    at x'
    })
  })

  it('debug/info/warn 分别路由', async () => {
    await invoke('log:add', { level: 'debug', scope: 'renderer', message: 'd' })
    await invoke('log:add', { level: 'info', scope: 'renderer', message: 'i' })
    await invoke('log:add', { level: 'warn', scope: 'renderer', message: 'w' })
    expect(logMock.debug).toHaveBeenCalledWith('renderer', 'd', undefined)
    expect(logMock.info).toHaveBeenCalledWith('renderer', 'i')
    expect(logMock.warn).toHaveBeenCalledWith('renderer', 'w')
  })

  it('未知 level 拒绝（不写库不抛）', async () => {
    const res = (await invoke('log:add', {
      level: 'verbose',
      scope: 'renderer',
      message: 'x'
    })) as { ok: boolean }
    expect(res.ok).toBe(false)
    expect(logMock.error).not.toHaveBeenCalled()
  })
})
