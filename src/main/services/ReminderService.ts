/**
 * Frond · ReminderService（提醒事项服务）
 *
 * 主进程服务：
 * - CRUD 委托给 ReminderRepository
 * - 定时扫描 remind_at 已到期的未完成提醒，发送系统通知
 * - 通知点击后标记为已完成
 *
 * 设计约束：
 * - 扫描间隔 30s，避免频繁唤醒
 * - 已发送通知的提醒记录在 notified 集合中，避免重复通知
 * - 应用启动时立即扫描一次
 */

import { app, Notification } from 'electron'
import {
  reminderRepository,
  type Reminder,
  type ReminderFilter
} from '../db/repos/ReminderRepository'

const SCAN_INTERVAL_MS = 30 * 1000

class ReminderService {
  private timer: ReturnType<typeof setInterval> | null = null
  /** 内存缓存：已通知的提醒 ID（避免频繁查数据库，启动时从数据库重建） */
  private notified = new Set<string>()
  private started = false

  start(): void {
    if (this.started) return
    this.started = true
    // 启动时从数据库重建已通知集合（notified_at 不为 null 的提醒）
    this.rebuildNotifiedCache()
    // 启动时立即扫描一次
    this.scanDue()
    this.timer = setInterval(() => this.scanDue(), SCAN_INTERVAL_MS)
    app.on('will-quit', () => this.stop())
  }

  /** 从数据库重建已通知集合 */
  private rebuildNotifiedCache(): void {
    try {
      const all = reminderRepository.list({ isDeleted: false })
      for (const r of all) {
        if (r.notifiedAt !== null) {
          this.notified.add(r.id)
        }
      }
    } catch (err) {
      console.warn('[Reminder] 重建通知缓存失败:', (err as Error).message)
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.started = false
  }

  /** 扫描到期提醒并发送通知 */
  private scanDue(): void {
    try {
      const now = Date.now()
      const due = reminderRepository.list({ dueBefore: now, isDeleted: false })
      for (const r of due) {
        if (this.notified.has(r.id)) continue
        this.notified.add(r.id)
        // 持久化到数据库，应用重启后不再重复通知
        reminderRepository.markNotified(r.id)
        this.sendNotification(r)
      }
    } catch (err) {
      console.warn('[Reminder] 扫描失败:', (err as Error).message)
    }
  }

  private sendNotification(reminder: Reminder): void {
    try {
      const n = new Notification({
        title: '⏰ 提醒',
        body: reminder.title,
        silent: false
      })
      n.on('click', () => {
        // 点击通知后标记为已完成（走 service 层，确保 notified 集合被清理）
        this.complete(reminder.id)
      })
      n.show()
    } catch (err) {
      console.warn('[Reminder] 通知发送失败:', (err as Error).message)
    }
  }

  // ── CRUD 委托 ──

  list(filter?: ReminderFilter): Reminder[] {
    return reminderRepository.list(filter)
  }

  get(id: string): Reminder | null {
    return reminderRepository.get(id)
  }

  create(data: {
    title: string
    notes?: string
    dueAt?: number | null
    remindAt?: number | null
  }): Reminder {
    const r = reminderRepository.create(data)
    // 新建提醒如果已到期，立即通知
    if (r.remindAt && r.remindAt <= Date.now() && !r.isCompleted) {
      this.notified.add(r.id)
      reminderRepository.markNotified(r.id)
      this.sendNotification(r)
    }
    return r
  }

  update(
    id: string,
    patch: Partial<Pick<Reminder, 'title' | 'notes' | 'dueAt' | 'remindAt'>>
  ): Reminder | null {
    const r = reminderRepository.update(id, patch)
    // 更新后如果 remindAt 改变且已到期，重置通知状态
    if (r && r.remindAt && r.remindAt <= Date.now() && !r.isCompleted && !this.notified.has(r.id)) {
      this.notified.add(r.id)
      reminderRepository.markNotified(r.id)
      this.sendNotification(r)
    } else if (r && r.remindAt && r.remindAt > Date.now()) {
      // 未来的提醒，清除已通知标记（内存 + 数据库）
      this.notified.delete(r.id)
      // 将 notified_at 重置为 NULL
      reminderRepository.resetNotified(r.id)
    }
    return r
  }

  complete(id: string): Reminder | null {
    this.notified.delete(id)
    return reminderRepository.complete(id)
  }

  uncomplete(id: string): Reminder | null {
    const r = reminderRepository.uncomplete(id)
    if (r) this.notified.delete(id)
    return r
  }

  remove(id: string): boolean {
    this.notified.delete(id)
    return reminderRepository.remove(id)
  }

  countActive(): number {
    return reminderRepository.countActive()
  }
}

export const reminderService = new ReminderService()
