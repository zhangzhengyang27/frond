/**
 * Leaf · PomodoroTimerStateRepository
 *
 * M14 / M15：持久化每个项目的 timer state，使应用退出再启动后能
 * 恢复上次的：
 *   - mode / status / timeLeft / currentTaskId / consecutiveCount
 *
 * 存储位置：pref_preferences（K-V），key 形如
 *   pomodoro_timer_state_{projectId}
 *
 * 注：lastTickAt / startedAt 不持久化，仅运行期需要；
 * 启动恢复时仅保留 idle / paused 状态，避免 running 被持久化导致时间漂移。
 */

import { prefRepository } from './PrefRepository'

const KEY_PREFIX = 'pomodoro_timer_state_'

function key(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`
}

export interface PersistedTimerState {
  mode: 'work' | 'shortBreak' | 'longBreak'
  status: 'idle' | 'paused' // 不存 running
  timeLeft: number
  currentTaskId: string | null
  consecutiveCount: number
  /** 最近一次更新的 epoch ms（用于排序最近活跃） */
  updatedAt: number
  /** Flowtime：本次专注累计秒数（可选，向后兼容） */
  elapsed?: number
}

export class PomodoroTimerStateRepository {
  get(projectId: string): PersistedTimerState | null {
    const raw = prefRepository.get(key(projectId))
    if (!raw) return null
    return this.parseState(raw)
  }

  private parseState(raw: string): PersistedTimerState | null {
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedTimerState>
      if (!parsed || typeof parsed !== 'object') return null
      const mode =
        parsed.mode === 'work' || parsed.mode === 'shortBreak' || parsed.mode === 'longBreak'
          ? parsed.mode
          : 'work'
      const status: 'idle' | 'paused' = parsed.status === 'paused' ? 'paused' : 'idle'
      const timeLeft =
        typeof parsed.timeLeft === 'number' && parsed.timeLeft > 0 ? parsed.timeLeft : 0
      const currentTaskId = typeof parsed.currentTaskId === 'string' ? parsed.currentTaskId : null
      const consecutiveCount =
        typeof parsed.consecutiveCount === 'number' && parsed.consecutiveCount >= 0
          ? Math.floor(parsed.consecutiveCount)
          : 0
      return {
        mode,
        status,
        timeLeft,
        currentTaskId,
        consecutiveCount,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
      }
    } catch {
      return null
    }
  }

  save(projectId: string, state: PersistedTimerState): void {
    prefRepository.set(key(projectId), JSON.stringify(state))
  }

  delete(projectId: string): boolean {
    return prefRepository.delete(key(projectId))
  }

  getAll(): Record<string, PersistedTimerState> {
    // 一次取全表后本地过滤+解析：避免逐 key 再调 get() 重复查库的 N+1
    const all = prefRepository.all()
    const out: Record<string, PersistedTimerState> = {}
    for (const { key: k, value } of all) {
      if (!k.startsWith(KEY_PREFIX)) continue
      const projectId = k.slice(KEY_PREFIX.length)
      const parsed = this.parseState(value)
      if (parsed) out[projectId] = parsed
    }
    return out
  }
}

export const pomodoroTimerStateRepository = new PomodoroTimerStateRepository()

