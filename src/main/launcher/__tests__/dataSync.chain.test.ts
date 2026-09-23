import Database from 'better-sqlite3'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { migrations } from '../../db/migrations'
import { pullDataSync, pushDataSync, type SyncDeps } from '../dataSync'
import { startDav, type DavHandle } from './helpers/minimalDav'

/**
 * P-5 的「真链路」一栏：前面几格（syncMerge 判据、bundle v2、mergeBundle 记账）都是
 * 在**函数边界内**验的，传输这一路一直没跑过——而它恰恰是用户数据走的那条路。
 * 这里用进程内的最小 WebDAV 端 + 两个内存库模拟两台设备，把
 * `pushDataSync` / `pullDataSync` 整条链子真跑一遍：真 HTTP 往返、真 AES-256-GCM、
 * 真 sqlite 行级合并。跑不了真机两台设备之前，这条就是最接近的证据。
 *
 * 已知限制（写清楚，别把这条当成「WebDAV 兼容性过了」）：
 * 服务端只实现了客户端实际会发的 PROPFIND/MKCOL/PUT/GET，不覆盖真服务器
 * （Nextcloud / 群晖）在鉴权、重定向、锁、分块上的怪脾气。
 */

const PASSWORD = 'device-shared-passphrase'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(
    `CREATE TABLE IF NOT EXISTS meta (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)`
  )
  for (const m of migrations) {
    const current =
      (db.prepare('SELECT MAX(version) AS v FROM meta').get() as { v: number | null }).v ?? 0
    if (m.version <= current) continue
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
  return db
}

interface Device {
  name: string
  db: Database.Database
  applied: number
  snapshots: number
}

function makeDevice(name: string): Device {
  return { name, db: makeDb(), applied: 0, snapshots: 0 }
}

function depsOf(dev: Device, url: string): SyncDeps {
  return {
    db: dev.db,
    config: { url, username: 'u', password: PASSWORD, remoteDir: '/frond' },
    readApplied: () => dev.applied,
    markApplied: (ts) => {
      dev.applied = ts
    },
    snapshot: () => {
      dev.snapshots++
      return `/tmp/sync-snapshots/${dev.name}-${dev.snapshots}.json`
    }
  }
}

const addNote = (d: Device, id: string, title: string, rev: number): void => {
  d.db
    .prepare(`INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?,?,?,1,?)`)
    .run(id, title, 'body', rev)
}
const editNote = (d: Device, id: string, title: string, rev: number): void => {
  d.db.prepare(`UPDATE notes SET title = ?, updated_at = ? WHERE id = ?`).run(title, rev, id)
}
const deleteNote = (d: Device, id: string): void => {
  d.db.prepare(`DELETE FROM notes WHERE id = ?`).run(id)
}
const titles = (d: Device): string[] =>
  (d.db.prepare('SELECT title FROM notes ORDER BY title').all() as Array<{ title: string }>).map(
    (r) => r.title
  )
/** exportedAt 取 Date.now()，同一毫秒内两次推送会判成 noop——真链路上这不算 bug，
 * 但测试要的是「下一趟确实比上一趟新」，所以每步之间让时钟走一格 */
const tick = async (ms = 4): Promise<void> => new Promise((r) => setTimeout(r, ms))

let dav: DavHandle
beforeAll(async () => {
  dav = await startDav()
})
afterAll(async () => {
  await dav.close()
})

