import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { UsageRepository } from '../UsageRepository'

/**
 * P-3 frecency 全类型后的量级护栏：usage_records 总量 cap（4000），
 * 收藏 key 豁免。直接注入内存库测 pruneUsageRows 本体。
 */
function makeRepo(): { repo: UsageRepository; db: Database.Database } {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE usage_records (module_id TEXT PRIMARY KEY, used_at INTEGER, use_count INTEGER DEFAULT 1);
    CREATE TABLE usage_favorites (module_id TEXT PRIMARY KEY, created_at INTEGER);
  `)
  return { repo: new UsageRepository(db), db }
}

const count = (db: Database.Database): number =>
  (db.prepare('SELECT COUNT(*) AS n FROM usage_records').get() as { n: number }).n

describe('UsageRepository.pruneUsageRows（P-3 量级护栏）', () => {
  it('保留最近 keep 条，更旧的删除', () => {
    const { repo, db } = makeRepo()
    const ins = db.prepare('INSERT INTO usage_records (module_id, used_at) VALUES (?, ?)')
    for (let i = 1; i <= 4100; i++) ins.run(`file:/p/${i}`, i)
    repo.pruneUsageRows()
    expect(count(db)).toBe(4000)
    // 最老的 100 条没了，第 101 新的还在
    expect(db.prepare('SELECT 1 FROM usage_records WHERE module_id = ?').get('file:/p/100')).toBeUndefined()
    expect(db.prepare('SELECT 1 FROM usage_records WHERE module_id = ?').get('file:/p/101')).toBeDefined()
  })

  it('收藏 key 豁免：再旧也不删', () => {
    const { repo, db } = makeRepo()
    const ins = db.prepare('INSERT INTO usage_records (module_id, used_at) VALUES (?, ?)')
    for (let i = 1; i <= 4100; i++) ins.run(`file:/p/${i}`, i)
    // 最老的一条是收藏
    db.prepare('INSERT INTO usage_favorites (module_id, created_at) VALUES (?, ?)').run(
      'file:/p/1',
      1
    )
    repo.pruneUsageRows()
    expect(count(db)).toBe(4001) // 4000 最新 + 1 收藏豁免
    expect(
      db.prepare('SELECT 1 FROM usage_records WHERE module_id = ?').get('file:/p/1')
    ).toBeDefined()
  })

  it('低于 cap 时是 no-op；recordUse 连写 64 次触发自动修剪不抛错', () => {
    const { repo, db } = makeRepo()
    for (let i = 0; i < 10; i++) repo.recordUse(`module:${i}`)
    repo.pruneUsageRows()
    expect(count(db)).toBe(10)
    // 第 64 次写入触发 maybePrune（私有），这里用 recordUse 连写验证路径通
    expect(() => {
      for (let i = 0; i < 64; i++) repo.recordUse('app:/Applications/Zed.app')
    }).not.toThrow()
    expect(count(db)).toBe(11)
  })
})
