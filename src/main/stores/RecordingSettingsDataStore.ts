/**
 * @deprecated
 *
 * 本 Store 用 electron-store 持久化设置，**将于 1.0 起 6 个月内移除**（预计 2026-12 之前删）。
 *
 * **迁移路径**：
 * - 改用 `recordingSettingsRepository.get() / set() / patch() / reset()`（基于 pref_preferences 表 key='recording.default'）
 * - IPC：旧 `recording-settings:*` 保留；新通道 `recording.settings.get / patch / reset`
 *
 * 详见 `docs/modules/07-screen-recorder.md` §3 迁移路线。
 */
import Store from 'electron-store'
import { recordingSettingsRepository } from '../db/repos/RecordingSettingsRepository'

/**
 * PR-2 双写：set() 时同步写 pref_preferences。
 * 设计：
 * - SQLite 写入失败不影响 electron-store 主路径（仅 console.warn）
 * - 把整个 settings 序列化成 JSON（v1 字段集合），与 RecordingSettingsRepository.get() 解析兼容
 */

/**
 * 录制设置接口
 */
export interface RecordingSettings {
  encoder: 'vp9' | 'vp8' | 'h264'
  quality: 'low' | 'medium' | 'high' | 'custom'
  bitrate?: number // kbps
  fps: 30 | 60
  resolution: {
    width: number
    height: number
  }
  format: 'webm' | 'mp4'
  audioEnabled: boolean
  audioCodec?: 'aac' | 'opus'
  audioBitrate?: number // kbps
  // PR-5a: 系统音频 loopback
  systemAudio?: {
    enabled: boolean
    deviceId?: string
    keepMicrophone?: boolean
  }
}

/**
 * 默认录制设置
 */
const DEFAULT_SETTINGS: RecordingSettings = {
  encoder: 'vp9',
  quality: 'medium',
  fps: 30,
  resolution: {
    width: 1920,
    height: 1080
  },
  format: 'webm',
  audioEnabled: false,
  audioCodec: 'opus',
  audioBitrate: 128
}

/**
 * 质量预设配置
 */
export const QUALITY_PRESETS: Record<'low' | 'medium' | 'high', Partial<RecordingSettings>> = {
  low: {
    bitrate: 2000,
    fps: 30,
    resolution: {
      width: 1280,
      height: 720
    }
  },
  medium: {
    bitrate: 5000,
    fps: 30,
    resolution: {
      width: 1920,
      height: 1080
    }
  },
  high: {
    bitrate: 10000,
    fps: 60,
    resolution: {
      width: 1920,
      height: 1080
    }
  }
}

/**
 * 录制设置数据存储类
 */
export class RecordingSettingsDataStore extends Store {
  constructor() {
    super({
      name: 'recording-settings',
      defaults: {
        settings: DEFAULT_SETTINGS
      }
    })
  }

  /**
   * 获取录制设置
   */
  getSettings(): RecordingSettings {
    const settings = this.get('settings') as RecordingSettings
    return { ...DEFAULT_SETTINGS, ...settings }
  }

  /**
   * 更新录制设置
   */
  updateSettings(updates: Partial<RecordingSettings>): RecordingSettings {
    const current = this.getSettings()
    const updated = { ...current, ...updates }

    // 如果选择了预设，应用预设值
    if (updates.quality && updates.quality !== 'custom' && QUALITY_PRESETS[updates.quality]) {
      const preset = QUALITY_PRESETS[updates.quality]
      Object.assign(updated, preset)
    }

    this.set('settings', updated)

    // PR-2 双写：同步到 SQLite pref_preferences
    try {
      recordingSettingsRepository.set(this.toRepoSettings(updated))
    } catch (e) {
      console.warn('[RecordingSettingsDataStore] dual-write to SQLite failed:', e)
    }

    return updated
  }

  /**
   * 把 RecordingSettings 转换成 RecordingDefaultSettings（PR-2）
   * - fps / quality / cursor / defaultSavePath 字段映射
   * - bitrate / resolution / audioBitrate / audioCodec / format / encoder 暂存进 description 或忽略
   *   （RecordingDefaultSettings 没这些字段；保留在 electron-store 主路径上）
   */
  private toRepoSettings(s: RecordingSettings): {
    fps: 30 | 60
    quality: 'low' | 'medium' | 'high' | 'source'
    cursor: 'halo' | 'highlight' | 'click-ring'
    defaultSavePath: string | null
    micDefault: string | null
    systemDefault: string | null
    hasCamera: boolean
    hasMic: boolean
    hasSystemAudio: boolean
  } {
    return RecordingSettingsDataStore.toRepoSettings(s)
  }

  /**
   * 把 RecordingSettings 转换成 RecordingDefaultSettings 字段（PR-5a 公开，
   * 便于单元测试，不依赖 electron-store 文件系统）。
   */
  static toRepoSettings(s: RecordingSettings): {
    fps: 30 | 60
    quality: 'low' | 'medium' | 'high' | 'source'
    cursor: 'halo' | 'highlight' | 'click-ring'
    defaultSavePath: string | null
    micDefault: string | null
    systemDefault: string | null
    hasCamera: boolean
    hasMic: boolean
    hasSystemAudio: boolean
  } {
    return {
      fps: s.fps,
      quality: s.quality === 'custom' ? 'medium' : s.quality,
      cursor: 'halo',
      defaultSavePath: null,
      micDefault: null,
      systemDefault: s.systemAudio?.deviceId ?? null,
      hasCamera: false,
      hasMic: s.audioEnabled && !(s.systemAudio?.enabled && !s.systemAudio?.keepMicrophone),
      hasSystemAudio: !!s.systemAudio?.enabled
    }
  }

  /**
   * 重置为默认设置
   */
  resetToDefaults(): RecordingSettings {
    this.set('settings', DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }

  /**
   * 应用质量预设
   */
  applyQualityPreset(quality: 'low' | 'medium' | 'high'): RecordingSettings {
    const preset = QUALITY_PRESETS[quality]
    const current = this.getSettings()
    const updated = {
      ...current,
      quality,
      ...preset
    }
    this.set('settings', updated)
    return updated
  }
}
