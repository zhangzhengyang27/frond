/**
 * Leaf · PomodoroRepository
 *
 * 取代 PomodoroDataStore（251 行）。
 *
 * Schema: pom_tasks / pom_pomodoros / pref_preferences（settings）
 * - pom_tasks: id, title, completed, created_at, completed_at, deleted_at ...
 * - pom_pomodoros: id, type, duration_ms, started_at, ended_at, task_id, date
 * - pref_preferences: settings (JSON)
 *
 * 业务接口（兼容旧 PomodoroDataStore）：
 * - getTasks / addTask / updateTask / deleteTask / completeTask
 * - getRecords / addRecord / getRecordsByDate / getTodayRecords / getThisWeek/MonthRecords / getStatistics
 * - getSettings / saveSettings
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'
import { prefRepository } from './PrefRepository'

export interface PomodoroTask {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: number
  /** 预估时长（毫秒）；UI 可换算成番茄数 */
  estimateMs: number | null
  projectId: string | null
  createdAt: number
  completedAt?: number
}

export interface PomodoroRecord {
  id: string
  taskId?: string
  taskTitle?: string
  projectId?: string
  type: 'work' | 'shortBreak' | 'longBreak'
  duration: number
  completedAt: number
  date: string // YYYY-MM-DD
}

export interface PomodoroSettings {
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  soundEnabled: boolean
  notificationEnabled: boolean
  autoStartBreak: boolean
  autoStartWork: boolean
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  notificationEnabled: true,
  autoStartBreak: false,
  autoStartWork: false
}

const SETTINGS_KEY = 'pomodoro_settings'

interface TaskRow {
  id: string
  title: string
  description: string | null
  estimate_ms: number | null
  actual_ms: number
  status: string
  priority: number
  project_id: string | null
  due_at: number | null
  created_at: number
  updated_at: number
  completed_at: number | null
  deleted_at: number | null
}

interface RecordRow {
  id: string
  started_at: number
  ended_at: number | null
  duration_ms: number
  state: string
  task_id: string | null
  note: string | null
  project_id: string | null
  task_title: string | null
}

/** 某时间段内的番茄统计（getStatistics 返回结构的单个条目） */
export interface PomodoroPeriodStats {
  total: number
  work: number
  shortBreak: number
  longBreak: number
}

/** getStatistics 返回结构 */
export interface PomodoroStatistics {
  today: PomodoroPeriodStats
  week: PomodoroPeriodStats
  month: PomodoroPeriodStats
}

