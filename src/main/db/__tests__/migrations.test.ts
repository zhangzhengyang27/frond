import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrations, type Migration } from '../migrations'

/**
 * Leaf · 迁移注册表测试
 *
 * 内存库跑全量迁移（用的就是应用启动时那一份 migrations 数组，不另建 schema），
 * 断言「已下线模块的表确实不在」。
 *
 * ⚠ 恢复说明：本文件随 2026-09-22 删除事故丢过头尾——开头的 import/beforeEach 与
 * 最后两个 it 的断言主体没能找回。018 那条已降级为 it.todo（不猜它原来断言了什么）。
 */

function runMigrations(db: Database.Database, ms: Migration[]): void {
  for (const m of ms) m.up(db)
}

function tableNames(db: Database.Database): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
    name: string
  }>).map((r) => r.name)
}

describe('migrations', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
  })

  it('028 下线截图模块：ss_screenshots 表已删除', () => {
    runMigrations(db, migrations)
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
      name: string
    }>
    expect(rows.map((r) => r.name)).not.toContain('ss_screenshots')
  })

  it('026 给 rec_markers 加上 color 列（MarkerRepository 会在 SELECT 里取它）', () => {
    runMigrations(db, migrations)
    const cols = db.prepare('PRAGMA table_info(rec_markers)').all() as Array<{ name: string }>
    expect(cols.map((c) => c.name)).toContain('color')
  })

  it('027 之后 rec_clips 不再存在，且重复执行迁移仍幂等', () => {
    runMigrations(db, migrations)
    expect(tableNames(db)).not.toContain('rec_clips')
    expect(() => runMigrations(db, migrations)).not.toThrow()
  })

  it.todo('018 下线图片管理/壁纸模块：photo_* / wall_* / lib_files 表已删除')
})
