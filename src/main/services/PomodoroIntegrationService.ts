/**
 * Frond · PomodoroIntegrationService
 *
 * 负责番茄钟三件集成能力：
 * - 桌面通知策略（普通 / 强提醒 / 静默）
 * - 全局快捷键（开始-停止 / 跳过 / 重置）
 * - 托盘菜单的状态快照
 *
 * 持久化：
 * - 通知模式、快捷键映射存于 pref_preferences（K-V）
 * - 拆三个 key，方便单条更新：
 *     `pomodoro_integration_mode`           → 'normal' | 'strong' | 'silent'
 *     `pomodoro_integration_shortcuts`      → JSON.stringify(PomodoroShortcuts)
 *
 * 设计原则：
 * - 不持有 timer 状态（仍由 index.vue / store 拥有）
 * - 接受 renderer 推送的状态快照用于托盘显示
 * - 不主动注册快捷键（由 modules/pomodoroShortcuts.ts 在主进程初始化时注册）
 */

import { BrowserWindow, app } from 'electron'
import { prefRepository } from '../db/repos/PrefRepository'
import { NotificationService, NotificationType } from './NotificationService'
import type {
  PomodoroNotificationMode,
  PomodoroShortcutAction,
  PomodoroShortcuts,
  PomodoroTraySnapshot
} from '../../shared/pomodoroIntegration'

export type {
  PomodoroNotificationMode,
  PomodoroShortcutAction,
  PomodoroShortcuts,
  PomodoroTraySnapshot
} from '../../shared/pomodoroIntegration'

export const DEFAULT_POMODORO_SHORTCUTS: PomodoroShortcuts = {
  toggle: 'CommandOrControl+Shift+P',
  skip: 'CommandOrControl+Shift+S',
  reset: 'CommandOrControl+Shift+R'
}

export const DEFAULT_SNAPSHOT: PomodoroTraySnapshot = {
  isRunning: false,
  currentMode: null,
  taskTitle: '',
  timeLeftSeconds: 0,
  todayCompleted: 0,
  projectId: null,
  projectName: '',
  focusMode: false,
  backgroundProjects: [],
  updatedAt: 0
}

const MODE_KEY = 'pomodoro_integration_mode'
const SHORTCUTS_KEY = 'pomodoro_integration_shortcuts'