export class PomodoroRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  /** Task 行 → 业务接口 */
  private taskFromRow(row: TaskRow): PomodoroTask {
    const t: PomodoroTask = {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      completed: row.completed_at !== null,
      priority: row.priority ?? 0,
      estimateMs: row.estimate_ms,
      projectId: row.project_id,
      createdAt: row.created_at
    }
    if (row.completed_at !== null) t.completedAt = row.completed_at
    return t
  }

  /** Record 行 → 业务接口 */
  private recordFromRow(row: RecordRow): PomodoroRecord {
    const r: PomodoroRecord = {
      id: row.id,
      type: this.mapStateToType(row.state),
      duration: row.duration_ms,
      completedAt: row.ended_at ?? row.started_at,
      date: dateOf(row.started_at)
    }
    if (row.task_id) r.taskId = row.task_id
    // 优先使用独立的 task_title 字段，fallback 到 note（兼容旧数据）
    if (row.task_title) r.taskTitle = row.task_title
    else if (row.note) r.taskTitle = row.note
    if (row.project_id) r.projectId = row.project_id
    return r
  }

  private mapStateToType(state: string): 'work' | 'shortBreak' | 'longBreak' {
    if (state === 'shortBreak' || state === 'longBreak' || state === 'work') return state
    if (state === 'break') return 'shortBreak'
    return 'work'
  }

  // --------- Tasks ---------

  getTasks(): PomodoroTask[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM pom_tasks WHERE deleted_at IS NULL ORDER BY created_at DESC, rowid DESC`
      )
      .all() as TaskRow[]
    return rows.map((r) => this.taskFromRow(r))
  }

  addTask(
    title: string,
    options?: {
      description?: string
      priority?: number
      estimateMs?: number | null
      projectId?: string | null
    }
  ): PomodoroTask {
    const ts = now()
    const id = uuidv4()
    const priority = clampPriority(options?.priority ?? 0)
    const description = options?.description?.trim() || null
    const estimateMs = options?.estimateMs ?? null
    const projectId = options?.projectId ?? null
    this.db
      .prepare(
        `INSERT INTO pom_tasks
         (id, title, description, estimate_ms, status, priority, project_id, actual_ms,
          created_at, updated_at, completed_at, deleted_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, NULL, NULL)`
      )
      .run(id, title.trim(), description, estimateMs, priority, projectId, ts, ts)
    return {
      id,
      title: title.trim(),
      description: description ?? undefined,
      completed: false,
      priority,
      estimateMs,
      projectId,
      createdAt: ts
    }
  }

  updateTask(
    id: string,
    updates: Partial<
      Pick<
        PomodoroTask,
        | 'title'
        | 'description'
        | 'completed'
        | 'completedAt'
        | 'priority'
        | 'estimateMs'
        | 'projectId'
      >
    >
  ): PomodoroTask | null {
    const existing = this.db
      .prepare(`SELECT * FROM pom_tasks WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as TaskRow | undefined
    if (!existing) return null

    const ts = now()
    const newTitle = updates.title?.trim() || existing.title
    const newDescription =
      updates.description !== undefined ? updates.description?.trim() || null : existing.description
    const newPriority =
      updates.priority !== undefined ? clampPriority(updates.priority) : existing.priority
    const newEstimateMs =
      updates.estimateMs !== undefined ? updates.estimateMs : existing.estimate_ms
    const newProjectId = updates.projectId !== undefined ? updates.projectId : existing.project_id
    const newCompletedAt =
      updates.completedAt !== undefined
        ? updates.completedAt
        : updates.completed === true
          ? (existing.completed_at ?? ts)
          : updates.completed === false
            ? null
            : existing.completed_at
    const newStatus = newCompletedAt ? 'completed' : existing.status

    this.db
      .prepare(
        `UPDATE pom_tasks
         SET title = ?, description = ?, estimate_ms = ?, status = ?, priority = ?,
             project_id = ?, completed_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(
        newTitle,
        newDescription,
        newEstimateMs,
        newStatus,
        newPriority,
        newProjectId,
        newCompletedAt,
        ts,
        id
      )
    return this.taskFromRow({
      ...existing,
      title: newTitle,
      description: newDescription,
      estimate_ms: newEstimateMs,
      status: newStatus,
      priority: newPriority,
      project_id: newProjectId,
      completed_at: newCompletedAt,
      updated_at: ts
    })
  }

  deleteTask(id: string): boolean {
    const ts = now()
    const r = this.db
      .prepare(
        `UPDATE pom_tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .run(ts, ts, id)
    return r.changes > 0
  }

  completeTask(id: string): PomodoroTask | null {
    return this.updateTask(id, { completed: true, completedAt: now() })
  }

  // --------- Records ---------

  getRecords(): PomodoroRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM pom_pomodoros ORDER BY started_at DESC`)
      .all() as RecordRow[]
    return rows.map((r) => this.recordFromRow(r))
  }

  /**
   * P1-1：按 taskId 取全部番茄记录（任务详情页用）。
   * - task_id = ? 包括所有历史（包括 task 已被软删除的情况）
   * - 按 started_at DESC 倒序
   */
  getRecordsByTaskId(taskId: string): PomodoroRecord[] {
    if (!taskId) return []
    const rows = this.db
      .prepare(`SELECT * FROM pom_pomodoros WHERE task_id = ? ORDER BY started_at DESC`)
      .all(taskId) as RecordRow[]
    return rows.map((r) => this.recordFromRow(r))
  }

  /**
   * P1-1：单 record 查询（含 task 关联信息）。
   * 返回 { record, task } — task 为 null 表示原 task 已被软删除。
   */
  getRecordDetail(id: string): { record: PomodoroRecord; task: PomodoroTask | null } | null {
    if (!id) return null
    const row = this.db.prepare(`SELECT * FROM pom_pomodoros WHERE id = ?`).get(id) as
      | RecordRow
      | undefined
    if (!row) return null

    let task: PomodoroTask | null = null
    if (row.task_id) {
      const taskRow = this.db
        .prepare(`SELECT * FROM pom_tasks WHERE id = ? AND deleted_at IS NULL`)
        .get(row.task_id) as TaskRow | undefined
      if (taskRow) task = this.taskFromRow(taskRow)
    }

    return { record: this.recordFromRow(row), task }
  }

  /**
   * P1-1：更新单番茄的 note（用户备注）。
   * - 允许空字符串（清除备注）
   * - trim 后写入；空字符串写入 NULL
   */
  updateRecordNote(id: string, note: string): PomodoroRecord | null {
    if (!id) return null
    const trimmed = note?.trim() ?? ''
    const value = trimmed === '' ? null : trimmed
    const result = this.db.prepare(`UPDATE pom_pomodoros SET note = ? WHERE id = ?`).run(value, id)
    if (result.changes === 0) return null
    const updated = this.getRecordDetail(id)
    return updated?.record ?? null
  }

  /**
   * P1-1：任务级聚合（详情页顶部摘要）。
   * - 仅统计 state = work 的有效专注番茄
   * - include estimateMs / projectId 便于展示
   */
  getTaskSummary(taskId: string): {
    taskId: string
    pomodoroCount: number
    workMs: number
    firstStartedAt: number | null
    lastCompletedAt: number | null
    estimateMs: number | null
    estimateDeviationMs: number | null
  } | null {
    if (!taskId) return null

    const taskRow = this.db
      .prepare(`SELECT id, estimate_ms FROM pom_tasks WHERE id = ? AND deleted_at IS NULL`)
      .get(taskId) as { id: string; estimate_ms: number | null } | undefined
    if (!taskRow) return null

    const agg = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt,
                COALESCE(SUM(duration_ms), 0) AS total_ms,
                MIN(started_at) AS first_at,
                MAX(COALESCE(ended_at, started_at)) AS last_at
         FROM pom_pomodoros
         WHERE task_id = ? AND state = 'work'`
      )
      .get(taskId) as {
      cnt: number
      total_ms: number
      first_at: number | null
      last_at: number | null
    }

    const estimateMs = taskRow.estimate_ms
    const workMs = agg.total_ms ?? 0
    const estimateDeviationMs = estimateMs && estimateMs > 0 ? workMs - estimateMs : null

    return {
      taskId,
      pomodoroCount: agg.cnt ?? 0,
      workMs,
      firstStartedAt: agg.first_at,
      lastCompletedAt: agg.last_at,
      estimateMs,
      estimateDeviationMs
    }
  }

  addRecord(record: Omit<PomodoroRecord, 'id' | 'date'>): PomodoroRecord {
    const ts = now()
    const id = uuidv4()
    const state = record.type
    this.db
      .prepare(
        `INSERT INTO pom_pomodoros (id, started_at, ended_at, duration_ms, state, task_id, task_title, note, project_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        ts,
        ts,
        record.duration,
        state,
        record.taskId ?? null,
        record.taskTitle ?? null,
        null, // note 字段保持为空，用户可以通过 updateRecordNote 添加备注
        record.projectId ?? null
      )
    const r: PomodoroRecord = {
      id,
      type: record.type,
      duration: record.duration,
      completedAt: ts,
      date: dateOf(ts)
    }
    if (record.taskId) r.taskId = record.taskId
    if (record.taskTitle) r.taskTitle = record.taskTitle
    if (record.projectId) r.projectId = record.projectId
    return r
  }

  getRecordsByDate(date: string): PomodoroRecord[] {
    // date 由 started_at 的本地日期派生（dateOf），用 started_at 本地区间过滤
    // 可命中 idx_pom_pomodoros_started_desc，避免全表加载后 JS 过滤
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
    const { start, end } = localDayRange(date)
    const rows = this.db
      .prepare(
        `SELECT * FROM pom_pomodoros
         WHERE started_at >= ? AND started_at < ?
         ORDER BY started_at DESC`
      )
      .all(start, end) as RecordRow[]
    return rows.map((r) => this.recordFromRow(r))
  }

  /** M4：未绑定任务 / 项目的所有 record（taskId 为 null/undefined） */
  getFreeRecords(): PomodoroRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM pom_pomodoros
         WHERE task_id IS NULL AND project_id IS NULL
         ORDER BY started_at DESC`
      )
      .all() as RecordRow[]
    return rows.map((r) => this.recordFromRow(r))
  }

  /** M6：按时间范围 / 项目 ID 过滤 */
  getRecordsByRange(opts: {
    from: number
    to: number
    projectId?: string | null
  }): PomodoroRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM pom_pomodoros
         WHERE COALESCE(ended_at, started_at) >= ? AND COALESCE(ended_at, started_at) <= ?
         ORDER BY started_at DESC`
      )
      .all(opts.from, opts.to) as RecordRow[]
    return rows
      .map((r) => this.recordFromRow(r))
      .filter((r) =>
        opts.projectId != null && opts.projectId !== '' ? r.projectId === opts.projectId : true
      )
  }

  getTodayRecords(): PomodoroRecord[] {
    const today = todayDate()
    return this.getRecordsByDate(today)
  }

  // YYYY-MM-DD helpers
  private weekStart(): Date {
    const t = new Date()
    const dayOfWeek = t.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    t.setDate(t.getDate() + diff)
    t.setHours(0, 0, 0, 0)
    return t
  }

  getThisWeekRecords(): PomodoroRecord[] {
    const startTs = this.weekStart().getTime()
    const rows = this.db
      .prepare(
        `SELECT * FROM pom_pomodoros
         WHERE COALESCE(ended_at, started_at) >= ?
         ORDER BY started_at DESC`
      )
      .all(startTs) as RecordRow[]
    return rows.map((r) => this.recordFromRow(r))
  }

  getThisMonthRecords(): PomodoroRecord[] {
    const n = new Date()
    const monthStart = new Date(n.getFullYear(), n.getMonth(), 1).getTime()
    const rows = this.db
      .prepare(
        `SELECT * FROM pom_pomodoros
         WHERE COALESCE(ended_at, started_at) >= ?
         ORDER BY started_at DESC`
      )
      .all(monthStart) as RecordRow[]
    return rows.map((r) => this.recordFromRow(r))
  }

  getStatistics(): PomodoroStatistics {
    const today = this.getTodayRecords()
    const week = this.getThisWeekRecords()
    const month = this.getThisMonthRecords()

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

  // --------- Settings ---------

  getSettings(): PomodoroSettings {
    if (this._db) {
      // 测试场景：直接读 pre-injected db 上的 pref_preferences 表
      const raw = this._db
        .prepare(`SELECT value FROM pref_preferences WHERE key = ?`)
        .get(SETTINGS_KEY) as { value: string } | undefined
      if (raw) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(raw.value) }
        } catch {
          return { ...DEFAULT_SETTINGS }
        }
      }
      return { ...DEFAULT_SETTINGS }
    }
    const raw = prefRepository.get(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  saveSettings(settings: Partial<PomodoroSettings>): void {
    const current = this.getSettings()
    const next = { ...current, ...settings }
    const value = JSON.stringify(next)
    if (this._db) {
      this._db
        .prepare(
          `INSERT INTO pref_preferences (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .run(SETTINGS_KEY, value, now())
      return
    }
    prefRepository.set(SETTINGS_KEY, value)
  }

  /** 批量导入（迁移用） */
  importTasks(tasks: PomodoroTask[]): number {
    const stmt = this.db.prepare(
      `INSERT INTO pom_tasks (id, title, status, priority, actual_ms, created_at, updated_at, completed_at, deleted_at)
       VALUES (?, ?, ?, 0, 0, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, status = excluded.status, completed_at = excluded.completed_at, updated_at = excluded.updated_at, deleted_at = NULL`
    )
    const tx = this.db.transaction((rows: PomodoroTask[]) => {
      let n = 0
      for (const t of rows) {
        stmt.run(
          t.id,
          t.title,
          t.completed ? 'completed' : 'pending',
          t.createdAt,
          t.createdAt,
          t.completedAt ?? null
        )
        n += 1
      }
      return n
    })
    return tx(tasks)
  }

  importRecords(records: PomodoroRecord[]): number {
    const stmt = this.db.prepare(
      `INSERT INTO pom_pomodoros (id, started_at, ended_at, duration_ms, state, task_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ended_at = excluded.ended_at, duration_ms = excluded.duration_ms, state = excluded.state`
    )
    const tx = this.db.transaction((rows: PomodoroRecord[]) => {
      let n = 0
      for (const r of rows) {
        stmt.run(
          r.id,
          r.completedAt,
          r.completedAt,
          r.duration,
          r.type,
          r.taskId ?? null,
          r.taskTitle ?? null
        )
        n += 1
      }
      return n
    })
    return tx(records)
  }

  /**
   * 导入 settings（落到 pref_preferences.pomodoro_settings key）。
   * 调用方传完整 settings 对象，写覆盖语义。
   */
  importSettings(settings: PomodoroSettings): boolean {
    prefRepository.set(SETTINGS_KEY, JSON.stringify(settings))
    return true
  }

  // ============================================================
  // Stats
  // ============================================================

  /**
   * Daily trend：返回过去 `days` 天（含今天）每日的工作分钟 / 番茄数 / 完成任务数。
   * 缺失日期补 0（前端无需再补帧）。
   */
  getDailyTrend(days: number, endDate: number = Date.now()): DailyTrendPoint[] {
    const safeDays = Math.max(1, Math.min(180, Math.floor(days)))
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    const start = end.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000
    const endExclusive = end.getTime() + 24 * 60 * 60 * 1000

    const pomodoroRows = this.db
      .prepare(
        `SELECT started_at, duration_ms, state, task_id
         FROM pom_pomodoros
         WHERE started_at >= ? AND started_at < ?
           AND state IN ('work', 'shortBreak', 'longBreak')`
      )
      .all(start, endExclusive) as Array<{
      started_at: number
      duration_ms: number
      state: string
      task_id: string | null
    }>

    const completedTaskRows = this.db
      .prepare(
        `SELECT completed_at
         FROM pom_tasks
         WHERE completed_at IS NOT NULL AND deleted_at IS NULL
           AND completed_at >= ? AND completed_at < ?`
      )
      .all(start, endExclusive) as Array<{ completed_at: number }>

    const byDay = new Map<string, DailyTrendPoint>()
    for (let i = 0; i < safeDays; i++) {
      const ts = start + i * 24 * 60 * 60 * 1000
      byDay.set(dateOf(ts), {
        date: dateOf(ts),
        workMinutes: 0,
        shortBreakMinutes: 0,
        longBreakMinutes: 0,
        completedPomodoros: 0,
        completedTasks: 0
      })
    }

    for (const row of pomodoroRows) {
      const day = dateOf(row.started_at)
      const bucket = byDay.get(day)
      if (!bucket) continue
      const minutes = Math.round(row.duration_ms / 60_000)
      if (row.state === 'work') {
        bucket.workMinutes += minutes
        bucket.completedPomodoros += 1
      } else if (row.state === 'shortBreak') {
        bucket.shortBreakMinutes += minutes
      } else if (row.state === 'longBreak') {
        bucket.longBreakMinutes += minutes
      }
    }

    for (const row of completedTaskRows) {
      if (row.completed_at === null) continue
      const day = dateOf(row.completed_at)
      const bucket = byDay.get(day)
      if (!bucket) continue
      bucket.completedTasks += 1
    }

    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 项目分布：在 [from, to) 区间内按 project_id 聚合工作分钟 / 番茄数。
   * - 优先使用 pom_pomodoros.project_id（P1-2 后写入）；
   * - 否则 fallback 到关联任务的 project_id（兼容旧记录）；
   * - projectId 为 null 时归入「未分类」一行。
   */
  getProjectDistribution(from: number, to: number): ProjectDistributionPoint[] {
    const safeFrom = Math.max(0, Math.floor(from))
    const safeTo = Math.max(safeFrom + 1, Math.floor(to))
    const rows = this.db
      .prepare(
        `SELECT pr.project_id AS rec_project_id,
                t.project_id AS task_project_id,
                p.id AS p_id, p.name AS p_name, p.color AS p_color,
                SUM(CASE WHEN pr.state = 'work' THEN pr.duration_ms ELSE 0 END) AS work_ms,
                SUM(CASE WHEN pr.state = 'work' THEN 1 ELSE 0 END) AS work_count
         FROM pom_pomodoros pr
         LEFT JOIN pom_tasks t ON pr.task_id = t.id AND t.deleted_at IS NULL
         LEFT JOIN pom_projects p
           ON p.id = COALESCE(pr.project_id, t.project_id) AND p.deleted_at IS NULL
         WHERE pr.started_at >= ? AND pr.started_at < ?
           AND pr.state IN ('work', 'shortBreak', 'longBreak')
         GROUP BY COALESCE(pr.project_id, t.project_id, '__none__')`
      )
      .all(safeFrom, safeTo) as Array<{
      rec_project_id: string | null
      task_project_id: string | null
      p_id: string | null
      p_name: string | null
      p_color: string | null
      work_ms: number | null
      work_count: number | null
    }>

    return rows.map((row) => ({
      projectId: row.rec_project_id ?? row.task_project_id ?? null,
      projectName: row.p_id ? (row.p_name ?? '未命名项目') : '未分类',
      color: row.p_color ?? '#8a8a8a',
      workMinutes: Math.round((row.work_ms ?? 0) / 60_000),
      completedPomodoros: row.work_count ?? 0
    }))
  }

  /**
   * 24×7 专注热力图：返回 [days × 24] 单元格。
   * startDate / endDate 默认为「最近 7 天 + 今天」。
   */
  getFocusHeatmap(days: number, endDate: number = Date.now()): HeatmapCell[] {
    const safeDays = Math.max(1, Math.min(60, Math.floor(days)))
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    const start = end.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000
    const endExclusive = end.getTime() + 24 * 60 * 60 * 1000

    const rows = this.db
      .prepare(
        `SELECT started_at, duration_ms
         FROM pom_pomodoros
         WHERE started_at >= ? AND started_at < ?
           AND state = 'work'`
      )
      .all(start, endExclusive) as Array<{ started_at: number; duration_ms: number }>

    const cells: HeatmapCell[] = []
    const map = new Map<string, HeatmapCell>()
    for (let i = 0; i < safeDays; i++) {
      const ts = start + i * 24 * 60 * 60 * 1000
      const date = dateOf(ts)
      for (let h = 0; h < 24; h++) {
        const cell: HeatmapCell = { day: i, hour: h, date, workMinutes: 0 }
        cells.push(cell)
        map.set(`${i}-${h}`, cell)
      }
    }
    for (const row of rows) {
      const ts = row.started_at
      const dayTs = new Date(ts)
      dayTs.setHours(0, 0, 0, 0)
      const day = Math.round((dayTs.getTime() - start) / (24 * 60 * 60 * 1000))
      const hour = new Date(ts).getHours()
      if (day < 0 || day >= safeDays) continue
      const cell = map.get(`${day}-${hour}`)
      if (!cell) continue
      cell.workMinutes += Math.round(row.duration_ms / 60_000)
    }
    return cells
  }

  /**
   * 任务完成统计：区间内 [from, to)。
   */
  getTaskCompletionStats(from: number, to: number): TaskCompletionStats {
    const safeFrom = Math.max(0, Math.floor(from))
    const safeTo = Math.max(safeFrom + 1, Math.floor(to))

    const totalRow = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM pom_tasks
         WHERE created_at < ? AND deleted_at IS NULL`
      )
      .get(safeTo) as { n: number }

    const completedRow = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM pom_tasks
         WHERE completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?
           AND deleted_at IS NULL`
      )
      .get(safeFrom, safeTo) as { n: number }

    const pomRow = this.db
      .prepare(
        `SELECT COUNT(*) AS pom_count, COUNT(DISTINCT task_id) AS task_count
         FROM pom_pomodoros
         WHERE state = 'work' AND started_at >= ? AND started_at < ?`
      )
      .get(safeFrom, safeTo) as { pom_count: number; task_count: number }

    const deviationRow = this.db
      .prepare(
        `SELECT AVG(actual_ms - estimate_ms) AS avg_dev,
                SUM(CASE WHEN actual_ms > estimate_ms THEN 1 ELSE 0 END) AS over,
                SUM(CASE WHEN actual_ms < estimate_ms THEN 1 ELSE 0 END) AS under
         FROM pom_tasks
         WHERE estimate_ms IS NOT NULL AND estimate_ms > 0
           AND actual_ms > 0
           AND deleted_at IS NULL
           AND completed_at IS NOT NULL
           AND completed_at >= ? AND completed_at < ?`
      )
      .get(safeFrom, safeTo) as { avg_dev: number | null; over: number; under: number }

    const total = totalRow.n
    const completed = completedRow.n
    const completionRate = total > 0 ? completed / total : 0
    const avgPomodorosPerTask = pomRow.task_count > 0 ? pomRow.pom_count / pomRow.task_count : 0
    const avgEstimateDeviationMs = deviationRow.avg_dev ?? 0

    return {
      total,
      completed,
      completionRate,
      completedPomodoros: pomRow.pom_count,
      avgPomodorosPerTask,
      avgEstimateDeviationMs,
      estimateOverCount: deviationRow.over,
      estimateUnderCount: deviationRow.under
    }
  }
}

export interface DailyTrendPoint {
  date: string
  workMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  completedPomodoros: number
  completedTasks: number
}

export interface ProjectDistributionPoint {
  projectId: string | null
  projectName: string
  color: string
  workMinutes: number
  completedPomodoros: number
}

export interface HeatmapCell {
  day: number
  hour: number
  date: string
  workMinutes: number
}

export interface TaskCompletionStats {
  total: number
  completed: number
  completionRate: number
  completedPomodoros: number
  avgPomodorosPerTask: number
  avgEstimateDeviationMs: number
  estimateOverCount: number
  estimateUnderCount: number
}

/** YYYY-MM-DD helper */
function dateOf(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function todayDate(): string {
  return dateOf(Date.now())
}

/** 本地时区 [当日 00:00, 次日 00:00) 毫秒区间（date 为 YYYY-MM-DD） */
function localDayRange(date: string): { start: number; end: number } {
  const [y, m, d] = date.split('-').map(Number)
  const start = new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
  const endDate = new Date(y, (m ?? 1) - 1, (d ?? 1) + 1)
  return { start, end: endDate.getTime() }
}

function clampPriority(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(2, Math.round(value)))
}

export const pomodoroRepository = new PomodoroRepository()

