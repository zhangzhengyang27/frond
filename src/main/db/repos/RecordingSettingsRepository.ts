/**
 * Frond · RecordingSettingsRepository
 *
 * 职责：管理录制默认设置，存到 pref_preferences（key='recording.default'，value=JSON）。
 *
 * 设计：
 * - 复用 pref_preferences 表，避免新建独立 settings 表
 * - value 为 JSON 字符串（与其他 pref_* key 一致）
 * - 这是「SQLite 接管」的接入点；老的 RecordingSettingsDataStore（electron-store）
 *   标记为 Legacy，新写入双写到本 Repository（详见 §4 过渡方案）
 *
 * Schema（无新表）：pref_preferences(key, value, updated_at)
 *
 * 设计稿（§3.2 §4.1）：
 * - 字段集与 RecordingSettingsDataStore 对齐 + 扩展：
 *   fps, quality, cursor, defaultSavePath, micDefault, systemDefault
 * - 为兼容旧 value，新增 migration 读取 JSON 时若缺字段用默认值补
 */

import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'

export type CursorStyle = 'halo' | 'highlight' | 'click-ring'
export type RecordingQuality = 'low' | 'medium' | 'high' | 'source'
export type AudioKind = 'mic' | 'system'

export interface RecordingDefaultSettings {
  fps: 30 | 60
  quality: RecordingQuality
  cursor: CursorStyle
  defaultSavePath: string | null
  micDefault: string | null
  systemDefault: string | null
  hasCamera: boolean
  hasMic: boolean
  hasSystemAudio: boolean
  // PR-7a: 全局快捷键开关 + 映射
  shortcuts?: {
    enabled: boolean
    start: string
    togglePause: string
  }
}

export const DEFAULT_RECORDING_SETTINGS: RecordingDefaultSettings = {
  fps: 30,
  quality: 'medium',
  cursor: 'halo',
  defaultSavePath: null,
  micDefault: null,
  systemDefault: null,
  hasCamera: false,
  hasMic: true,
  hasSystemAudio: false
}

export const RECORDING_SETTINGS_KEY = 'recording.default'

export class RecordingSettingsRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  /**
   * 取默认设置；不存在返回 DEFAULT_RECORDING_SETTINGS 深拷贝
   */
  get(): RecordingDefaultSettings {
    const row = this.db
      .prepare(`SELECT value FROM pref_preferences WHERE key = ?`)
      .get(RECORDING_SETTINGS_KEY) as { value: string } | undefined
    if (!row) return { ...DEFAULT_RECORDING_SETTINGS }
    try {
      const parsed = JSON.parse(row.value) as Partial<RecordingDefaultSettings>
      // 用默认值补缺失字段（向前兼容老 value）
      return { ...DEFAULT_RECORDING_SETTINGS, ...parsed }
    } catch {
      return { ...DEFAULT_RECORDING_SETTINGS }
    }
  }

  /**
   * 覆盖写入（部分字段也会整体覆盖；调用方应 get() 后 merge）
   */
  set(value: RecordingDefaultSettings): void {
    const ts = now()
    const json = JSON.stringify(value)
    this.db
      .prepare(
        `INSERT INTO pref_preferences (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run(RECORDING_SETTINGS_KEY, json, ts)
  }

  /**
   * 部分字段更新（merge 模式）
   */
  patch(patch: Partial<RecordingDefaultSettings>): RecordingDefaultSettings {
    const merged = { ...this.get(), ...patch }
    this.set(merged)
    return merged
  }

  /** 重置为默认 */
  reset(): RecordingDefaultSettings {
    this.set({ ...DEFAULT_RECORDING_SETTINGS })
    return { ...DEFAULT_RECORDING_SETTINGS }
  }
}

export const recordingSettingsRepository = new RecordingSettingsRepository()
