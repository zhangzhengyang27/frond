import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb, closeTestDb } from './testDb'
import { SnippetRepository } from '../repos/SnippetRepository'

/**
 * B53-3b 片段轻搜索（胶囊根搜索用）：quickSearch 只投影 id/name/language 且
 * LIMIT 内返回，不做 attachRelations（逐行 AES 解密全部 contents 是每击键的
 * 主进程大头）。与 getSnippets({search}) 的匹配口径一致（search_text LIKE +
 * 相同转义）。
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

describe('SnippetRepository.quickSearch（B53-3b）', () => {
  let db: Database.Database
  let repo: SnippetRepository
  let userData: string

  beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-quicksearch-'))
    process.env.__FROND_TEST_USER_DATA = userData
  })

  afterAll(() => {
    rmSync(userData, { recursive: true, force: true })
    delete process.env.__FROND_TEST_USER_DATA
  })

  const seed = (name: string, value: string): void => {
    repo.addSnippet({
      name,
      contents: [{ id: `${name}-c1`, label: 'first', value, language: 'ts' }],
      folderId: null,
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
  }

  beforeEach(() => {
    db = createTestDb()
    repo = new SnippetRepository(db)
    seed('quick-alpha', 'const alpha = 1')
    seed('beta', 'const beta = 2')
    seed('quick-beta', 'const gamma = 3')
  })

  afterEach(() => {
    closeTestDb(db)
  })

  it('命中 search_text（名称与内容），只投影 id/name/language', () => {
    const rows = repo.quickSearch('quick', 10)
    expect(rows.map((r) => r.name).sort()).toEqual(['quick-alpha', 'quick-beta'])
    for (const r of rows) {
      expect(r.id).toBeTruthy()
      expect(r).not.toHaveProperty('contents')
      expect(r).not.toHaveProperty('search_text')
    }
  })

  it('LIMIT 生效且按 updated_at 倒序', () => {
    const rows = repo.quickSearch('quick', 1)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('quick-beta') // 后写入的排前
  })

  it('无命中返回空数组；LIKE 通配符按字面义', () => {
    expect(repo.quickSearch('nonexistent', 5)).toEqual([])
    expect(repo.quickSearch('%', 5)).toEqual([]) // % 不当通配符用
  })
})
