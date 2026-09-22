/**
 * Leaf · UsageRepository
 *
 * 取代 plan 中的 usageStore（之前没有 facade，Hub 一直用占位）。
 *
 * 表：
 * - usage_records(module_id, used_at) — 最近使用
 * - usage_favorites(module_id, created_at) — 收藏
 *
 * 设计：
 * - module_id 是字符串 id（见 constants/modules.ts MODULES.id）
 * - 没有 deleted_at：用户不能「删除最近使用」，只能新增/覆盖
 * - 收藏可 add / remove
 *
 * 业务接口：
 * - recordUse(moduleId)         记录一次使用（upsert by module_id，used_at 覆盖）
 * - getRecent(limit = 6)        拉最近使用的 module id 列表（按 used_at DESC）
 * - clearRecent()               清空最近使用
 * - addFavorite(moduleId)       加收藏
 * - removeFavorite(moduleId)    取消收藏
 * - isFavorite(moduleId)        是否已收藏
 * - getFavorites()              拉收藏的 module id 列表（按 created_at ASC）
 * - toggleFavorite(moduleId)    切换收藏状态（返回新状态）
 */

import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'

export class UsageRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  recordUse(moduleId: string): void {
    this.db
      .prepare(
        `INSERT INTO usage_records (module_id, used_at, use_count) VALUES (?, ?, 1)
         ON CONFLICT(module_id) DO UPDATE SET
           used_at = excluded.used_at,
           use_count = usage_records.use_count + 1`
      )
      .run(moduleId, now())
    this.emitUsageChanged()
  }

  /** 全量使用统计（渲染端排序自学习用）：moduleId → { useCount, usedAt } */
  getUsageStats(): Map<string, { useCount: number; usedAt: number }> {
    const rows = this.db
      .prepare(`SELECT module_id, used_at, use_count FROM usage_records`)
      .all() as Array<{ module_id: string; used_at: number; use_count: number }>
    const map = new Map<string, { useCount: number; usedAt: number }>()
    for (const r of rows) {
      map.set(r.module_id, { useCount: r.use_count, usedAt: r.used_at })
    }
    return map
  }

  getRecent(limit = 6): string[] {
    const rows = this.db
      .prepare(`SELECT module_id FROM usage_records ORDER BY used_at DESC LIMIT ?`)
      .all(limit) as Array<{ module_id: string }>
    return rows.map((r) => r.module_id)
  }

  clearRecent(): void {
    this.db.prepare(`DELETE FROM usage_records`).run()
    this.emitUsageChanged()
  }

  addFavorite(moduleId: string): void {
    this.db
      .prepare(
        `INSERT INTO usage_favorites (module_id, created_at) VALUES (?, ?)
         ON CONFLICT(module_id) DO NOTHING`
      )
      .run(moduleId, now())
    this.emitUsageChanged()
  }

  removeFavorite(moduleId: string): void {
    this.db.prepare(`DELETE FROM usage_favorites WHERE module_id = ?`).run(moduleId)
    this.emitUsageChanged()
  }

  isFavorite(moduleId: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 AS x FROM usage_favorites WHERE module_id = ? LIMIT 1`)
      .get(moduleId) as { x: number } | undefined
    return !!row
  }

  /** 按收藏顺序返回（先收藏的在前面） */
  getFavorites(): string[] {
    const rows = this.db
      .prepare(`SELECT module_id FROM usage_favorites ORDER BY created_at ASC`)
      .all() as Array<{ module_id: string }>
    return rows.map((r) => r.module_id)
  }

  toggleFavorite(moduleId: string): boolean {
    if (this.isFavorite(moduleId)) {
      this.removeFavorite(moduleId)
      this.emitUsageChanged()
      return false
    }
    this.addFavorite(moduleId)
    this.emitUsageChanged()
    return true
  }

  // ─── 变更事件（tray/dock 菜单按需重建用，替代盲轮询）───

  private usageListeners = new Set<() => void>()

  /** 订阅 usage 变更（recent/favorites 增删）；返回退订函数 */
  onUsageChanged(fn: () => void): () => void {
    this.usageListeners.add(fn)
    return () => {
      this.usageListeners.delete(fn)
    }
  }

  private emitUsageChanged(): void {
    for (const fn of this.usageListeners) {
      try {
        fn()
      } catch {
        /* 监听者异常不影响写入方 */
      }
    }
  }
}

export const usageRepository = new UsageRepository()
