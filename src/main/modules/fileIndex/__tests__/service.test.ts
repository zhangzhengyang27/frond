import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { WatchBackend } from '../watcher'

/**
 * FileIndexService 状态机回归（B47）：
 * - watcher 启动竞态：watch() pending 期间被 stopWatcher（改范围/重建），resolve 后
 *   必须反注册旧 watcher，而不是收养它、杀掉新一轮的 watcher
 * - rearmOnce 补扫失败必须有兜底：worker 里 unhandledRejection = utilityProcess 退出
 * - 两处都通过可控 fake backend / 可控 fullScan 驱动，不依赖平台事件源
 */

// scanner 只替换 fullScan（默认实现 = 真扫，供各测试覆写），其余（rescanDir 等）保真
vi.mock('../scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scanner')>()
  return { ...actual, fullScan: vi.fn() }
})

// 事件源后端替换为可控 deferred：watch() 的 promise 由测试手动 resolve
vi.mock('../watcher', () => ({ activeBackend: vi.fn(() => fakeBackend) }))

const watchCalls: Array<{ scopes: string[]; resolve: (stop: () => void) => void }> = []
const fakeBackend: WatchBackend = {
  name: 'fsevents',
  watch(scopes) {
    return new Promise((resolve) => {
      watchCalls.push({ scopes, resolve })
    })
  }
}

import { FileIndexService } from '../service'
import { fullScan } from '../scanner'
import { normPath } from '../paths'

const fullScanMock = vi.mocked(fullScan)
let realFullScan: typeof fullScan

beforeAll(async () => {
  realFullScan = (await vi.importActual<typeof import('../scanner')>('../scanner')).fullScan
  // B47 状态机与平台无关，但 enabled getter 在 Linux 是 disabled（产品语义：无自建
  // 索引，回退系统检索）——单测里强制启用，让 Linux CI 也保有这条覆盖
  // （此前 Linux/Windows CI 红 Twin 的根因之一：enable=false 时 ensureStarted 直接返回）
  vi.spyOn(FileIndexService.prototype, 'enabled', 'get').mockReturnValue(true)
})

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'frond-fidx-svc-'))
  watchCalls.length = 0
  fullScanMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  try {
    rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows：file-index.db 句柄还开着时 rm 报 EPERM——临时目录留给系统清理，
    // 不能为删目录让整个 suite 红（CI Windows 红 Twin 根因之二）
  }
  delete process.env.FROND_FILE_INDEX_SCOPES
})

/** 微任务冲刷：让 void 掉的 async 链（runFullScan → startWatcher）走完 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('FileIndexService watcher 启动竞态（B47-①）', () => {
  it('watch pending 期间被 stopWatcher 取消后，resolve 时反注册旧 watcher、收养新一轮', async () => {
    process.env.FROND_FILE_INDEX_SCOPES = JSON.stringify([root])
    mkdirSync(join(root, 'gone')) // 第二轮范围：真实存在，让 setScopes 的绝对路径过滤放行
    const svc = new FileIndexService()

    // 首启：count=0 → 走 mocked fullScan → ready → startWatcher（watch#1 pending）
    fullScanMock.mockImplementation(async (opts) => realFullScan({ ...opts, roots: [root] }))
    await svc.ensureStarted(root)
    await vi.waitFor(() => expect(watchCalls.length).toBe(1), { timeout: 4000 })
    // watch 收到的是 env/入参的**原生路径**（normPath 只做内部身份比较，不过 watch 边界；
    // Windows 上是反斜杠——断言写原生形态，勿用 normPath 期望值）
    expect(watchCalls[0]!.scopes).toEqual([root])

    // 改范围：stopWatcher（此时 watch#1 仍未 resolve，无处可停）→ rebuild → startWatcher（watch#2 pending）
    const other = join(root, 'gone')
    svc.setScopes([other]) // 同步接口；rebuild 是内部 void 链，下方 waitFor 等它的收尾
    await vi.waitFor(() => expect(watchCalls.length).toBe(2), { timeout: 4000 })
    expect(watchCalls[1]!.scopes).toEqual([other])

    const stopOld = vi.fn()
    const stopNew = vi.fn()
    watchCalls[0]!.resolve(stopOld) // 旧 pending 此刻才 resolve
    await flush()
    watchCalls[1]!.resolve(stopNew)
    await flush()

    // 正确语义：旧 watcher 立刻反注册（其范围已过时），新一轮 watcher 被收养
    expect(stopOld).toHaveBeenCalled()
    expect(stopNew).not.toHaveBeenCalled()
  })
})

describe('FileIndexService rearmOnce 补扫失败兜底（B47-②）', () => {
  it('补扫 fullScan 抛错不产生 unhandledRejection，状态保持 ready 且保留重试账', async () => {
    // 全程假时钟：rearm 定时器必须在假时钟下创建，advance 才推得动（真实 60s 等不起）。
    // shouldAdvanceTime 让假时钟与真实时间同步走——真实 fs I/O（fullScan/DB）照常完成，
    // 纯假时钟在 Windows CI 上会让「等 ready」永远等不到（CI Windows 红 Twin 根因之三）
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // 假时钟下的状态等待：advance 会向事件循环让步，真实 fs I/O 的完成回调照常泵入
    const waitUntil = async (cond: () => boolean): Promise<void> => {
      for (let i = 0; i < 500 && !cond(); i++) await vi.advanceTimersByTimeAsync(20)
      expect(cond()).toBe(true)
    }

    process.env.FROND_FILE_INDEX_SCOPES = JSON.stringify([root])
    const gone = join(root, 'gone')
    mkdirSync(gone) // 真实存在 → partitionReadable 判可读 → rearm 会真的尝试补扫
    const svc = new FileIndexService()

    // 首扫成功但报告 gone 不可读（模拟外接卷跳过）→ scheduleRearm 起轮询
    fullScanMock.mockImplementation(async (opts) => {
      const r = await realFullScan({ ...opts, roots: [root] })
      return { ...r, unavailable: [{ root: normPath(gone), reason: '模拟不可读' }] }
    })
    await svc.ensureStarted(root)
    await waitUntil(() => svc.getStatus().status === 'ready')
    expect(svc.getStatus().unavailable).toHaveLength(1)

    let unhandled: unknown = null
    const onUnhandled = (reason: unknown): void => {
      unhandled = reason
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      // 下一轮补扫：fullScan 这次抛错（DB/磁盘故障在 worker 里 = 不能让进程死）
      fullScanMock.mockRejectedValueOnce(new Error('模拟补扫失败'))
      await vi.advanceTimersByTimeAsync(60_000) // REARM_MS
      await flush()

      expect(unhandled).toBeNull()
      expect(svc.getStatus().status).toBe('ready')
      // 失败的范围保留在 unavailable 里，下一轮继续重试（不能静默丢账）
      expect(svc.getStatus().unavailable.map((u) => u.root)).toContain(normPath(gone))
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})
