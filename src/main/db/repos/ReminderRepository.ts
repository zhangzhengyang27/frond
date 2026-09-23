/**
 * Frond · ReminderRepository
 *
 * 提醒事项数据访问层：
 * - reminders 主表 + reminders_fts 全文搜索
 * - 支持 CRUD、完成/取消完成、软删除、按到期时间排序、全文搜索
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'

export interface Reminder {
  id: string
  title: string
  notes: string
  dueAt: number | null
  remindAt: number | null
  isCompleted: boolean
  isDeleted: boolean
  completedAt: number | null
  /** 最后一次发送通知的时间，NULL 表示从未通知过 */
  notifiedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface ReminderFilter {
  isCompleted?: boolean
  isDeleted?: boolean
  search?: string
  /** 只返回 remind_at <= 此时间戳的未完成提醒（用于定时通知扫描） */
  dueBefore?: number
}

interface ReminderRow {
  id: string
  title: string
  notes: string
  due_at: number | null
  remind_at: number | null
  is_completed: number
  is_deleted: number
  completed_at: number | null
  notified_at: number | null
  created_at: number
  updated_at: number
}

export class ReminderRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  private fromRow(row: ReminderRow): Reminder {
    return {
      id: row.id,
      title: row.title,
      notes: row.notes,
      dueAt: row.due_at,
      remindAt: row.remind_at,
      isCompleted: row.is_completed === 1,
      isDeleted: row.is_deleted === 1,
      completedAt: row.completed_at,
      notifiedAt: row.notified_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  list(filter: ReminderFilter = {}): Reminder[] {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (filter.isCompleted !== undefined) {
      conditions.push('is_completed = @isCompleted')
      params.isCompleted = filter.isCompleted ? 1 : 0
    }
    if (filter.isDeleted !== undefined) {
      conditions.push('is_deleted = @isDeleted')
      params.isDeleted = filter.isDeleted ? 1 : 0
    }
    if (filter.dueBefore !== undefined) {
      conditions.push('remind_at IS NOT NULL AND remind_at <= @dueBefore AND is_completed = 0')
      params.dueBefore = filter.dueBefore
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const order = 'ORDER BY is_completed ASC, COALESCE(remind_at, due_at, created_at) ASC'

    const search = filter.search?.trim()
    if (search) {
      return this.searchByKeyword(search, conditions, params)
    }

    const rows = this.db
      .prepare(`SELECT * FROM reminders ${where} ${order}`)
      .all(params) as ReminderRow[]
    return rows.map((r) => this.fromRow(r))
  }

  /**
   * 关键词搜索：FTS5 优先（英文可按词排序），无命中时回退 LIKE。
   *
   * FTS5 默认 unicode61 会把连续汉字视为单个 token，中文只有「前缀」能命中
   * （「开会讨论排期」搜「开会」可以，搜「排期」不行），所以中文子串必须由
   * LIKE 兜底，否则备注/标题里的中间词永远搜不到。
   */
  private searchByKeyword(
    search: string,
    conditions: string[],
    params: Record<string, unknown>
  ): Reminder[] {
    const prefixed = conditions.map((c) =>
      c.replace(/^(is_completed|is_deleted|remind_at)\b/, 'r.$1')
    )
    const extra = prefixed.length > 0 ? `AND ${prefixed.join(' AND ')}` : ''
    try {
      const rows = this.db
        .prepare(
          `SELECT r.* FROM reminders r
             JOIN reminders_fts f ON f.rowid = r.rowid
             WHERE f MATCH @search ${extra}
             ORDER BY rank`
        )
        .all({ ...params, search: `"${search}"*` }) as ReminderRow[]
      if (rows.length > 0) return rows.map((r) => this.fromRow(r))
    } catch {
      /* FTS 不可用（表缺失 / 语法不支持）时静默回退到 LIKE */
    }

    const likeCond = `(title LIKE @like OR notes LIKE @like)`
    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')} AND ${likeCond}`
        : `WHERE ${likeCond}`
    const rows = this.db
      .prepare(
        `SELECT * FROM reminders ${where} ORDER BY is_completed ASC, COALESCE(remind_at, due_at, created_at) ASC`
      )
      .all({ ...params, like: `%${search}%` }) as ReminderRow[]
    return rows.map((r) => this.fromRow(r))
  }

  get(id: string): Reminder | null {
    const row = this.db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as
      | ReminderRow
      | undefined
    return row ? this.fromRow(row) : null
  }

  create(data: {
    title: string
    notes?: string
    dueAt?: number | null
    remindAt?: number | null
  }): Reminder {
    const trimmedTitle = data.title.trim()
    if (!trimmedTitle) {
      throw new Error('Reminder title cannot be empty')
    }
    const id = uuidv4()
    const ts = now()
    this.db
      .prepare(
        `INSERT INTO reminders (id, title, notes, due_at, remind_at, is_completed, is_deleted, completed_at, created_at, updated_at)
         VALUES (@id, @title, @notes, @dueAt, @remindAt, 0, 0, NULL, @createdAt, @updatedAt)`
      )
      .run({
        id,
        title: trimmedTitle,
        notes: data.notes ?? '',
        dueAt: data.dueAt ?? null,
        remindAt: data.remindAt ?? null,
        createdAt: ts,
        updatedAt: ts
      })
    return this.get(id)!
  }

  update(
    id: string,
    patch: Partial<Pick<Reminder, 'title' | 'notes' | 'dueAt' | 'remindAt'>>
  ): Reminder | null {
    const existing = this.get(id)
    if (!existing) return null
    const ts = now()
    this.db
      .prepare(
        `UPDATE reminders SET title = @title, notes = @notes, due_at = @dueAt, remind_at = @remindAt, updated_at = @updatedAt WHERE id = @id`
      )
      .run({
        id,
        title: patch.title ?? existing.title,
        notes: patch.notes ?? existing.notes,
        dueAt: patch.dueAt !== undefined ? patch.dueAt : existing.dueAt,
        remindAt: patch.remindAt !== undefined ? patch.remindAt : existing.remindAt,
        updatedAt: ts
      })
    return this.get(id)
  }

  complete(id: string): Reminder | null {
    const existing = this.get(id)
    if (!existing) return null
    const ts = now()
    this.db
      .prepare(
        'UPDATE reminders SET is_completed = 1, completed_at = @completedAt, updated_at = @updatedAt WHERE id = @id'
      )
      .run({ id, completedAt: ts, updatedAt: ts })
    return this.get(id)
  }

  uncomplete(id: string): Reminder | null {
    const existing = this.get(id)
    if (!existing) return null
    const ts = now()
    this.db
      .prepare(
        'UPDATE reminders SET is_completed = 0, completed_at = NULL, updated_at = @updatedAt WHERE id = @id'
      )
      .run({ id, updatedAt: ts })
    return this.get(id)
  }

  remove(id: string): boolean {
    const result = this.db
      .prepare('UPDATE reminders SET is_deleted = 1, updated_at = ? WHERE id = ?')
      .run(now(), id)
    return result.changes > 0
  }

  permanentDelete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM reminders WHERE id = ?').run(id)
    return result.changes > 0
  }

  /** 统计未完成且未删除的提醒数量 */
  countActive(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM reminders WHERE is_completed = 0 AND is_deleted = 0')
      .get() as { cnt: number }
    return row.cnt
  }

  /** 标记提醒已通知（更新 notified_at 为当前时间） */
  markNotified(id: string): boolean {
    const result = this.db
      .prepare('UPDATE reminders SET notified_at = ?, updated_at = ? WHERE id = ?')
      .run(now(), now(), id)
    return result.changes > 0
  }

  /** 重置通知状态（将 notified_at 设为 NULL，用于提醒时间改为未来时） */
  resetNotified(id: string): boolean {
    const result = this.db
      .prepare('UPDATE reminders SET notified_at = NULL, updated_at = ? WHERE id = ?')
      .run(now(), id)
    return result.changes > 0
  }
}

export const reminderRepository = new ReminderRepository()
