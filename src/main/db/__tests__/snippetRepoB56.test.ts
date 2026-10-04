import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { createTestDb, closeTestDb } from './testDb'
import { SnippetRepository } from '../repos/SnippetRepository'
import { TagRepository } from '../repos/TagRepository'

/**
 * B56-8/10 主进程数据链路回归钉：
 * - quickSearch 必须排除回收站（此前注释声称与 getSnippets 同口径但实际泄漏）
 * - duplicateSnippet 保留 contentType（rich 副本不得降级 text）、trigger 置空防冲突
 * - updateSnippet 同步遗留 content/language 列（quickSearch 副标题数据源）
 * - 硬删除/清空回收站清理 snip_tags 关联（无外键 junction 手动清）
 */

// 加密写入需要 userData 密钥环境（同 5_6b.snippet.test.ts 的必需 mock）
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

describe('SnippetRepository B56 主进程钉', () => {
  let db: Database.Database
  let repo: SnippetRepository
  let tags: TagRepository
  let userData: string

  beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-b56-'))
    process.env.__FROND_TEST_USER_DATA = userData
  })

  afterAll(() => {
    rmSync(userData, { recursive: true, force: true })
    delete process.env.__FROND_TEST_USER_DATA
  })

  beforeEach(() => {
    db = createTestDb()
    repo = new SnippetRepository(db)
    tags = new TagRepository(db)
  })

  afterEach(() => {
    closeTestDb(db)
  })

  const seed = (name: string, over: Partial<Parameters<SnippetRepository['addSnippet']>[0]> = {}) =>
    repo.addSnippet({
      name,
      contents: [
        {
          id: '',
          label: 'first',
          value: `value of ${name}`,
          language: 'ts'
        }
      ],
      folderId: null,
      tagIds: [],
      isDeleted: false,
      isFavorites: false,
      ...over
    })

  describe('B56-8 quickSearch 排除回收站', () => {
    it('软删片段不出现在 quickSearch', () => {
      seed('alpha-unique')
      const b = seed('beta-unique')
      repo.deleteSnippet(b.id)
      const hits = repo.quickSearch('unique', 10).map((h) => h.name)
      expect(hits).toContain('alpha-unique')
      expect(hits).not.toContain('beta-unique')
    })
  })

  describe('B56-10 duplicateSnippet', () => {
    it('rich 副本保留 contentType（不降级 text）', () => {
      const orig = seed('rich-doc', {
        contents: [{ id: '', label: 'doc', value: '<b>hi</b>', language: 'html', contentType: 'rich' }]
      })
      const copy = repo.duplicateSnippet(orig.id)!
      expect(copy.contents[0]!.contentType).toBe('rich')
      expect(copy.contents[0]!.value).toBe('<b>hi</b>')
    })

    it('副本 trigger 置空（同名触发词会静默冲突）', () => {
      const orig = seed('with-trigger', { trigger: ';sig' })
      const copy = repo.duplicateSnippet(orig.id)!
      expect(copy.trigger ?? '').toBe('')
      expect(repo.getSnippetById(orig.id)!.trigger).toBe(';sig')
    })
  })

  describe('B56-10 updateSnippet 同步遗留列', () => {
    it('改首个 content 的语言/内容后，legacy content/language 列同步', () => {
      const s = seed('legacy')
      repo.updateSnippet(s.id, {
        contents: [{ id: s.contents[0]!.id, label: 'first', value: 'print(1)', language: 'python' }]
      })
      const row = db
        .prepare(`SELECT content, language FROM snip_snippets WHERE id = ?`)
        .get(s.id) as { content: string; language: string }
      expect(row.language).toBe('python')
      expect(row.content).toBe('print(1)')
      // quickSearch 副标题数据源随之正确
      expect(repo.quickSearch('legacy', 5)[0]!.language).toBe('python')
    })
  })

  describe('B56-10 硬删除清理 snip_tags', () => {
    it('permanentlyDeleteSnippet 清除标签关联行', () => {
      const t = tags.create('工作')
      const s = repo.addSnippet({
        name: 'tagged',
        contents: [{ id: '', label: 'l', value: 'v', language: 'txt' }],
        folderId: null,
        tagIds: [t.id],
        isDeleted: false,
        isFavorites: false
      })
      repo.deleteSnippet(s.id)
      repo.permanentlyDeleteSnippet(s.id)
      const orphan = db
        .prepare(`SELECT COUNT(*) AS n FROM snip_tags WHERE snippet_id = ?`)
        .get(s.id) as { n: number }
      expect(orphan.n).toBe(0)
    })

    it('emptyTrash 清除所有已删片段的标签关联行', () => {
      const t = tags.create('工作')
      const a = repo.addSnippet({
        name: 'a',
        contents: [{ id: '', label: 'l', value: 'v', language: 'txt' }],
        folderId: null,
        tagIds: [t.id],
        isDeleted: false,
        isFavorites: false
      })
      const b = repo.addSnippet({
        name: 'b',
        contents: [{ id: '', label: 'l', value: 'v', language: 'txt' }],
        folderId: null,
        tagIds: [t.id],
        isDeleted: false,
        isFavorites: false
      })
      repo.deleteSnippet(a.id)
      repo.deleteSnippet(b.id)
      repo.emptyTrash()
      const orphans = db.prepare(`SELECT COUNT(*) AS n FROM snip_tags`).get() as { n: number }
      expect(orphans.n).toBe(0)
    })
  })
})
