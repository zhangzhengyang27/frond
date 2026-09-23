import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrations, type Migration } from '../migrations'

/**
 * Frond · 迁移注册表测试
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

  it('031 改名：leaf_meta 的幂等标志位搬进 frond_meta 且不丢行', () => {
    // 造一个「改名前的老库」：跑到 030，再手工建 leaf_meta 与带旧插件 id 的文档行
    runMigrations(db, migrations.slice(0, -1))
    db.exec(`CREATE TABLE leaf_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER)`)
    db.prepare(`INSERT INTO leaf_meta VALUES ('data_migration_v2', '1', 1)`).run()
    db.prepare(
      `INSERT INTO launcher_docs (doc_id, plugin_id, data, updated_at) VALUES ('com.leaf.jwt:help', 'com.leaf.jwt', '{}', 1)`
    ).run()

    runMigrations(db, migrations.slice(-1))

    expect(tableNames(db)).not.toContain('leaf_meta')
    // 标志位还在：丢了它 dataMigrations 会把 electron-store 老数据再导入一遍
    expect(db.prepare(`SELECT value FROM frond_meta WHERE key = 'data_migration_v2'`).get()).toEqual(
      { value: '1' }
    )
    expect(
      db.prepare(`SELECT doc_id, plugin_id FROM launcher_docs WHERE plugin_id = 'com.frond.jwt'`).get()
    ).toEqual({ doc_id: 'com.frond.jwt:help', plugin_id: 'com.frond.jwt' })
    // 再跑一次没有可改的行（幂等）
    expect(() => runMigrations(db, migrations.slice(-1))).not.toThrow()
  })

  it.todo('018 下线图片管理/壁纸模块：photo_* / wall_* / lib_files 表已删除')
})
