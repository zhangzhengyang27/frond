import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb, closeTestDb } from './testDb'
import { SnippetRepository } from '../repos/SnippetRepository'
import { TagRepository } from '../repos/TagRepository'

/**
 * B58 标签闭环 + 触发词冲突（repo 层）：
 * - 搜索命中标签名（search_text 不含标签名，靠 EXISTS 子查询）
 * - tagId JOIN 与 search EXISTS 两个分支共存（此前 JOIN 变体无别名 s，
 *   加 EXISTS 后两分支口径必须一致）
 * - quickSearch（胶囊根搜索）同口径命中标签名
 * - findTriggerConflict：同触发词的其它在册片段，排除自身与回收站
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

describe('SnippetRepository 标签搜索 / 触发词冲突（B58）', () => {
  let db: Database.Database
  let repo: SnippetRepository
  let tags: TagRepository
  let userData: string

  beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-tagsearch-'))
    process.env.__FROND_TEST_USER_DATA = userData
  })

  afterAll(() => {
    rmSync(userData, { recursive: true, force: true })
    delete process.env.__FROND_TEST_USER_DATA
  })

  const seed = (name: string, value: string, tagIds: string[] = [], trigger = ''): void => {
    repo.addSnippet({
      name,
      contents: [{ id: `${name}-c1`, label: 'first', value, language: 'ts' }],
      folderId: null,
      tagIds,
      // exactOptionalPropertyTypes：空触发词直接不带键
      ...(trigger ? { trigger } : {}),
      isDeleted: false,
      isFavorites: false
    })
  }

  beforeEach(() => {
    db = createTestDb()
    repo = new SnippetRepository(db)
    tags = new TagRepository(db)
  })

  afterEach(() => {
    closeTestDb(db)
  })

  it('getSnippets search 命中标签名（search_text 不含该词）', () => {
    const tag = tags.create('前端组件')
    seed('plain-name', 'body-without-marker', [tag.id])
    seed('untagged', 'body-without-marker')

    const hits = repo.getSnippets({ isDeleted: false, search: '前端组件' })
    expect(hits.map((h) => h.name)).toEqual(['plain-name'])
    // 标签全名不匹配、部分名匹配也可命中（LIKE 口径一致）
    expect(repo.getSnippets({ isDeleted: false, search: '组件' })).toHaveLength(1)
    expect(repo.getSnippets({ isDeleted: false, search: '不存在的标签' })).toHaveLength(0)
  })

  it('tagId JOIN 与 search EXISTS 组合不串参数（getSnippets + listSnippets）', () => {
    const t1 = tags.create('sql-tag')
    const t2 = tags.create('other-tag')
    seed('join-a', 'alpha-unique', [t1.id])
    seed('join-b', 'beta-unique', [t1.id])
    seed('join-c', 'alpha-elsewhere', [t2.id])

    const hits = repo.getSnippets({ isDeleted: false, tagId: t1.id, search: 'alpha' })
    expect(hits.map((h) => h.name)).toEqual(['join-a'])

    const page = repo.listSnippets({ isDeleted: false, tagId: t1.id, search: 'alpha' }, 10, 0)
    expect(page.total).toBe(1)
    expect(page.items[0]!.name).toBe('join-a')
  })

  it('quickSearch（胶囊根搜索）同口径命中标签名', () => {
    const tag = tags.create('算法模板')
    seed('two-sum', 'body-of-two-sum', [tag.id])
    seed('unrelated', 'body-of-unrelated')

    const rows = repo.quickSearch('算法模板', 10)
    expect(rows.map((r) => r.name)).toEqual(['two-sum'])
  })

  it('findTriggerConflict：同触发词互报，排除自身与回收站；空白触发词不查', () => {
    const a = repo.addSnippet({
      name: 'trig-a',
      contents: [{ id: 'a-c1', label: 'x', value: 'a', language: 'ts' }],
      folderId: null,
      tagIds: [],
      trigger: ';dup',
      isDeleted: false,
      isFavorites: false
    })
    const b = repo.addSnippet({
      name: 'trig-b',
      contents: [{ id: 'b-c1', label: 'x', value: 'b', language: 'ts' }],
      folderId: null,
      tagIds: [],
      trigger: ';dup',
      isDeleted: false,
      isFavorites: false
    })

    expect(repo.findTriggerConflict(';dup', a.id)?.id).toBe(b.id)
    expect(repo.findTriggerConflict(';dup', b.id)?.id).toBe(a.id)
    expect(repo.findTriggerConflict(';unique', a.id)).toBeUndefined()

    // 回收站里的冲突不算数
    repo.deleteSnippet(b.id)
    expect(repo.findTriggerConflict(';dup', a.id)).toBeUndefined()
    // 空白触发词直接免查
    expect(repo.findTriggerConflict('   ', a.id)).toBeUndefined()
  })
})
