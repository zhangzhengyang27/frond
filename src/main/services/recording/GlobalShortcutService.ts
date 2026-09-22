/**
 * Leaf · GlobalShortcutService（PR-7a）
 *
 * 职责：注册/注销全局快捷键，控制录制的开始/停止、暂停/恢复。
 *
 * 设计：
 *  - globalShortcut 是 Electron 模块（仅 main 进程可用），最多一台机器注册一组快捷键
 *  - 启动快捷键：注册成功 → 主进程直接调用 startRecording 流程
 *  - 暂停/恢复快捷键：注册成功 → 主进程 toggle 暂停
 *  - 启用/禁用持久化到 pref_preferences（key='recording.shortcuts'）
 *  - 跨平台快捷键差异：macOS 不允许 Cmd+Shift+R（系统截图），用 CmdOrCtrl+Alt+Shift+R
 *  - 监听键盘组合：double-register 幂等，重复调用 register() 替换旧的
 *  - 单测可注入 platform 与 module（mock globalShortcut）
 */

import { globalShortcut } from 'electron'
import { recordingSettingsRepository } from '../../db/repos/RecordingSettingsRepository'

export const DEFAULT_START_SHORTCUT = 'CommandOrControl+Alt+Shift+R'
export const DEFAULT_TOGGLE_PAUSE_SHORTCUT = 'CommandOrControl+Alt+Shift+P'

export interface ShortcutsConfig {
  /** 是否启用全局快捷键 */
  enabled: boolean
  start: string
  togglePause: string
}

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  enabled: true,
  start: DEFAULT_START_SHORTCUT,
  togglePause: DEFAULT_TOGGLE_PAUSE_SHORTCUT
}

const SHORTCUTS_KEY = 'recording.shortcuts'

export type ShortcutAction = 'start' | 'togglePause'

export interface ShortcutCallbacks {
  /** 启动录制（renderer 端） */
  onStart: () => void
  /** 切换暂停/恢复（renderer 端） */
  onTogglePause: () => void
}

/**
 * 用户可注入的 shortcut module（便于测试）；默认使用 electron globalShortcut。
 */
export interface ShortcutAdapter {
  register: (accel: string, cb: () => void) => boolean
  unregister: (accel: string) => void
  unregisterAll: () => void
}

const electronAdapter: ShortcutAdapter = {
  register: (accel, cb) => globalShortcut.register(accel, cb),
  unregister: (accel) => globalShortcut.unregister(accel),
  unregisterAll: () => globalShortcut.unregisterAll()
}

/**
 * 持久化层抽象（便于测试）。默认从 recordingSettingsRepository 读/写。
 */
export interface ShortcutsStore {
  load(): ShortcutsConfig
  save(cfg: ShortcutsConfig): void
}

export class GlobalShortcutService {
  private adapter: ShortcutAdapter
  private store: ShortcutsStore | null = null
  private config: ShortcutsConfig = { ...DEFAULT_SHORTCUTS }
  private callbacks: ShortcutCallbacks | null = null
  private registered: Set<string> = new Set()

  constructor(adapter: ShortcutAdapter = electronAdapter, store?: ShortcutsStore) {
    this.adapter = adapter
    this.store = store ?? null
  }

  /**
   * 从持久化层加载配置。
   */
  load(): ShortcutsConfig {
    if (this.store) {
      this.config = this.store.load()
    } else {
      this.config = { ...DEFAULT_SHORTCUTS }
    }
    return this.config
  }

  /**
   * 获取当前配置（未持久化的内存版本）。
   */
  getConfig(): ShortcutsConfig {
    return { ...this.config }
  }

  /**
   * 更新配置 + 持久化 + 重新注册。
   */
  setConfig(partial: Partial<ShortcutsConfig>): ShortcutsConfig {
    this.config = { ...this.config, ...partial }
    if (this.store) this.store.save(this.config)
    this.refresh()
    return this.config
  }

  /**
   * 绑定回调（renderer 端 action），然后按当前 config 注册。
   */
  attach(callbacks: ShortcutCallbacks): void {
    this.callbacks = callbacks
    this.refresh()
  }

  /**
   * 注销本服务注册的快捷键。
   * 注意：不能用 globalShortcut.unregisterAll() —— 那是应用级 API，
   * 会把其他模块（show/hide 主窗、截图、番茄钟）注册的快捷键一并清掉。
   */
  detach(): void {
    for (const accel of this.registered) {
      try {
        this.adapter.unregister(accel)
      } catch {
        // 已失效的 accel 忽略
      }
    }
    this.registered.clear()
  }

  /**
   * 注销本服务的快捷键并按当前 config 重新注册。
   */
  refresh(): void {
    this.detach()
    if (!this.config.enabled) return
    if (!this.callbacks) return
    if (this.config.start) {
      // 启动键
      const ok = this.adapter.register(this.config.start, () => {
        this.callbacks?.onStart()
      })
      if (ok) this.registered.add(this.config.start)
    }
    if (this.config.togglePause) {
      const ok = this.adapter.register(this.config.togglePause, () => {
        this.callbacks?.onTogglePause()
      })
      if (ok) this.registered.add(this.config.togglePause)
    }
  }

  /**
   * 是否已注册某个快捷键。
   */
  isRegistered(accel: string): boolean {
    return this.registered.has(accel)
  }

  /**
   * 列出所有已注册的快捷键。
   */
  registeredList(): string[] {
    return Array.from(this.registered)
  }
}

// 模块加载时尝试忽略 - 实际调用由 app.whenReady 后触发
export function withLazyDefaults(): ShortcutsConfig {
  return DEFAULT_SHORTCUTS
}

// 暴露 key 供调试
export { SHORTCUTS_KEY }

/**
 * 默认持久化实现：落在 rec_settings（RecordingSettingsRepository 的 shortcuts 字段）。
 * 旧实现从未给 service 传 store → 用户自定义快捷键重启即丢。
 */
export class SettingsRepoShortcutsStore implements ShortcutsStore {
  load(): ShortcutsConfig {
    try {
      const s = recordingSettingsRepository.get()
      if (s.shortcuts) {
        return {
          enabled: s.shortcuts.enabled,
          start: s.shortcuts.start,
          togglePause: s.shortcuts.togglePause
        }
      }
    } catch {
      // DB 未就绪时走默认
    }
    return { ...DEFAULT_SHORTCUTS }
  }

  save(cfg: ShortcutsConfig): void {
    recordingSettingsRepository.patch({
      shortcuts: { enabled: cfg.enabled, start: cfg.start, togglePause: cfg.togglePause }
    })
  }
}
