/**
 * Frond · ProjectSettingsRepository
 *
 * P1-2：每个项目独立的 Pomodoro 时长配置（K-V 存于 pref_preferences）。
 * - key 格式：`pomodoro_project_settings_{projectId}`
 * - 缺省 fallback 由 renderer 端提供「全局 PomodoroSettings」
 *
 * 仅持久化「全字段覆盖」形式；partial update 由上层合并后再写入。
 */

import { prefRepository } from './PrefRepository'
import type { PomodoroSettings } from './PomodoroRepository'

const KEY_PREFIX = 'pomodoro_project_settings_'

function key(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`
}

/**
 * 抽出当前 repository 的导出 settings 类型（避免循环依赖）。
 * 这里只在内部用，类型由调用方持有 PomodoroSettings。
 */
/**
 * 项目级时长覆盖。
 * - 字段为 number：使用此值
 * - 字段为 null：显式清空（恢复全局默认）
 * - 字段为 undefined：保留现有值
 */
export interface ProjectTimerOverrides {
  workDuration?: number | null
  shortBreakDuration?: number | null
  longBreakDuration?: number | null
  longBreakInterval?: number | null
}

const FIELDS = [
  'workDuration',
  'shortBreakDuration',
  'longBreakDuration',
  'longBreakInterval'
] as const

type Field = (typeof FIELDS)[number]

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export class ProjectSettingsRepository {
  get(projectId: string): ProjectTimerOverrides | null {
    const raw = prefRepository.get(key(projectId))
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<PomodoroSettings>
      const out: ProjectTimerOverrides = {}
      for (const f of FIELDS) {
        const v = parsed[f]
        if (v === null) out[f] = null
        else if (isNumber(v)) out[f] = v
      }
      return Object.keys(out).length > 0 ? out : null
    } catch {
      return null
    }
  }

  /**
   * partial update：
   * - number → 覆盖该字段
   * - null → 显式清空该字段（恢复全局默认）
   * - undefined / 缺省 → 保留现有值
   */
  save(projectId: string, overrides: ProjectTimerOverrides): ProjectTimerOverrides {
    const current = this.get(projectId) ?? {}
    const merged: ProjectTimerOverrides = { ...current }
    for (const f of FIELDS) {
      const incoming = overrides[f]
      if (incoming === undefined) continue
      if (incoming === null) {
        delete (merged as Record<Field, unknown>)[f]
      } else if (isNumber(incoming)) {
        if (incoming > 0) {
          ;(merged as Record<Field, unknown>)[f] = incoming
        } else {
          // 防御：<= 0 当成清空
          delete (merged as Record<Field, unknown>)[f]
        }
      }
    }
    // 若清空后无字段，删掉整条 KV，避免遗留空对象
    if (Object.keys(merged).length === 0) {
      prefRepository.delete(key(projectId))
    } else {
      prefRepository.set(key(projectId), JSON.stringify(merged))
    }
    return merged
  }

  delete(projectId: string): boolean {
    return prefRepository.delete(key(projectId))
  }

  /** 一次性拉所有项目覆盖（启动时用） */
  getAll(): Record<string, ProjectTimerOverrides> {
    const all = prefRepository.all()
    const out: Record<string, ProjectTimerOverrides> = {}
    for (const { key: k, value } of all) {
      if (!k.startsWith(KEY_PREFIX)) continue
      const projectId = k.slice(KEY_PREFIX.length)
      try {
        const parsed = JSON.parse(value) as Partial<PomodoroSettings>
        const overrides: ProjectTimerOverrides = {}
        for (const f of FIELDS) {
          const v = parsed[f]
          if (v === null) overrides[f] = null
          else if (isNumber(v)) overrides[f] = v
        }
        if (Object.keys(overrides).length > 0) out[projectId] = overrides
      } catch {
        // 跳过异常行
      }
    }
    return out
  }
}

export const projectSettingsRepository = new ProjectSettingsRepository()
