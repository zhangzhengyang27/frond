/**
 * Frond · CountdownService（PR-7b）
 *
 * 职责：在主进程启动录制前的倒数；每 1 秒推一次 tick，最后一个 tick 时触发 begun 事件。
 *
 * 设计：
 *  - 倒计时由 main 端 setTimeout 驱动（确保 renderer 关闭时仍可倒计时）
 *  - 进度通过 webContents.send 推给所有 renderer
 *  - 倒计时过程中可被 cancel 中断
 *  - 单例：同时只允许一个倒计时
 *  - 仅通过 webContents.send 推 forwarding，不依赖 renderer 持续在线
 */

import type { BrowserWindow } from 'electron'

export const COUNTDOWN_TICK_EVENT = 'recording:countdown:tick'
export const COUNTDOWN_BEGUN_EVENT = 'recording:countdown:begun'
export const COUNTDOWN_CANCEL_EVENT = 'recording:countdown:cancel'

interface CountdownState {
  remaining: number
  startedAt: number
  intervalId: NodeJS.Timeout | null
  /** 倒计时 reach 0 时要触发的动作 */
  onComplete: () => void
}

let activeCountdown: CountdownState | null = null

export class CountdownService {
  private getMainWindow: () => BrowserWindow | null

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow
  }

  /**
   * 启动倒计时。
   * @returns false 表示当前已有倒计时在进行
   */
  start(seconds: number, onComplete: () => void): boolean {
    if (!Number.isFinite(seconds)) return false
    if (activeCountdown) return false
    const safeSeconds = Math.max(0, Math.min(60, Math.floor(seconds)))
    if (safeSeconds === 0) {
      // 0 秒倒计时：直接执行
      onComplete()
      return true
    }
    activeCountdown = {
      remaining: safeSeconds,
      startedAt: Date.now(),
      intervalId: null,
      onComplete
    }
    // 立刻推第一个 tick
    this.sendTick(safeSeconds)
    activeCountdown.intervalId = setInterval(() => {
      if (!activeCountdown) return
      activeCountdown.remaining -= 1
      if (activeCountdown.remaining <= 0) {
        // 终止
        const cb = activeCountdown.onComplete
        clearInterval(activeCountdown.intervalId!)
        activeCountdown = null
        this.sendBegun()
        // 触发 onComplete（在 begun 之后）
        cb()
      } else {
        this.sendTick(activeCountdown.remaining)
      }
    }, 1000)
    return true
  }

  /**
   * 取消当前倒计时。
   */
  cancel(): boolean {
    if (!activeCountdown) return false
    if (activeCountdown.intervalId) clearInterval(activeCountdown.intervalId)
    activeCountdown = null
    this.sendCancel()
    return true
  }

  /**
   * 当前是否在倒计时。
   */
  isActive(): boolean {
    return activeCountdown !== null
  }

  /**
   * 剩余秒数（仅用于调试 / 测试）。
   */
  remaining(): number {
    return activeCountdown?.remaining ?? 0
  }

  private sendTick(remaining: number): void {
    this.send(COUNTDOWN_TICK_EVENT, { remaining })
  }

  private sendBegun(): void {
    this.send(COUNTDOWN_BEGUN_EVENT, {})
  }

  private sendCancel(): void {
    this.send(COUNTDOWN_CANCEL_EVENT, {})
  }

  private send(channel: string, payload: unknown): void {
    const win = this.getMainWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(channel, payload)
  }
}
