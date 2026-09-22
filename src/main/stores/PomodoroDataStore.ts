import {
  pomodoroRepository,
  type PomodoroTask,
  type PomodoroRecord,
  type PomodoroSettings,
  type PomodoroStatistics,
  type DailyTrendPoint,
  type ProjectDistributionPoint,
  type HeatmapCell,
  type TaskCompletionStats
} from '../db/repos/PomodoroRepository'
import {
  projectSettingsRepository,
  type ProjectTimerOverrides
} from '../db/repos/ProjectSettingsRepository'
import { prefRepository } from '../db/repos/PrefRepository'

export type { PomodoroTask, PomodoroRecord, PomodoroSettings }
export type {
  DailyTrendPoint,
  ProjectDistributionPoint,
  HeatmapCell,
  TaskCompletionStats,
  ProjectTimerOverrides
}

export type PomodoroAddTaskOptions = {
  description?: string
  priority?: number
  estimateMs?: number | null
  projectId?: string | null
}

export type PomodoroUpdateTaskPayload = Partial<
  Pick<
    PomodoroTask,
    'title' | 'description' | 'completed' | 'completedAt' | 'priority' | 'estimateMs' | 'projectId'
  >
>

/**
 * PomodoroDataStore — 5-7 纯转发层。
 */

export class PomodoroDataStore {
  // ------- tasks -------

  getTasks(): PomodoroTask[] {
    return pomodoroRepository.getTasks()
  }

  addTask(title: string, options?: PomodoroAddTaskOptions): PomodoroTask {
    return pomodoroRepository.addTask(title, options)
  }

  updateTask(id: string, updates: PomodoroUpdateTaskPayload): PomodoroTask | null {
    return pomodoroRepository.updateTask(id, updates)
  }

  deleteTask(id: string): boolean {
    return pomodoroRepository.deleteTask(id)
  }

  completeTask(id: string): PomodoroTask | null {
    return pomodoroRepository.updateTask(id, { completed: true, completedAt: Date.now() })
  }

  // ------- records -------

  getRecords(): PomodoroRecord[] {
    return pomodoroRepository.getRecords()
  }

  // ─── P1-1：详情页 ───
  getRecordsByTaskId(taskId: string): PomodoroRecord[] {
    return pomodoroRepository.getRecordsByTaskId(taskId)
  }

  getRecordDetail(id: string): { record: PomodoroRecord; task: PomodoroTask | null } | null {
    return pomodoroRepository.getRecordDetail(id)
  }

  updateRecordNote(id: string, note: string): PomodoroRecord | null {
    return pomodoroRepository.updateRecordNote(id, note)
  }

  getTaskSummary(taskId: string): {
    taskId: string
    pomodoroCount: number
    workMs: number
    firstStartedAt: number | null
    lastCompletedAt: number | null
    estimateMs: number | null
    estimateDeviationMs: number | null
  } | null {
    return pomodoroRepository.getTaskSummary(taskId)
  }

  addRecord(record: Omit<PomodoroRecord, 'id' | 'date'>): PomodoroRecord {
    return pomodoroRepository.addRecord(record)
  }

  getRecordsByDate(date: string): PomodoroRecord[] {
    return pomodoroRepository.getRecordsByDate(date)
  }

  getTodayRecords(): PomodoroRecord[] {
    return pomodoroRepository.getTodayRecords()
  }

  /** M4 */
  getFreeRecords(): PomodoroRecord[] {
    return pomodoroRepository.getFreeRecords()
  }

  /** M6 */
  getRecordsByRange(opts: {
    from: number
    to: number
    projectId?: string | null
  }): PomodoroRecord[] {
    return pomodoroRepository.getRecordsByRange(opts)
  }

  getThisWeekRecords(): PomodoroRecord[] {
    // 委托仓库层：周一起始（与 repo.weekStart / getStatistics 同一口径），
    // 且 SQL 区间过滤——旧实现 new Date('YYYY-MM-DD') 按 UTC 解析，UTC- 时区错位一天
    return pomodoroRepository.getThisWeekRecords()
  }

  getThisMonthRecords(): PomodoroRecord[] {
    return pomodoroRepository.getThisMonthRecords()
  }

  getStatistics(): PomodoroStatistics {
    // 单次取数：此前 today/week/month 三条路径各自全表扫描一遍（×3）
    const all = this.getRecords()
    // r.date 是本地 yyyy-mm-dd 字符串；new Date(str) 会按 UTC 解析，
    // 必须按本地字段构造才能与 weekStart/monthStart（本地零点）比较
    const localDateTs = (date: string): number => {
      const [y, m, d] = date.split('-').map(Number)
      return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime()
    }
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const today = all.filter((r) => r.date === todayKey)
    const week = all.filter((r) => localDateTs(r.date) >= weekStart.getTime())
    const month = all.filter((r) => localDateTs(r.date) >= monthStart)
    const countWork = (rs: PomodoroRecord[]): number => rs.filter((r) => r.type === 'work').length
    return {
      today: {
        total: today.length,
        work: countWork(today),
        shortBreak: today.filter((r) => r.type === 'shortBreak').length,
        longBreak: today.filter((r) => r.type === 'longBreak').length
      },
      week: {
        total: week.length,
        work: countWork(week),
        shortBreak: week.filter((r) => r.type === 'shortBreak').length,
        longBreak: week.filter((r) => r.type === 'longBreak').length
      },
      month: {
        total: month.length,
        work: countWork(month),
        shortBreak: month.filter((r) => r.type === 'shortBreak').length,
        longBreak: month.filter((r) => r.type === 'longBreak').length
      }
    }
  }

  // ------- settings -------

  getSettings(): PomodoroSettings {
    return pomodoroRepository.getSettings()
  }

  // ─── P2-7：Todoist 任务集成（Token 存本地偏好） ───

  getTodoistToken(): string {
    try {
      return prefRepository.get('pomodoro_todoist_token') ?? ''
    } catch {
      return ''
    }
  }

  setTodoistToken(token: string): void {
    const trimmed = (token ?? '').trim()
    if (trimmed) {
      prefRepository.set('pomodoro_todoist_token', trimmed)
    } else {
      prefRepository.delete('pomodoro_todoist_token')
    }
  }

  saveSettings(settings: Partial<PomodoroSettings>): PomodoroSettings {
    pomodoroRepository.saveSettings(settings)
    return this.getSettings()
  }

  // ------- stats -------

  getDailyTrend(days: number, endDate?: number): DailyTrendPoint[] {
    return pomodoroRepository.getDailyTrend(days, endDate)
  }

  getProjectDistribution(from: number, to: number): ProjectDistributionPoint[] {
    return pomodoroRepository.getProjectDistribution(from, to)
  }

  getFocusHeatmap(days: number, endDate?: number): HeatmapCell[] {
    return pomodoroRepository.getFocusHeatmap(days, endDate)
  }

  getTaskCompletionStats(from: number, to: number): TaskCompletionStats {
    return pomodoroRepository.getTaskCompletionStats(from, to)
  }

  // ─── P1-2：项目时长覆盖 ───
  getProjectSettings(projectId: string): ProjectTimerOverrides | null {
    return projectSettingsRepository.get(projectId)
  }

  getAllProjectSettings(): Record<string, ProjectTimerOverrides> {
    return projectSettingsRepository.getAll()
  }

  saveProjectSettings(projectId: string, overrides: ProjectTimerOverrides): ProjectTimerOverrides {
    return projectSettingsRepository.save(projectId, overrides)
  }

  deleteProjectSettings(projectId: string): boolean {
    return projectSettingsRepository.delete(projectId)
  }
}
