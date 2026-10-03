// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installConsoleBridge, uninstallConsoleBridge } from '../consoleBridge'

/**
 * B52① 渲染端 console 桥：把 console.debug/log/info/warn/error 转发到主进程
 * LogService（经 window.api.log.add）。要点：
 * - Error 参数序列化为 {message, stack}
 * - 限流：5s 窗口超过上限丢弃并补一条摘要（防日志风暴打爆 IPC）
 * - 幂等：重复 install 只挂一次；桥自身错误绝不外抛
 */

beforeEach(() => {
  uninstallConsoleBridge()
  const add = vi.fn(async () => ({ ok: true }))
  ;(window as unknown as { api: unknown }).api = { log: { add } }
})

const addMock = (): ReturnType<typeof vi.fn> =>
  (window as unknown as { api: { log: { add: ReturnType<typeof vi.fn> } } }).api.log.add

describe('console 桥（B52①）', () => {
  it('console.error 带 Error：级别与 error 序列化正确', () => {
    installConsoleBridge()
    const err = new Error('boom')
    console.error('[SnippetList] 读取失败:', err)
    // add(level, scope, message, error?) —— scope 恒为 'renderer'
    const call = addMock().mock.calls[0] as unknown as [
      string,
      string,
      string,
      { message: string; stack: string } | undefined
    ]
    expect(call[0]).toBe('error')
    expect(call[1]).toBe('renderer')
    expect(call[2]).toContain('[SnippetList] 读取失败')
    expect(call[3]).toMatchObject({ message: 'boom' })
    expect(call[3]!.stack).toContain('Error: boom')
  })

  it('console.log/warn → info/warn', () => {
    installConsoleBridge()
    console.log('hello', 42)
    console.warn('careful')
    const calls = addMock().mock.calls as unknown as Array<[string, string, string]>
    expect(calls.map((c) => c[0])).toEqual(['info', 'warn'])
  })

  it('限流：风暴期丢弃并在窗口后补一条摘要', async () => {
    vi.useFakeTimers()
    installConsoleBridge()
    for (let i = 0; i < 60; i++) console.log('spam', i)
    const dropped = (addMock().mock.calls as unknown as Array<[string, string, string]>).filter(
      (c) => c[2].includes('丢弃')
    )
    expect(dropped.length).toBeLessThanOrEqual(1)
    // 窗口过后恢复转发
    vi.advanceTimersByTime(6000)
    console.log('after-window')
    const calls = addMock().mock.calls as unknown as Array<[string, string, string]>
    expect(calls[calls.length - 1]![2]).toContain('after-window')
    vi.useRealTimers()
  })

  it('幂等：install 两次不双发', () => {
    installConsoleBridge()
    installConsoleBridge()
    console.log('once')
    expect(addMock()).toHaveBeenCalledTimes(1)
  })
})