describe('两台设备经 WebDAV 互拉（真 push/pull 全链）', () => {
  it('A 推 → B 拉：笔记落到 B，并且远端存的东西里没有一字节明文', async () => {
    const a = makeDevice('A')
    const b = makeDevice('B')
    addNote(a, 'n1', '只有这台设备写过的笔记', 10)
    expect((await pushDataSync(depsOf(a, dav.url))).ok).toBe(true)
    await tick()
    const r = await pullDataSync(depsOf(b, dav.url))
    expect(r).toMatchObject({ ok: true, decision: 'pull' })
    expect(titles(b)).toEqual(['只有这台设备写过的笔记'])
    expect(b.applied, '记账位要跟上远端版本，否则下次还会重复拉').toBeGreaterThan(0)

    // 端到端加密的正面证据：远端存下来的每个对象里都搜不到明文
    const stored = [...dav.files.values()]
    expect(stored.length, '远端该有 bundle 与 latest 两个对象').toBeGreaterThanOrEqual(2)
    for (const buf of stored) {
      expect(buf.toString('utf8')).not.toContain('只有这台设备写过的笔记')
      expect(buf.toString('utf8')).not.toContain('"tables"')
    }
  })

  it('同一版本再拉一次：noop，不重复合并也不白落快照', async () => {
    const a = makeDevice('A')
    const b = makeDevice('B')
    addNote(a, 'n1', '一行老数据', 10)
    await pushDataSync(depsOf(a, dav.url))
    await tick()
    await pullDataSync(depsOf(b, dav.url))
    expect(b.snapshots, '真拉平过一次就该先落快照').toBe(1)
    const again = await pullDataSync(depsOf(b, dav.url))
    expect(again.decision, '远端不比记账位新就不该再动数据').toBe('noop')
    expect(b.snapshots, 'noop 这一趟不该再落一份快照').toBe(1)
    expect(titles(b)).toEqual(['一行老数据'])
  })

  it('两台各改同一行，走完一圈：两份都在，谁都没被静默吃掉', async () => {
    const a = makeDevice('A')
    const b = makeDevice('B')
    addNote(a, 'n1', '共同基线', 10)
    await pushDataSync(depsOf(a, dav.url))
    await tick()
    await pullDataSync(depsOf(b, dav.url))

    editNote(a, 'n1', 'A 这台改的', 30)
    editNote(b, 'n1', 'B 这台改的', 40)
    await pushDataSync(depsOf(a, dav.url))
    await tick()
    const pulled = await pullDataSync(depsOf(b, dav.url))
    expect(pulled.conflicts, '两边都改过必须报出来，不能算一次成功合并').toBe(1)
    expect(
      titles(b).some((t) => t.includes('A 这台改的')),
      '输家要另存一行'
    ).toBe(true)
    expect(titles(b)).toContain('B 这台改的')

    await pushDataSync(depsOf(b, dav.url))
    await tick()
    await pullDataSync(depsOf(a, dav.url))
    const both = titles(a)
    expect(
      both.some((t) => t.includes('A 这台改的')) && both.some((t) => t.includes('B 这台改的')),
      `A 拉完也该同时看到两份，实际：${JSON.stringify(both)}`
    ).toBe(true)
  })

  it('B 删一行、A 没动：A 拉之后跟着删，且旧 bundle 再推过来也不许复活', async () => {
    const a = makeDevice('A')
    const b = makeDevice('B')
    addNote(a, 'n1', '会被另一边删掉', 10)
    addNote(a, 'n2', '谁都没碰', 10)
    await pushDataSync(depsOf(a, dav.url))
    await tick()
    await pullDataSync(depsOf(b, dav.url))
    deleteNote(b, 'n1')
    await pushDataSync(depsOf(b, dav.url))
    await tick()
    await pullDataSync(depsOf(a, dav.url))
    expect(titles(a), `删除要传得过来，实际：${JSON.stringify(titles(a))}`).toEqual(['谁都没碰'])

    // B 还没同步到这次删除，把带着 n1 的老数据又推一遍：比墓碑旧，不许复活。
    // 这台「迟到的 B」得带着它当时该有的全部行（n1 + n2）——只推 n1 等于它把 n2 也删了，
    // 那种情况下 A 删掉 n2 才是对的。
    const stale = makeDevice('B-stale')
    const copy = (id: string, title: string, rev: number): void => {
      stale.db
        .prepare(
          `INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?,?,?,?,?)`
        )
        .run(id, title, 'body', 1, rev)
    }
    copy('n1', '会被另一边删掉', 10)
    copy('n2', '谁都没碰', 10)
    await pushDataSync(depsOf(stale, dav.url))
    await tick()
    await pullDataSync(depsOf(a, dav.url))
    expect(titles(a), '删除比旧数据有权').toEqual(['谁都没碰'])
  })

  it('口令不同：拉取报错，本地数据一个字节都不动', async () => {
    const a = makeDevice('A')
    const b = makeDevice('B')
    addNote(a, 'n1', '对端的笔记', 10)
    await pushDataSync(depsOf(a, dav.url))
    await tick()
    addNote(b, 'local', '本机自己的', 5)
    const wrong = depsOf(b, dav.url)
    wrong.config = {
      url: dav.url,
      username: 'u',
      password: 'another-passphrase',
      remoteDir: '/frond'
    }
    const r = await pullDataSync(wrong)
    expect(r.ok, '解不开就该失败').toBe(false)
    expect(titles(b), `失败的一趟不许留下半套数据，实际：${JSON.stringify(titles(b))}`).toEqual([
      '本机自己的'
    ])
  })
})
