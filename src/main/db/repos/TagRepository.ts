/**
 * Leaf · TagRepository
 *
 * 职责：管理 tag_tags 表（全局标签字典）。
 * 取代 TagDataStore 的核心 CRUD。
 *
 * Schema: tag_tags(id TEXT PK, name TEXT, color TEXT, icon TEXT, parent_id TEXT, description TEXT, usage_count INTEGER, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)
 * UNIQUE(name) WHERE deleted_at IS NULL（partial unique index，迁移 002 建立）
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'

export interface TagRow {
  id: string
  name: string
  color: string | null
  icon: string | null
  parent_id: string | null
  usage_count: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

export class TagRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  /** 所有未删除标签，按 name 升序 */
  all(): TagRow[] {
    return this.db
      .prepare('SELECT * FROM tag_tags WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE')
      .all() as TagRow[]
  }

  /** 按 id 取 */
  getById(id: string): TagRow | null {
    return (
      (this.db.prepare('SELECT * FROM tag_tags WHERE id = ? AND deleted_at IS NULL').get(id) as
        | TagRow
        | undefined) ?? null
    )
  }

  /** 按 name 取（不区分大小写） */
  getByName(name: string): TagRow | null {
    return (
      (this.db
        .prepare('SELECT * FROM tag_tags WHERE LOWER(name) = LOWER(?) AND deleted_at IS NULL')
        .get(name) as TagRow | undefined) ?? null
    )
  }

  /** 按 ids 批量取 */
  getByIds(ids: string[]): TagRow[] {
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    return this.db
      .prepare(`SELECT * FROM tag_tags WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
      .all(...ids) as TagRow[]
  }

  /**
   * 新建标签。同名（不区分大小写）已存在则返回已有行。
   * name 必填，自动 trim。
   */
  create(name: string, opts?: { color?: string; icon?: string; parentId?: string }): TagRow {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('[TagRepository] name is required')
    // 审查补齐：与 update 对齐，父不存在直接报错，不写悬挂引用
    if (opts?.parentId && !this.getById(opts.parentId)) {
      throw new Error('[TagRepository] parentId does not exist')
    }

    const existing = this.getByName(trimmed)
    if (existing) return existing

    const ts = now()
    const row: TagRow = {
      id: uuidv4(),
      name: trimmed,
      color: opts?.color ?? null,
      icon: opts?.icon ?? null,
      parent_id: opts?.parentId ?? null,
      usage_count: 0,
      created_at: ts,
      updated_at: ts,
      deleted_at: null
    }
    this.db
      .prepare(
        `INSERT INTO tag_tags (id, name, color, icon, parent_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(row.id, row.name, row.color, row.icon, row.parent_id, row.created_at, row.updated_at)
    return row
  }

  /** 更新（name 重复返回 null；color/icon 传 null 表示不变更；parentId 传 null 表示不变更、传空串表示清除） */
  update(
    id: string,
    updates: {
      name?: string
      color?: string | null
      icon?: string | null
      parentId?: string | null
    }
  ): TagRow | null {
    const existing = this.getById(id)
    if (!existing) return null

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim()
      if (!trimmed) throw new Error('[TagRepository] name cannot be empty')
      const conflict = this.getByName(trimmed)
      if (conflict && conflict.id !== id) return null
      updates = { ...updates, name: trimmed }
    }

    // 六期标签分组：null/'' 清除父级；挂父级时禁止自挂与成环，父不存在视为不变更
    let nextParentId: string | null = null
    let parentTouched = false
    if (updates.parentId !== undefined) {
      parentTouched = true
      if (updates.parentId === '' || updates.parentId === null) {
        nextParentId = null
      } else if (updates.parentId === id) {
        return null
      } else {
        const parent = this.getById(updates.parentId)
        if (!parent) return null
        let cursor: TagRow | null = parent
        while (cursor) {
          if (cursor.id === id) return null // 会形成环
          cursor = cursor.parent_id ? this.getById(cursor.parent_id) : null
        }
        nextParentId = parent.id
      }
    }

    const ts = now()
    if (parentTouched) {
      this.db
        .prepare(
          `UPDATE tag_tags
           SET name = COALESCE(?, name),
               color = COALESCE(?, color),
               icon = COALESCE(?, icon),
               parent_id = ?,
               updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(
          updates.name ?? null,
          updates.color ?? null,
          updates.icon ?? null,
          nextParentId,
          ts,
          id
        )
    } else {
      this.db
        .prepare(
          `UPDATE tag_tags
           SET name = COALESCE(?, name),
               color = COALESCE(?, color),
               icon = COALESCE(?, icon),
               updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(updates.name ?? null, updates.color ?? null, updates.icon ?? null, ts, id)
    }
    return this.getById(id)
  }

  /** 软删除 */
  softDelete(id: string): boolean {
    const ts = now()
    const result = this.db
      .prepare(
        'UPDATE tag_tags SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL'
      )
      .run(ts, ts, id)
    return result.changes > 0
  }

  /** 引用计数调整（photo_tags 增删时调用，下限 0） */
  bumpUsage(id: string, delta: number): void {
    this.db
      .prepare(`UPDATE tag_tags SET usage_count = MAX(0, usage_count + ?) WHERE id = ?`)
      .run(delta, id)
  }

  /** 批量导入（用于迁移）。冲突条目（重名命中 partial unique index 等）跳过计数：
   * 若让整条语句抛错回滚事务，legacy 数据里任何一条重名都会让 v1 迁移
   * 永不标记 done，每次启动重跑报错、legacy JSON 永不归档 */
  importMany(entries: Array<{ id: string; name: string; createdAt: number }>): number {
    const stmt = this.db.prepare(
      `INSERT INTO tag_tags (id, name, color, icon, parent_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, NULL, NULL, NULL, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`
    )
    let n = 0
    for (const r of entries) {
      try {
        stmt.run(r.id, r.name, r.createdAt, r.createdAt)
        n += 1
      } catch {
        /* 冲突条目跳过 */
      }
    }
    return n
  }
}

export const tagRepository = new TagRepository()
