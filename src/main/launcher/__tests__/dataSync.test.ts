import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach } from 'vitest'
import { migrations } from '../../db/migrations'

/** 与 migrations.test.ts 同款最小迁移执行器（内存库建 schema） */
function runMigrations(db: Database.Database, ms: typeof migrations): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`)
  const current =
    (db.prepare('SELECT MAX(version) AS v FROM meta').get() as { v: number | null }).v ?? 0
  for (const m of ms) {
    if (m.version <= current) continue
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
}
import {
  DataSyncService,
  decideSync,
  DEVICE_ID_PREF,
  prefExcludedKeys,
  revOfRemoteRow,
  SYNC_EXCLUDED_TABLES,
  SYNC_MARKER_PREF,
  SYNC_TABLE_SPECS,
  syncExclusionAudit
} from '../dataSync'

/**
 * 轻量同步的核心逻辑（V4 批次6 起，P-5 改成三方合并）。
 * - decideSync 的三档决策（拉/推/不动）仍然成立
 * - bundle 构建**带每行的修订号**（对端没法自己算：子表的修订号来自父片段）
 * - mergeBundle 在真 sqlite 上跑：两边都改过要留两份、远端删了本地要跟、
 *   本地删了而远端又改过要取回——旧实现那句「远端没有就删本地」正是被这些用例否掉的
 * - 排除清单：库里出现一张没归类的表 = 漏判，audit 要报出来
 */
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrations(db, migrations)
  return db
}

describe('decideSync（LWW 决策）', () => {
  it('远端不存在 → push', () => {
    expect(decideSync(0, 0, false)).toBe('push')
  })

  it('远端比本地已应用的更新 → pull', () => {
    expect(decideSync(2000, 1000, true)).toBe('pull')
  })

  it('本地比远端新 → push', () => {
    expect(decideSync(1000, 2000, true)).toBe('push')
  })

  it('相等 → noop', () => {
    expect(decideSync(1000, 1000, true)).toBe('noop')
  })
})

describe('DataSyncService：bundle 构建', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })

  it('覆盖全部同步表、每行带 __rev、排除键不进 bundle', () => {
    db.prepare(
      `INSERT INTO pref_preferences (key, value, updated_at) VALUES ('theme', '"dark"', 1)`
    ).run()
    db.prepare(
      `INSERT INTO pref_preferences (key, value, updated_at) VALUES ('clips', 'SHOULD_NOT_SYNC', 1)`
    ).run()
    db.prepare(
      `INSERT INTO pref_preferences (key, value, updated_at) VALUES ('${DEVICE_ID_PREF}', 'dev-1', 1)`
    ).run()
    db.prepare(
      `INSERT INTO snip_snippets (id, title, content, language, created_at, updated_at)
       VALUES ('s1', 'test', 'body', 'ts', 1, 7)`
    ).run()
    const bundle = new DataSyncService(db).buildBundle()
    expect(bundle.version).toBe(2)
    expect(typeof bundle.deviceId).toBe('string')
    expect(Object.keys(bundle.tables).sort()).toEqual(SYNC_TABLE_SPECS.map((t) => t.table).sort())
    const prefs = bundle.tables['pref_preferences'] as Array<{ key: string }>
    expect(prefs.map((r) => r.key)).toContain('theme')
    expect(
      prefs.map((r) => r.key),
      '剪贴板历史不同步'
    ).not.toContain('clips')
    expect(
      prefs.map((r) => r.key),
      '设备身份不同步'
    ).not.toContain(DEVICE_ID_PREF)
    const snip = (bundle.tables['snip_snippets'] as Array<Record<string, unknown>>)[0]
    expect(snip.id).toBe('s1')
    expect(snip.__rev, '修订号必须随行带走').toBe(7)
  })

  it('子表的修订号跟它的父片段（对端拿不到就无从比新旧）', () => {
    db.prepare(
      `INSERT INTO snip_snippets (id, title, content, language, created_at, updated_at)
       VALUES ('s1', 't', 'b', 'ts', 1, 55)`
    ).run()
    db.prepare(
      `INSERT INTO snip_snippet_contents (id, snippet_id, label, value, language, position)
       VALUES ('c1', 's1', '脚本', 'x', 'sh', 0)`
    ).run()
    const rows = new DataSyncService(db).buildBundle().tables['snip_snippet_contents'] as Array<
      Record<string, unknown>
    >
    expect(rows[0].__rev).toBe(55)
  })
})

describe('mergeBundle：不再静默丢数据', () => {
  const insertNote = (d: Database.Database, id: string, title: string, rev: number): void => {
    d.prepare(
      `INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, 'x', 1, ?)`
    ).run(id, title, rev)
  }
  const noteRows = (d: Database.Database): Array<{ id: string; title: string }> =>
    d.prepare('SELECT id, title FROM notes ORDER BY id').all() as Array<{
      id: string
      title: string
    }>

  it('两边都改过 → 两份都在：新的落地，旧的另存一行冲突副本', () => {
    const local = makeDb()
    insertNote(local, 'n1', '本地改过的', 20)
    const svc = new DataSyncService(local)
    // 基线：双方在上次同步时都见过 rev 10
    local
      .prepare('INSERT INTO sync_state (tbl,row_key,rev,deleted_at) VALUES (?,?,?,NULL)')
      .run('notes', 'n1', 10)
    const remoteDb = makeDb()
    insertNote(remoteDb, 'n1', '远端改过的', 40)
    const r = svc.mergeBundle(new DataSyncService(remoteDb).buildBundle(), 9999)
    expect(r.copies).toBe(1)
    expect(r.conflicts.map((c) => c.kind)).toEqual(['edit-edit'])
    const rows = noteRows(local)
    // 时间串走 locale 格式化，测试里不拼它的具体写法——只认结构
    expect(rows, '两份都必须在：谁都不许被静默吃掉').toHaveLength(2)
    expect(
      rows.some((x) => x.id === 'n1' && x.title === '远端改过的'),
      '赢家是较新的那份，且仍占着原主键'
    ).toBe(true)
    const copy = rows.find((x) => x.title.includes('冲突副本'))
    expect(copy, '输家要原地另存一行').toBeTruthy()
    expect(copy?.id).not.toBe('n1')
    expect(copy?.title.startsWith('本地改过的（冲突副本 ·')).toBe(true)
  })

  it('远端删了、本地没动过 → 本地跟着删，并留墓碑；再拉一次同一 bundle 不会复活', () => {
    const local = makeDb()
    insertNote(local, 'n1', '被对方删了', 10)
    const svc = new DataSyncService(local)
    local
      .prepare('INSERT INTO sync_state (tbl,row_key,rev,deleted_at) VALUES (?,?,?,NULL)')
      .run('notes', 'n1', 10)
    const r = svc.mergeBundle(new DataSyncService(makeDb()).buildBundle(), 5000)
    expect(r.removed).toBe(1)
    expect(noteRows(local)).toEqual([])
    const tomb = local
      .prepare('SELECT rev, deleted_at FROM sync_state WHERE tbl = ? AND row_key = ?')
      .get('notes', 'n1') as { rev: number; deleted_at: number | null }
    expect(tomb.deleted_at, '没有墓碑，对方下次推送就会把这行带回来').toBe(5000)
    // 对方还没同步到这次删除，把老行又推过来：比墓碑旧，不许复活
    const stale = makeDb()
    insertNote(stale, 'n1', '老数据', 10)
    svc.mergeBundle(new DataSyncService(stale).buildBundle(), 6000)
    expect(noteRows(local), '删除必须比旧数据有权').toEqual([])
  })

  it('本地删了、远端在删除之后又改过 → 把远端那份取回来并报冲突', () => {
    const local = makeDb()
    const svc = new DataSyncService(local)
    local
      .prepare('INSERT INTO sync_state (tbl,row_key,rev,deleted_at) VALUES (?,?,?,?)')
      .run('notes', 'n1', 10, 20)
    const remoteDb = makeDb()
    insertNote(remoteDb, 'n1', '远端改到 30', 30)
    const r = svc.mergeBundle(new DataSyncService(remoteDb).buildBundle(), 7000)
    expect(r.conflicts.map((c) => c.kind)).toEqual(['edit-delete'])
    expect(noteRows(local).map((x) => x.title)).toEqual(['远端改到 30'])
  })

  it('合并两次收敛：第二次两边行集已一致，不再产副本也不再删', () => {
    const local = makeDb()
    insertNote(local, 'a', '本地独有', 40)
    const svc = new DataSyncService(local)
    const remoteDb = makeDb()
    insertNote(remoteDb, 'b', '远端独有', 40)
    const bundle = new DataSyncService(remoteDb).buildBundle()
    const first = svc.mergeBundle(bundle, 8000)
    expect(first.upserted).toBeGreaterThan(0)
    const second = svc.mergeBundle(svc.buildBundle(), 9000)
    expect(second).toMatchObject({ upserted: 0, removed: 0, copies: 0 })
    expect(second.conflicts).toEqual([])
    expect(
      noteRows(local)
        .map((x) => x.id)
        .sort()
    ).toEqual(['a', 'b'])
  })
})

describe('远端 bundle 的修订号（版本兼容）', () => {
  const spec = SYNC_TABLE_SPECS.find((s) => s.table === 'notes')!
  const sub = SYNC_TABLE_SPECS.find((s) => s.table === 'snip_snippet_contents')!

  it('v2 直接读 __rev；v1 没有则回退到行内列', () => {
    expect(revOfRemoteRow(spec, { id: 'n', __rev: 42 }, 2)).toBe(42)
    expect(revOfRemoteRow(spec, { id: 'n', updated_at: 42 }, 1)).toBe(42)
    expect(revOfRemoteRow(spec, { id: 'n', updated_at: 42 }, 2)).toBe(0)
  })

  it('v1 且修订号来自父行（无法还原）→ 按 0 处理，宁可不动它也不猜', () => {
    expect(revOfRemoteRow(sub, { id: 'c', snippet_id: 's' }, 1)).toBe(0)
  })
})

describe('同步范围的归类', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })

  it('库里每张表要么同步、要么点名排除；新加的表不归类会被报出来', () => {
    const audit = syncExclusionAudit(db)
    expect(audit.missing, `漏归类：${audit.missing.join(', ')}`).toEqual([])
    db.exec('CREATE TABLE zz_brand_new (id TEXT PRIMARY KEY)')
    expect(syncExclusionAudit(db).missing).toContain('zz_brand_new')
  })

  it('排除清单不是空谈：本机路径与嵌入这些表确实不在同步清单里', () => {
    const synced = new Set(SYNC_TABLE_SPECS.map((s) => s.table))
    for (const t of [
      'photo_embeddings',
      'lib_files',
      'usage_records',
      'shot_index',
      'sync_state'
    ]) {
      expect(synced.has(t), `${t} 不该同步（理由见 SYNC_EXCLUDED_TABLES）`).toBe(false)
      expect(SYNC_EXCLUDED_TABLES[t], `${t} 要写明理由`).toBeTruthy()
    }
  })

  it('P-5 新纳入的三张表在清单上', () => {
    const synced = SYNC_TABLE_SPECS.map((s) => s.table)
    for (const t of ['folder_folders', 'rec_markers', 'usage_favorites']) {
      expect(synced).toContain(t)
    }
  })

  it('pref 排除键：剪贴板、同步自身记账与设备身份都不参与', () => {
    const keys = prefExcludedKeys()
    expect(keys.has('clips')).toBe(true)
    expect(keys.has('launcher.sync')).toBe(true)
    expect(keys.has(SYNC_MARKER_PREF)).toBe(true)
    expect(keys.has(DEVICE_ID_PREF), '设备身份同步过去 = 两台设备共用一个身份').toBe(true)
  })
})
