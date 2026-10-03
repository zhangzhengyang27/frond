import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * globalKeys 订阅状态机回归（审计 P2 / B41 同族「全聋窗口」）：
 * maybeStop 在 uIOhook.stop() 完成后才置 started=false——期间新订阅走
 * ensureStarted 的 started 短路，误判监听仍在 → 新监听器全聋到下次退订重订。
 * 修复后 start/stop 走单操作队列：每个操作到队首时重查状态，串行化消除交错。
 */

const hookMock = vi.hoisted(() => {
  let pendingStop: Promise<void> | null = null
  let resolvePendingStop: (() => void) | null = null
  return {
    on: vi.fn(),
    start: vi.fn(async () => undefined),
    // 默认立即完成；armStopGate() 让下一次 stop 挂起，模拟 stop() 在飞
    stop: vi.fn(async () => {
      if (pendingStop) {
        const p = pendingStop
        pendingStop = null
        await p
      }
    }),
    armStopGate: () => {
      pendingStop = new Promise((r) => {
        resolvePendingStop = r
      })
    },
    resolveStop: () => resolvePendingStop?.()
  }
})

vi.mock('uiohook-napi', () => ({ uIOhook: hookMock }))

import { GlobalKeyHookService } from '../globalKeys'

beforeEach(() => {
  hookMock.on.mockClear()
  hookMock.start.mockClear()
  hookMock.stop.mockClear()
})

describe('globalKeys 订阅状态机（全聋窗口）', () => {
  it('stop 在飞时新订阅：等 stop 完成后真正重新 start（不聋）', async () => {
    const svc = new GlobalKeyHookService()
    const unA = svc.onKeydown(() => {})
    await vi.waitFor(() => expect(hookMock.start).toHaveBeenCalledTimes(1))

    // A 退订 → maybeStop 开始，stop() 挂起未完成
    hookMock.armStopGate()
    unA()
    await vi.waitFor(() => expect(hookMock.stop).toHaveBeenCalledTimes(1))

    // stop 在飞期间 B 订阅：必须等 stop 完成后重新 start（旧实现：started 仍为
    // true → 短路返回 → B 全聋）
    const unB = svc.onKeydown(() => {})
    hookMock.resolveStop()
    await vi.waitFor(() => expect(hookMock.start).toHaveBeenCalledTimes(2))
    unB()
    await vi.waitFor(() => expect(hookMock.stop).toHaveBeenCalledTimes(2))
  })

  it('start 在飞时全部退订：start 完成后回查无人订阅 → 自动 stop（不驻留）', async () => {
    const svc = new GlobalKeyHookService()
    const un = svc.onKeydown(() => {})
    un() // start 还没完成就全部退订
    await vi.waitFor(() => {
      expect(hookMock.start).toHaveBeenCalledTimes(1)
      expect(hookMock.stop).toHaveBeenCalledTimes(1)
    })
  })

  it('正常周期：订阅→start，退订→stop，可反复', async () => {
    const svc = new GlobalKeyHookService()
    for (let round = 1; round <= 3; round++) {
      const un = svc.onKeydown(() => {})
      await vi.waitFor(() => expect(hookMock.start).toHaveBeenCalledTimes(round))
      un()
      await vi.waitFor(() => expect(hookMock.stop).toHaveBeenCalledTimes(round))
    }
  })
})
