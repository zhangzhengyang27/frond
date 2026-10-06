/**
 * Frond · 全局按键监听服务（M5.1 两段式热键与片段文本扩展的共享基础设施）
 *
 * uiohook-napi（N-API 预编译，无需 electron-rebuild）监听系统级按键。
 * - 惰性加载：仅在有订阅者时动态 import 并 start，最后一个订阅者注销后 stop
 * - 优雅降级：macOS 需辅助功能授权，未授权时监听拿不到事件——start 阶段
 *   try/catch 兜底，状态标记 available=false，由「按键探测」诊断确认
 * - 不吞事件：libuiohook 的事件 tap 只观察不拦截，宿主应用照常收到按键
 *
 * 订阅者：textExpansion（片段扩展）、hotkeys（两段式热键 chord）。
 */
import type { BrowserWindow } from 'electron'
import { log } from '../services/LogService'

export interface GlobalKeyEvent {
  /** uiohook 原生 keycode */
  keycode: number
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

type KeyListener = (e: GlobalKeyEvent) => void

interface HookModule {
  uIOhook: {
    on(event: 'keydown', cb: (e: GlobalKeyEvent) => void): void
    on(event: 'keyup', cb: (e: GlobalKeyEvent) => void): void
    start(): Promise<void> | void
    stop(): Promise<void> | void
  }
}

export class GlobalKeyHookService {
  private mod: HookModule | null = null
  private started = false
  private available = true
  private startPromise: Promise<void> | null = null
  private downListeners = new Set<KeyListener>()
  private upListeners = new Set<KeyListener>()
  /** start/stop 操作串行链 */
  private seq: Promise<unknown> = Promise.resolve()

  /** 监听是否处于工作状态（诊断 UI 用） */
  isAvailable(): boolean {
    return this.available
  }

  onKeydown(listener: KeyListener): () => void {
    this.downListeners.add(listener)
    void this.ensureStarted()
    return () => {
      this.downListeners.delete(listener)
      void this.maybeStop()
    }
  }

  onKeyup(listener: KeyListener): () => void {
    this.upListeners.add(listener)
    void this.ensureStarted()
    return () => {
      this.upListeners.delete(listener)
      void this.maybeStop()
    }
  }

  /**
   * 操作队列（审计 P2 全聋窗口）：start/stop 全部串行过同一 promise 链，每个
   * 操作到队首时**重查状态**。此前 ensureStarted 判 this.started 短路——而
   * maybeStop 要等 uIOhook.stop() 完成才置 false，「stop 在飞 + 新订阅」误判
   * 已启动 → 新监听器全聋到下次退订重订。
   */
  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.seq.then(op, op)
    this.seq = run.catch(() => undefined)
    return run
  }

  private ensureStarted(): Promise<void> {
    return this.enqueue(async () => {
      if (this.started) return
      // 单飞：并发首订共享同一次 start，避免「started 未置位期间二次 start()
      // 抛错」把 available 误标为 false（诊断 UI 会误报未授权）
      if (!this.startPromise) {
        this.startPromise = this.doStart().finally(() => {
          this.startPromise = null
        })
      }
      await this.startPromise
      // start 完成时订阅者已全部退订（退订发生在 start 在飞期间）：立即停掉，
      // 不让无人监听的系统级钩子常驻（有触发词才挂载原则的同族约束）
      if (this.downListeners.size === 0 && this.upListeners.size === 0 && this.mod) {
        try {
          await this.mod.uIOhook.stop()
        } catch (e) {
          log.debug('global-keys', '* noop', e)
        }
        this.started = false
      }
    })
  }

  private async doStart(): Promise<void> {
    try {
      if (!this.mod) {
        // 惰性 import：原生模块，仅在真正需要全局按键时加载
        this.mod = await import('uiohook-napi')
        this.mod.uIOhook.on('keydown', (e) => {
          for (const l of this.downListeners) l(e)
        })
        this.mod.uIOhook.on('keyup', (e) => {
          for (const l of this.upListeners) l(e)
        })
      }
      await this.mod.uIOhook.start()
      this.started = true
      this.available = true
    } catch (error) {
      // 无辅助功能授权 / 平台不支持：静默降级，订阅者收不到事件
      this.available = false
      console.warn(
        '[GlobalKeys] 全局按键监听启动失败（可能缺少辅助功能授权）:',
        (error as Error).message
      )
    }
  }

  private maybeStop(): Promise<void> {
    return this.enqueue(async () => {
      if (this.downListeners.size > 0 || this.upListeners.size > 0) return
      if (!this.started || !this.mod) return
      try {
        await this.mod.uIOhook.stop()
      } catch (e) {
        // 批 7b 空 catch 清账（原注释：* noop）
        log.debug('global-keys', '* noop', e)
      }
      this.started = false
    })
  }
}

export const globalKeyHook = new GlobalKeyHookService()

/**
 * 权限诊断（macOS）：启动监听后等待用户按任意键。
 * 收到事件 = 辅助功能授权正常；超时未收到 = 未授权或监听失效。
 */
export function probeGlobalKeys(
  timeoutMs = 4000
): Promise<{ received: boolean; timeoutMs: number }> {
  return new Promise((resolve) => {
    let off: (() => void) | null = null
    const timer = setTimeout(() => {
      off?.()
      resolve({ received: false, timeoutMs })
    }, timeoutMs)
    off = globalKeyHook.onKeydown(() => {
      clearTimeout(timer)
      off?.()
      resolve({ received: true, timeoutMs })
    })
  })
}

/** Frond 自身窗口持有焦点时返回 true（扩展引擎在该状态下不触发，避免自己扩自己） */
export function hasFocusedFrondWindow(windows: BrowserWindow[]): boolean {
  return windows.some((w) => !w.isDestroyed() && w.isFocused())
}
