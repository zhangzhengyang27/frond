/**
 * Leaf · Repository 公共工具
 *
 * 约定：
 * - 所有 repository 拿 `database.handle`（确保 app 已 ready）
 * - write 路径都用 prepared statement + 单条事务
 * - error 必须抛，service 层负责兜底（IPC wrapper 转）
 * - 业务表默认过滤 `deleted_at IS NULL`
 */

import type Database from 'better-sqlite3'

/** 业务表公共字段（软删除 + 时间戳） */
export interface SoftRow {
  id: string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

/** Repository 共享的 stmt 缓存接口，按需继承 */
export interface StmtCache {
  [key: string]: Database.Statement
}

/** ready 行不存在 → 抛 NotFound；不存在被当作 bug */
export function mustGet<T>(row: T | undefined, what: string, id: string): T {
  if (row === undefined) {
    throw new Error(`[repo] ${what} not found: ${id}`)
  }
  return row
}

/** 把 unix ms 时间戳标准化为「现在」 */
export function now(): number {
  return Date.now()
}

/**
 * LIKE 子串匹配参数：转义 % _ \ 三种通配字符。
 * 配合 `LIKE ? ESCAPE '\'` 使用——否则用户输入 % / _ 会被当通配符（输入 % 匹配全部）。
 */
export function likeContains(search: string): string {
  return `%${String(search).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
}

/** 软删除：UPDATE ... SET deleted_at = ? */
export const SQL_SOFT_DELETE = (table: string, idCol = 'id'): string =>
  `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE ${idCol} = ? AND deleted_at IS NULL`

/** 硬删除：DELETE FROM ... WHERE id = ? */
export const SQL_HARD_DELETE = (table: string, idCol = 'id'): string =>
  `DELETE FROM ${table} WHERE ${idCol} = ?`
