/**
 * Frond · 文件索引进程客户端（批5，R2 进程隔离）
 *
 * 主进程侧唯一入口：把 FileIndexService 的方法语义原样代理到
 * file-index-worker 独立进程（utilityProcess）。主线程从此零索引 SQL。
 *
 * 生命周期：
 * - 懒启动：首个 RPC 自动 spawn（argv 传 userData 路径，worker 不再依赖 electron app）
 * - 崩溃：拒绝全部在飞请求（query 侧捕获后走既有 mdfind 回退）→ 指数退避重启
 *   （1s→16s 共 5 次）→ 超限进降级态：query 返回 null、getStatus 报 error 形状、
 *   ensureStarted 允许重新拉起（恢复路径）
 */
import { join } from 'path'
import { app, utilityProcess } from 'electron'
import type { FileIndexHit, FileSearchMode } from '../modules/fileIndex/db'
import type { UnavailableRoot } from '../modules/fileIndex/scanner'
import {
  isFileIndexResponse,
  makeRequest,
  type FileIndexRequestType
} from './protocol'

export interface FileIndexStatusShape {
  status: 'disabled' | 'scanning' | 'ready' | 'capped' | 'error'
  files: number
  scopes: string[]
  lastFullScan: number | null
  error: string | null
  hidden: boolean
  unavailable: UnavailableRoot[]
}

export type FileSearchModeAlias = FileSearchMode

const MAX_RESTARTS = 5
const BASE_BACKOFF_MS = 1000
const RPC_TIMEOUT_MS = 10_000

const DEGRADED_STATUS: FileIndexStatusShape = {
  status: 'error',
  files: 0,
  scopes: [],
  lastFullScan: null,
  error: '索引进程不可用（反复退出），文件搜索已降级为系统检索',
  hidden: true,
  unavailable: []
}

/** 便于测试注入的进程抽象（对齐 utilityProcess 子进程的必要面） */
export interface WorkerLike {
  postMessage(message: unknown): void
  on(event: 'message', listener: (m: unknown) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
  kill(): void
}

type SpawnFn = () => WorkerLike

/** 主进程默认实现：userData 路径在这里取（worker 自身不依赖 electron app） */
function defaultSpawn(): WorkerLike {
  const child = utilityProcess.fork(join(__dirname, 'file-index-worker.js'), [app.getPath('userData')], {
    serviceName: 'file-index-worker'
  })
  return child as unknown as WorkerLike
}

interface PendingEntry {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class FileIndexClient {
  private worker: WorkerLike | null = null
  private pending = new Map<number, PendingEntry>()
  private seq = 0
  private restarts = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private degraded = false

  constructor(private readonly spawnFn: SpawnFn = defaultSpawn) {}

  private ensureWorker(): void {
    if (this.worker || this.restartTimer) return
    this.spawnWorker()
  }

  private spawnWorker(): void {
    let worker: WorkerLike
    try {
      worker = this.spawnFn()
    } catch (error) {
      // 启动失败（原生模块缺失等）与运行中退出走同一退避/降级路径
      console.error('[FileIndex] 索引进程启动失败:', (error as Error).message)
      this.onWorkerExit()
      return
    }
    worker.on('message', (m: unknown) => {
      if (!isFileIndexResponse(m)) return
      const p = this.pending.get(m.id)
      if (!p) return
      this.pending.delete(m.id)
      clearTimeout(p.timer)
      if (m.ok) p.resolve(m.result)
      else p.reject(new Error(m.error ?? 'file-index worker error'))
    })
    worker.on('exit', () => {
      this.worker = null
      this.onWorkerExit()
    })
    this.worker = worker
  }

  private onWorkerExit(): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('file-index worker exited'))
    }
    this.pending.clear()
    if (this.restarts >= MAX_RESTARTS) {
      this.degraded = true
      console.error('[FileIndex] 索引进程反复退出，已降级为系统检索（mdfind）')
      return
    }
    const delay = BASE_BACKOFF_MS * 2 ** this.restarts
    this.restarts += 1
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.spawnWorker()
    }, delay)
  }

  private rpc<T>(type: FileIndexRequestType, payload?: unknown): Promise<T> {
    this.ensureWorker()
    const worker = this.worker
    if (!worker) return Promise.reject(new Error('file-index worker unavailable'))
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`file-index rpc ${type} timeout`))
      }, RPC_TIMEOUT_MS)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      worker.postMessage(makeRequest(id, type, payload))
    })
  }

  async ensureStarted(): Promise<void> {
    if (this.degraded) {
      // 恢复路径：调用方（index.ts 启动 / fileSearch 每次查询）给一次重新拉起的机会
      this.degraded = false
      this.restarts = 0
    }
    try {
      await this.rpc('ensureStarted')
    } catch (error) {
      // fire-and-forget 语义（对齐旧 fileIndex.ensureStarted 的 void 调用）：失败不外抛
      console.error('[FileIndex] ensureStarted 失败:', (error as Error).message)
    }
  }

  async getStatus(): Promise<FileIndexStatusShape> {
    if (this.degraded) return DEGRADED_STATUS
    try {
      return await this.rpc<FileIndexStatusShape>('getStatus')
    } catch {
      return DEGRADED_STATUS
    }
  }

  async getScopes(): Promise<string[]> {
    if (this.degraded) return []
    try {
      return await this.rpc<string[]>('getScopes')
    } catch {
      return []
    }
  }

  async setScopes(dirs: string[]): Promise<void> {
    try {
      await this.rpc('setScopes', dirs)
    } catch (error) {
      console.error('[FileIndex] setScopes 失败:', (error as Error).message)
    }
  }

  async rebuild(): Promise<void> {
    try {
      await this.rpc('rebuild')
    } catch (error) {
      console.error('[FileIndex] rebuild 失败:', (error as Error).message)
    }
  }

  async setHidden(value: boolean): Promise<void> {
    try {
      await this.rpc('setHidden', value)
    } catch (error) {
      console.error('[FileIndex] setHidden 失败:', (error as Error).message)
    }
  }

  /**
   * 索引查询；未就绪/零就绪态/进程死亡/超时一律返回 null——
   * fileSearch 据此走既有 mdfind/PowerShell 回退（与旧同步语义一致）
   */
  async query(tokens: string[], mode: FileSearchMode, limit: number): Promise<FileIndexHit[] | null> {
    if (this.degraded) return null
    try {
      return await this.rpc<FileIndexHit[]>('query', { tokens, mode, limit })
    } catch {
      return null
    }
  }
}

export const fileIndexClient = new FileIndexClient()
