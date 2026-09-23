import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { migrations } from '../migrations'
import { SYNC_TABLE_SPECS } from '../../launcher/dataSync'

/**
 * 同步表规格必须对得上真实 schema。
 *
 * 起因：`reminders` 的 titleCol 写成 'text'、`pom_tasks` 写成 'name'，而两张表的标题列
 * 其实都叫 `title`。冲突时 syncMerge 做的是 `copy[titleCol] = '…（冲突副本 …）'`
 * （syncMerge.ts:146-148）—— 列名对不上就等于副本上永远不打标记，用户分不清哪条是赢家，
 * 而这在运行时一声不响。这类错光看代码看不出来，只能拿真 schema 顶一遍。
 */
function builtDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(
    `CREATE TABLE IF NOT EXISTS meta (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)`
  )
  for (const m of migrations) {
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
  return db
}

function columnsOf(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return new Set(rows.map((r) => r.name))
}

describe('SYNC_TABLE_SPECS 与真实 schema', () => {
  // 库要活到用例跑完：早先在 describe 体里 try/finally close，用例拿到的是已关闭的连接
  let db: Database.Database
  beforeAll(() => {
    db = builtDb()
  })
  afterAll(() => db.close())

  const copySpecs = SYNC_TABLE_SPECS.filter((s) => s.conflict === 'copy')
  expect(copySpecs.length).toBeGreaterThan(0)

  for (const spec of copySpecs) {
    it(`${spec.table}：主键与标题列都在真表里`, () => {
      const cols = columnsOf(db, spec.table)
      expect(cols.size, `表 ${spec.table} 不存在或没有列`).toBeGreaterThan(0)
      for (const pk of spec.pk) expect(cols.has(pk), `pk 列 ${pk} 不在 ${spec.table}`).toBe(true)
      // copy 策略离不开标题列（syncMerge 靠它写「冲突副本」标记）
      expect(spec.titleCol, `${spec.table} 是 copy 策略却没给 titleCol`).toBeTruthy()
      expect(
        cols.has(spec.titleCol as string),
        `${spec.table} 没有标题列 ${spec.titleCol}（真表的列：${[...cols].join(', ')}）`
      ).toBe(true)
    })
  }

  it('每张表的 pk 恰好是 idCol（副本改名要按它定位）', () => {
    for (const spec of SYNC_TABLE_SPECS) {
      if (!spec.idCol) continue
      const cols = columnsOf(db, spec.table)
      expect(cols.size, `表 ${spec.table} 不存在`).toBeGreaterThan(0)
      expect(spec.pk, `${spec.table} 的 pk 应与 idCol 一致`).toEqual([spec.idCol])
    }
  })
})