export class PomodoroIntegrationService {
  private static instance: PomodoroIntegrationService
  private snapshot: PomodoroTraySnapshot = { ...DEFAULT_SNAPSHOT }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): PomodoroIntegrationService {
    if (!PomodoroIntegrationService.instance) {
      PomodoroIntegrationService.instance = new PomodoroIntegrationService()
    }
    return PomodoroIntegrationService.instance
  }

  // ─── Notification Mode ───

  getNotificationMode(): PomodoroNotificationMode {
    const raw = prefRepository.get(MODE_KEY)
    if (raw === 'strong' || raw === 'silent' || raw === 'normal') return raw
    return 'normal'
  }

  setNotificationMode(mode: PomodoroNotificationMode): PomodoroNotificationMode {
    if (mode !== 'normal' && mode !== 'strong' && mode !== 'silent') {
      throw new Error(`[PomodoroIntegrationService] invalid mode: ${mode}`)
    }
    prefRepository.set(MODE_KEY, mode)
    return mode
  }

  // ─── Shortcuts ───

  getShortcuts(): PomodoroShortcuts {
    const raw = prefRepository.get(SHORTCUTS_KEY)
    if (!raw) return { ...DEFAULT_POMODORO_SHORTCUTS }
    try {
      const parsed = JSON.parse(raw) as Partial<PomodoroShortcuts>
      return {
        toggle: parsed.toggle || DEFAULT_POMODORO_SHORTCUTS.toggle,
        skip: parsed.skip || DEFAULT_POMODORO_SHORTCUTS.skip,
        reset: parsed.reset || DEFAULT_POMODORO_SHORTCUTS.reset
      }
    } catch {
      return { ...DEFAULT_POMODORO_SHORTCUTS }
    }
  }

  setShortcut(action: PomodoroShortcutAction, accelerator: string): PomodoroShortcuts {
    const next = { ...this.getShortcuts(), [action]: accelerator }
    prefRepository.set(SHORTCUTS_KEY, JSON.stringify(next))
    return next
  }

  resetShortcuts(): PomodoroShortcuts {
    prefRepository.set(SHORTCUTS_KEY, JSON.stringify(DEFAULT_POMODORO_SHORTCUTS))
    return { ...DEFAULT_POMODORO_SHORTCUTS }
  }

  // ─── Tray snapshot ───

  private badgeListeners: Array<(count: number) => void> = []
  private titleListeners: Array<(title: string) => void> = []
  // M5：所有 renderer 订阅 snapshot 广播
  private snapshotListeners: Array<(snap: PomodoroTraySnapshot) => void> = []

  /** 外部注册 badge 更新回调（被 tray / dock 模块订阅） */
  onBadgeUpdate(listener: (count: number) => void): () => void {
    this.badgeListeners.push(listener)
    return () => {
      this.badgeListeners = this.badgeListeners.filter((l) => l !== listener)
    }
  }

  /** 外部注册 tray title 更新回调（macOS tray title 显示剩余分钟数） */
  onTitleUpdate(listener: (title: string) => void): () => void {
    this.titleListeners.push(listener)
    return () => {
      this.titleListeners = this.titleListeners.filter((l) => l !== listener)
    }
  }

  updateTraySnapshot(patch: Partial<PomodoroTraySnapshot>): PomodoroTraySnapshot {
    const next: PomodoroTraySnapshot = { ...this.snapshot, ...patch, updatedAt: Date.now() }
    this.snapshot = next
    // M1：把「今日番茄数」推给 dock badge；running 时也把剩余时间写进 tray title
    // （🍅 专注 / ☕ 休息 前缀，macOS tray title 展示，TomatoBar 风格）
    this.emitBadge(next.todayCompleted > 0 ? next.todayCompleted : 0)
    this.emitTitle(
      next.isRunning
        ? `${next.currentMode === 'work' ? '🍅' : '☕'} ${formatMinutes(next.timeLeftSeconds)}`
        : ''
    )
    // M5：广播给所有订阅的 renderer（mini window 等）
    this.emitSnapshot(next)
    return this.snapshot
  }

  /** M5：订阅 snapshot 变化 */
  onSnapshotUpdate(listener: (snap: PomodoroTraySnapshot) => void): () => void {
    this.snapshotListeners.push(listener)
    return () => {
      this.snapshotListeners = this.snapshotListeners.filter((l) => l !== listener)
    }
  }

  private emitSnapshot(snap: PomodoroTraySnapshot): void {
    for (const l of this.snapshotListeners) {
      try {
        l(snap)
      } catch {
        /* noop */
      }
    }
  }

  // ─── M7：专注模式 ───
  setFocusMode(enabled: boolean): PomodoroTraySnapshot {
    this.updateTraySnapshot({ focusMode: enabled })
    return this.snapshot
  }

  getFocusMode(): boolean {
    return this.snapshot.focusMode === true
  }

  private emitBadge(count: number): void {
    this.badgeListeners.forEach((l) => {
      try {
        l(count)
      } catch {
        /* noop */
      }
    })
  }

  private emitTitle(title: string): void {
    this.titleListeners.forEach((l) => {
      try {
        l(title)
      } catch {
        /* noop */
      }
    })
  }

  /**
   * M1：直接设置 dock badge（macOS 走 app.dock.setBadge，其它平台走 app.setBadgeCount）。
   * 用于调试或在渲染端没有今日记录但想显示倒计时等场景。
   */
  setDockBadge(count: number): void {
    try {
      if (count > 0) {
        const text = count > 99 ? '99+' : String(count)
        if (process.platform === 'darwin' && app.dock) {
          app.dock.setBadge(text)
        } else if (typeof app.setBadgeCount === 'function') {
          app.setBadgeCount(count)
        }
      } else {
        if (process.platform === 'darwin' && app.dock) {
          app.dock.setBadge('')
        } else if (typeof app.setBadgeCount === 'function') {
          app.setBadgeCount(0)
        }
      }
    } catch {
      /* noop */
    }
  }

  getTraySnapshot(): PomodoroTraySnapshot {
    return this.snapshot
  }

  /**
   * 推出一份适合直接展示的简短文本，供 tray 菜单使用。
   * 状态 + 任务名 + 倒计时。无任务时只显示模式。
   */
  describeTraySnapshot(snapshot: PomodoroTraySnapshot = this.snapshot): {
    primary: string
    secondary: string
  } {
    if (!snapshot.isRunning && !snapshot.currentMode) {
      return { primary: '番茄钟空闲', secondary: '尚未开始' }
    }
    const modeLabel =
      snapshot.currentMode === 'work'
        ? '专注中'
        : snapshot.currentMode === 'shortBreak'
          ? '短休息'
          : snapshot.currentMode === 'longBreak'
            ? '长休息'
            : '空闲'
    const projectTag = snapshot.projectName ? ` · ${snapshot.projectName}` : ''
    const task = snapshot.taskTitle?.trim() ? ` · ${snapshot.taskTitle.trim()}` : ''
    const time = formatMinutes(snapshot.timeLeftSeconds)
    const bgCount = snapshot.backgroundProjects.length
    const bgTail = bgCount > 0 ? ` · +${bgCount} 后台` : ''
    const primary = `${modeLabel}${projectTag}${task}`
    const focusPrefix = snapshot.focusMode ? '🔕 专注中 · ' : ''
    return {
      primary: `${focusPrefix}${primary}`,
      secondary: time
        ? `剩余 ${time} · 今日 ${snapshot.todayCompleted} 番茄${bgTail}`
        : `今日 ${snapshot.todayCompleted} 番茄${bgTail}`
    }
  }

  // ─── Notification dispatch ───

  /**
   * renderer 调用入口：把番茄事件交给 service，统一受通知模式策略控制。
   * - silent 模式：仅记录到日志，不弹通知
   * - strong 模式：长停留 + critical urgency
   * - normal：默认样式
   */
  notify(
    event: 'start' | 'break' | 'complete' | 'pause' | 'remind',
    message?: string
  ): number | null {
    const mode = this.getNotificationMode()
    // M7：专注模式 → 视为静默，但仍记录状态
    if (this.getFocusMode()) return null
    if (mode === 'silent') return null
    if (mode === 'strong') {
      const stayMs = 10_000
      return NotificationService.getInstance().showPomodoroNotification(
        event,
        message ?? this.eventBody(event),
        { sound: true, timeout: stayMs }
      )
    }
    return NotificationService.getInstance().showPomodoroNotification(event, message)
  }

  /**
   * 番茄事件通知：
   * - silent 模式：仅记录到日志，不弹通知
   * - strong 模式：复用 NotificationService.showPomodoroNotification（其内部已根据 type 决定 urgency 与 sound）
   * - normal：与 strong 同路径，但调用方可通过 NotificationOptions.timeout/sound 微调（本方法统一策略）
   */
  showEventNotification(
    event: 'start' | 'break' | 'complete' | 'pause' | 'remind',
    message?: string
  ): void {
    const mode = this.getNotificationMode()
    if (mode === 'silent') return

    if (mode === 'strong') {
      // NotificationService 根据 type 设 urgency：把 type 临时走 WARNING/ERROR 才能 critical
      // 这里直接用 WARNING 让 urgency=critical（不影响用户视图）
      const id = NotificationService.getInstance().show(
        NotificationType.WARNING,
        this.eventTitle(event),
        message ?? this.eventBody(event),
        {
          sound: true,
          timeout: 0
        }
      )
      // 强提醒给出更长停留时间（10s），普通 4s
      const ttl = (
        NotificationService.getInstance() as unknown as {
          notifications: Map<number, { close: () => void }>
        }
      ).notifications.get(id)
      if (ttl) {
        setTimeout(() => {
          try {
            ttl.close()
          } catch {
            /* noop */
          }
        }, 10_000)
      }
      return
    }

    NotificationService.getInstance().showPomodoroNotification(event, message)
  }

  /**
   * UI 「测试通知」按钮触发：始终发（无视当前模式），以便用户在不切换模式下也能验证通知是否可用。
   */
  testNotification(getMainWindow: () => BrowserWindow | null): void {
    NotificationService.getInstance().showPomodoroNotification(
      'start',
      '这是一条来自番茄钟的测试通知。'
    )
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.focus()
  }

  private eventTitle(event: 'start' | 'break' | 'complete' | 'pause' | 'remind'): string {
    switch (event) {
      case 'start':
        return '🍅 专注开始'
      case 'break':
        return '☕ 休息时间'
      case 'complete':
        return '✅ 番茄完成'
      case 'pause':
        return '⏸️ 已暂停'
      case 'remind':
        return '⏰ 即将结束'
    }
  }

  private eventBody(event: 'start' | 'break' | 'complete' | 'pause' | 'remind'): string {
    switch (event) {
      case 'start':
        return '25 分钟专注，加油！'
      case 'break':
        return '到点休息，活动一下颈肩与眼睛。'
      case 'complete':
        return '一个番茄完成，状态不错。'
      case 'pause':
        return '已暂停，回来随时继续。'
      case 'remind':
        return '本阶段快结束了，准备收尾。'
    }
  }
}

export function pomodoroIntegrationService(): PomodoroIntegrationService {
  return PomodoroIntegrationService.getInstance()
}

/** utility: seconds → `M:SS` */
function formatMinutes(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 抑制 browsers 检测
void BrowserWindow
