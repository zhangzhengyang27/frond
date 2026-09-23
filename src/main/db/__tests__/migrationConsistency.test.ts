/**
 * Frond · 迁移与仓储一致性测试
 *
 * 背景：本仓库历史上最贵的一类 bug 不是逻辑写错，而是 **schema 与代码脱节**——
 * 028 迁移把 `ss_screenshots` 表 DROP 掉了，`ScreenshotRepository` 却整篇 SQL
 * 还指着它。TypeScript 完全看不见这种断裂（SQL 只是字符串），只有真的执行到
 * 那一行才会炸；而那条路径平时没人走，于是能安静地烂很久。
 *
 * 本测试把「真实迁移建出来的 schema」当作唯一真相，反向校验 `repos/*.ts` 里
 * 出现的每一张表都确实存在。三条断言各自带**体量哨兵**（体积下限），
 * 防止「扫描退化成扫了个空集合」也算通过。
 *
 * 失败时的读法：
 *   - 报 `ss_screenshots` → 该仓储是已下线模块的残留，删掉它
 *   - 报 `xxx_fts`       → 虚拟表没建出来，检查建表迁移
 *   - 报某个 CTE 名      → 让 CTE_RE 覆盖那种写法，或补进 NON_TABLE_TOKENS
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { migrations } from '../migrations'

const REPOS_DIR = join(__dirname, '..', 'repos')

/**
 * 生产同款迁移执行器 —— `database.ts::runMigrations` 的等价物。
 * 刻意不 import 生产那份：它依赖 electron 的 app.getPath，测试里跑不起来。
 * 逻辑必须保持一致：建 meta → 取 MAX(version) → 只跑更高版本的迁移。
 */
function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`)

  const row = db.prepare('SELECT MAX(version) AS v FROM meta').get() as { v: number | null }
  let current = row.v ?? 0

  for (const m of migrations) {
    if (m.version <= current) continue
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
    current = m.version
  }
}

/** sqlite_master 里的真实表名（FTS 虚拟表与其影子表都是 type='table'） */
function tableNames(db: Database.Database): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
      name: string
    }>
  ).map((r) => r.name)
}

/**
 * 剥掉注释再扫，否则「文档里写了一句 `FROM xxx`」会被当成真引用。
 * 处理三种：块注释、整行 `//`、SQL 行尾 `--`。
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const t = line.trimStart()
      if (t.startsWith('//')) return ''
      const dash = line.indexOf('--')
      return dash === -1 ? line : line.slice(0, dash)
    })
    .join('\n')
}

/** SQL 里「引用的表」的四种语法位置 */
const TABLE_REF_RE = /\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi

/** CTE 名（`WITH x AS (` / `, y AS (`）——它们不是表，剔掉避免误报 */
const CTE_RE = /\b(?:WITH|,)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\([^)]*\))?\s+AS\s*\(/gi

/** 关键字误捕与表值函数：`DO UPDATE SET`、`FROM json_each(?)` 之类 */
const NON_TABLE_TOKENS = new Set([
  'set',
  'select',
  'values',
  'json_each',
  'json_tree',
  'pragma_table_info'
])

/** 扫描 repos/*.ts，返回 表名 → 首次出现的文件名（便于报错定位） */
function referencedTables(): Map<string, string> {
  const found = new Map<string, string>()
  const cteNames = new Set<string>()

  const files = readdirSync(REPOS_DIR).filter((f) => f.endsWith('.ts'))
  for (const file of files) {
    const sql = stripComments(readFileSync(join(REPOS_DIR, file), 'utf-8'))
    for (const m of sql.matchAll(TABLE_REF_RE)) {
      const name = m[1].toLowerCase()
      if (NON_TABLE_TOKENS.has(name)) continue
      if (!found.has(name)) found.set(name, file)
    }
    for (const m of sql.matchAll(CTE_RE)) cteNames.add(m[1].toLowerCase())
  }

  // 统一剔除 CTE 名：必须等全部文件扫完再剔，否则同文件里 CTE 之后的引用会被重新加回
  for (const n of cteNames) found.delete(n)
  return found
}

describe('迁移与仓储一致性', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
  })

  afterEach(() => {
    db.close()
  })

  it('空库从 0 跑到最新迁移：不抛，且 meta 记满全部版本', () => {
    runMigrations(db)

    const applied = db.prepare('SELECT version FROM meta ORDER BY version').all() as Array<{
      version: number
    }>
    expect(applied.map((r) => r.version)).toEqual(migrations.map((m) => m.version))
    // 哨兵：迁移数掉到个位数说明数组被截断了，这条断言就失去意义
    expect(applied.length).toBeGreaterThan(25)
  })

  it('迁移幂等：同一库上再跑一遍不抛，且表集合不增不减', () => {
    runMigrations(db)
    const before = tableNames(db).sort()

    expect(() => runMigrations(db)).not.toThrow()

    expect(tableNames(db).sort()).toEqual(before)
    expect(before.length).toBeGreaterThan(15)
  })

  it('migrations 数组的 version 严格递增且无重复', () => {
    const versions = migrations.map((m) => m.version)
    expect(versions.length).toBeGreaterThan(25)
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1])
    }
  })

  it('repos/*.ts 引用的每一张表都真实存在（抓 schema 与代码脱节）', () => {
    runMigrations(db)
    const tables = new Set(tableNames(db))
    // 哨兵：schema 若是空的，下面的「都存在」就恒真
    expect(tables.size).toBeGreaterThan(15)

    const refs = referencedTables()
    // 哨兵：正则若失灵一个都没匹配到，下面的断言同样恒真
    expect(refs.size).toBeGreaterThan(10)

    const missing = [...refs.entries()]
      .filter(([name]) => !tables.has(name))
      .map(([name, file]) => `${name}（被 ${file} 引用，但 schema 里没有这张表）`)

    expect(missing).toEqual([])
  })
})
