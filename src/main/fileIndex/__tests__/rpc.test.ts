import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  makeRequest,
  makeResponse,
  makeLogEvent,
  isFileIndexRequest,
  isFileIndexResponse,
  isFileIndexWorkerEvent
} from '../protocol'
import { FileIndexClient, RPC_TIMEOUT_MS, REBUILD_RPC_TIMEOUT_MS, type WorkerLike } from '../client'

describe('fileIndex RPC 协议（批5）', () => {
  it('信封构造与类型守卫往返', () => {
    const req = makeRequest(1, 'query', { tokens: ['a'] })
    expect(isFileIndexRequest(req)).toBe(true)
    expect(isFileIndexRequest({ id: 'x', type: 'query' })).toBe(false)
    expect(isFileIndexRequest({ id: 2, type: 'nope' })).toBe(false)

    const res = makeResponse(1, true, [1, 2])
    expect(isFileIndexResponse(res)).toBe(true)
    expect(isFileIndexResponse({ id: 1 })).toBe(false)

    const ev = makeLogEvent('error', 'boom')
    expect(isFileIndexWorkerEvent(ev)).toBe(true)
    expect(isFileIndexWorkerEvent({ event: 'status' })).toBe(false)
  })
})

class FakeWorker extends EventEmitter implements WorkerLike {
  sent: unknown[] = []
  postMessage(message: unknown): void {
    this.sent.push(message)
  }
  kill(): void {
    /* no-op */
  }
}

describe('FileIndexClient 生命周期（批5）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const makeSpawn = () => {
    const workers: FakeWorker[] = []
    const spawn = vi.fn((): WorkerLike => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })
    return { spawn, workers }
  }

  const respondOk = (worker: WorkerLike, id: number, result: unknown): void => {
    ;(worker as unknown as EventEmitter).emit('message', makeResponse(id, true, result))
  }

  it('信封外：正常 RPC 请求带自增 id，响应按 id 配对', async () => {
    const { spawn, workers } = makeSpawn()
    const client = new FileIndexClient(spawn)
    const p1 = client.query(['a'], 'name', 5)
    const p2 = client.getStatus()
    expect(workers.length).toBe(1)
    const sent1 = workers[0]!.sent[0] as { id: number; type: string }
    const sent2 = workers[0]!.sent[1] as { id: number; type: string }
    expect(sent1.type).toBe('query')
    expect(sent2.type).toBe('getStatus')
    expect(sent2.id).toBe(sent1.id + 1)
    respondOk(workers[0]!, sent1.id, [{ path: '/x', name: 'x', parent: '/x', score: 1 }])
    respondOk(workers[0]!, sent2.id, { status: 'ready', files: 0 })
    await expect(p1).resolves.toHaveLength(1)
    await expect(p2).resolves.toMatchObject({ status: 'ready' })
  })

  it('worker 退出：在飞查询按回退语义得 null，退避后自动重启恢复', async () => {
    const { spawn, workers } = makeSpawn()
    const client = new FileIndexClient(spawn)
    const p = client.query(['a'], 'name', 5)
    ;(workers[0] as unknown as EventEmitter).emit('exit', 1)
    // 客户端契约：query 永不 reject——worker 死亡 = 未就绪 = null → fileSearch 走 mdfind 回退
    await expect(p).resolves.toBeNull()
    expect(spawn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000) // 第一次退避 1s
    expect(spawn).toHaveBeenCalledTimes(2)
    const p2 = client.query(['b'], 'name', 5)
    const sent = workers[1]!.sent[0] as { id: number; type: string }
    respondOk(workers[1]!, sent.id, [])
    await expect(p2).resolves.toEqual([])
  })

  it('连续 6 次退出后进入降级态：query 返回 null、getStatus 报 error、不再 spawn', async () => {
    const { spawn, workers } = makeSpawn()
    const client = new FileIndexClient(spawn)
    void client.getStatus() // 触发首启（在飞请求会随退出被拒绝）
    for (let i = 0; i < 6; i++) {
      ;(workers[workers.length - 1] as unknown as EventEmitter).emit('exit', 1)
      await vi.advanceTimersByTimeAsync(1000 * 2 ** Math.min(i, 4))
    }
    expect(spawn).toHaveBeenCalledTimes(6) // 首启 + 5 次重启
    expect(await client.query(['a'], 'name', 5)).toBeNull()
    const status = await client.getStatus()
    expect(status.status).toBe('error')
    expect(status.error).toContain('降级')
    expect(spawn).toHaveBeenCalledTimes(6) // 降级后不再自动 spawn
  })

  it('降级后 ensureStarted 走恢复路径重新拉起', async () => {
    const { spawn, workers } = makeSpawn()
    const client = new FileIndexClient(spawn)
    void client.getStatus()
    for (let i = 0; i < 6; i++) {
      ;(workers[workers.length - 1] as unknown as EventEmitter).emit('exit', 1)
      await vi.advanceTimersByTimeAsync(1000 * 2 ** Math.min(i, 4))
    }
    const p = client.ensureStarted()
    await vi.advanceTimersByTimeAsync(0)
    expect(spawn).toHaveBeenCalledTimes(7) // 降级态被重置，重新 spawn
    const sent = workers[workers.length - 1]!.sent[0] as { id: number; type: string }
    expect(sent.type).toBe('ensureStarted')
    respondOk(workers[workers.length - 1]!, sent.id, null)
    await expect(p).resolves.toBeUndefined()
  })

  it('RPC 超时：query 超时返回 null（回退语义）', async () => {
    const { spawn, workers } = makeSpawn()
    const client = new FileIndexClient(spawn)
    const p = client.query(['a'], 'name', 5)
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(p).resolves.toBeNull()
    expect(workers.length).toBe(1)
  })

  it('rebuild 不受 10s 默认超时约束（分钟级全量扫描不能假失败，B47③）', async () => {
    const { spawn } = makeSpawn()
    const client = new FileIndexClient(spawn)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      void client.rebuild() // worker 不回包（模拟扫描仍在跑）
      await vi.advanceTimersByTimeAsync(RPC_TIMEOUT_MS)
      // 10s 处绝不报「rebuild 失败」——那是假失败：worker 还在扫，日志却记账失败，
      // 诱导用户再点一次 rebuild 打断后台扫描
      expect(errSpy).not.toHaveBeenCalledWith(expect.stringContaining('rebuild 失败'))
      // 超时上限仍然存在（防 worker 假活挂死 IPC）：REBUILD_RPC_TIMEOUT_MS 处会报
      await vi.advanceTimersByTimeAsync(REBUILD_RPC_TIMEOUT_MS)
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('rebuild 失败'),
        expect.anything()
      )
    } finally {
      errSpy.mockRestore()
    }
  })

  it('ensureStarted 在 worker 已存活时不再发 RPC（fileSearch 每查询都调，不能白付一趟，B53-12）', async () => {
    const { spawn, workers } = makeSpawn()
    const client = new FileIndexClient(spawn)
    const p1 = client.query(['a'], 'name', 5)
    const sent1 = workers[0]!.sent[0] as { id: number }
    respondOk(workers[0]!, sent1.id, [])
    await p1
    const sentBefore = workers[0]!.sent.length
    await client.ensureStarted()
    expect(workers[0]!.sent.length).toBe(sentBefore)
  })
})
