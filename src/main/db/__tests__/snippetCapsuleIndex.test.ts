import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb, closeTestDb } from './testDb'
import { SnippetRepository, TRASH_RETENTION_DAYS } from '../repos/SnippetRepository'

/**
 * B58 批C：胶囊轻路径索引（getIndex，不解密 contents）与回收站保留期
 * （purgeExpiredTrash，启动时清除软删除超 30 天的片段）。
 */

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath(${key})`)
      if (!process.env.__FROND_TEST_USER_DATA) throw new Error('test env not set up')
      return process.env.__FROND_TEST_USER_DATA
    },
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

describe('SnippetRepository getIndex / purgeExpiredTrash（B58 批C）', () => {
  let db: Database.Database
  let repo: SnippetRepository
  let userData: string

  beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-capsule-index-'))
    process.env.__FROND_TEST_USER_DATA = userData
  })

  afterAll(() => {
    rmSync(userData, { recursive: true, force: true })
    delete process.env.__FROND_TEST_USER_DATA
  })

  beforeEach(() => {
    db = createTestDb()
    repo = new SnippetRepository(db)
  })

  afterEach(() => {
    closeTestDb(db)
  })

  const seed = (name: string, contents: string[]): ReturnType<typeof repo.addSnippet> =>
    repo.addSnippet({
      name,
      contents: contents.map((value, i) => ({
        id: `${name}-c${i}`,
        label: `块 ${i + 1}`,
        value,
        language: 'ts'
      })),
      folderId: null,
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })

  it('getIndex：不解密 contents、块数就地位、排除回收站、按 updated_at 倒序', () => {
    seed('idx-single', ['only-body'])
    seed('idx-multi', ['first', 'second', 'third'])
    seed('idx-deleted', ['gone'])
    repo.deleteSnippet(
      repo.getSnippets({ isDeleted: false }).find((s) => s.name === 'idx-deleted')!.id
    )

    const rows = repo.getIndex()
    expect(rows.map((r) => r.name)).toEqual(['idx-multi', 'idx-single'])
    expect(rows[0]!.blockCount).toBe(3)
    expect(rows[1]!.blockCount).toBe(1)
    for (const r of rows) {
      expect(r.id).toBeTruthy()
      expect(r.language).toBe('ts')
      // 轻路径契约：不带 contents / search_text 等重字段
      expect(r).not.toHaveProperty('contents')
      expect(r).not.toHaveProperty('search_text')
    }
  })

  it('purgeExpiredTrash：只清超过保留期的软删除片段，在册与新鲜删除不受影响', () => {
    const keep = seed('purge-keep', ['body'])
    const freshDeleted = seed('purge-fresh', ['body'])
    const oldDeleted = seed('purge-old', ['body'])
    repo.deleteSnippet(freshDeleted.id)
    repo.deleteSnippet(oldDeleted.id)
    // 把 oldDeleted 的 deleted_at 回拨 31 天
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000
    db.prepare(`UPDATE snip_snippets SET deleted_at = ? WHERE id = ?`).run(old, oldDeleted.id)

    const purged = repo.purgeExpiredTrash(TRASH_RETENTION_DAYS)
    expect(purged).toBe(1)

    // 彻底删除（含回收站查询也看不到）
    expect(repo.getSnippetById(oldDeleted.id)).toBeUndefined()
    expect(repo.getSnippets({ isDeleted: true }).map((s) => s.id)).toEqual([freshDeleted.id])
    // 在册片段不受影响
    expect(repo.getSnippetById(keep.id)).toBeDefined()
    // junction 行已随清（该片段无标签，这里验证 SQL 不炸即可）
    expect(
      (db.prepare(`SELECT COUNT(*) AS n FROM snip_tags WHERE snippet_id = ?`).get(oldDeleted.id) as
        | { n: number }
        | undefined)?.n
    ).toBe(0)
  })

  it('purgeExpiredTrash：空回收站返回 0', () => {
    expect(repo.purgeExpiredTrash(30)).toBe(0)
  })
})
