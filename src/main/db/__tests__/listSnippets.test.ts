import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb, closeTestDb } from './testDb'
import { SnippetRepository } from '../repos/SnippetRepository'
import { m033_snippet_search_text_trigger } from '../migrations/033_snippet_search_text_trigger'

/**
 * Frond · listSnippets 分页列表测试（批3）
 *
 * 覆盖：limit/offset/total、排序稳定性、搜索下沉（name/trigger/正文）、
 * LIKE 通配符字面义、回收站过滤口径、迁移 033 存量投影重建。
 *
 * electron mock 是必需而非样板：contents.value 走 utils/crypto 加密落盘，
 * 密钥文件写在 app.getPath('userData')/.frond-key（同 5_6b.snippet.test.ts）。
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

type AddInput = Parameters<SnippetRepository['addSnippet']>[0]

const mk = (name: string, over: Partial<AddInput> = {}): AddInput => ({
  name,
  contents: [{ id: '', label: 'code', value: `content-of-${name}`, language: 'ts' }],
  tagIds: [],
  isDeleted: false,
  isFavorites: false,
  ...over
})

describe('SnippetRepository.listSnippets（批3 分页）', () => {
  let db: Database.Database
  let repo: SnippetRepository
  let userData: string

  beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-snippet-list-'))
    process.env.__FROND_TEST_USER_DATA = userData
    db = createTestDb()
    repo = new SnippetRepository(db)
  })

  afterAll(() => {
    closeTestDb(db)
    delete process.env.__FROND_TEST_USER_DATA
    rmSync(userData, { recursive: true, force: true })
  })

  const seed = (n: number): void => {
    for (let i = 1; i <= n; i++) {
      repo.addSnippet(mk(`snippet-${String(i).padStart(3, '0')}`))
    }
  }

  it('limit/offset 分页正确，total 恒为过滤后总数', () => {
    seed(5)
    const p1 = repo.listSnippets({ isDeleted: false }, 2, 0)
    expect(p1.items).toHaveLength(2)
    expect(p1.total).toBe(5)
    const p3 = repo.listSnippets({ isDeleted: false }, 2, 4)
    expect(p3.items).toHaveLength(1)
    expect(p3.total).toBe(5)
  })

  it('offset 超出时 items 为空但 total 不变', () => {
    const res = repo.listSnippets({ isDeleted: false }, 2, 100)
    expect(res.items).toHaveLength(0)
    expect(res.total).toBe(5)
  })

  it('排序稳定：同 updated_at 时新插入靠前（rowid DESC 兜底）', () => {
    const firstPage = repo.listSnippets({ isDeleted: false }, 5, 0)
    expect(firstPage.items[0]!.name).toBe('snippet-005')
    expect(firstPage.items[4]!.name).toBe('snippet-001')
  })

  it('搜索下沉：命中 name / trigger / 正文（写入路径同步投影）', () => {
    repo.addSnippet(
      mk('支付回调', {
        trigger: ';pay',
        contents: [{ id: '', label: 'code', value: `fetch('/api/pay')`, language: 'ts' }]
      })
    )
    expect(repo.listSnippets({ isDeleted: false, search: '支付' }, 10, 0).total).toBe(1)
    expect(repo.listSnippets({ isDeleted: false, search: ';pay' }, 10, 0).total).toBe(1)
    expect(repo.listSnippets({ isDeleted: false, search: '/api/pay' }, 10, 0).total).toBe(1)
    expect(repo.listSnippets({ isDeleted: false, search: '不存在的词' }, 10, 0).total).toBe(0)
  })

  it('LIKE 通配符按字面义匹配（与旧 includes 一致）', () => {
    repo.addSnippet(mk('100%覆盖'))
    expect(repo.listSnippets({ isDeleted: false, search: '100%' }, 10, 0).total).toBe(1)
  })

  it('isDeleted 三态：不过滤 / 仅存活 / 仅回收站，total 口径自洽', () => {
    const all = repo.listSnippets({}, 100, 0)
    const alive = repo.listSnippets({ isDeleted: false }, 100, 0)
    const trash = repo.listSnippets({ isDeleted: true }, 100, 0)
    expect(all.total).toBe(alive.total + trash.total)
  })

  it('迁移 033：存量 search_text 重建补入 trigger', () => {
    // 把一行 search_text 降级回 032 旧格式（无 trigger），再跑 033.up 断言补回
    const target = repo.listSnippets({ isDeleted: false, search: ';pay' }, 1, 0).items[0]!
    db.prepare(`UPDATE snip_snippets SET search_text = ? WHERE id = ?`).run(
      '支付回调\n旧投影',
      target.id
    )
    m033_snippet_search_text_trigger.up(db)
    const row = db
      .prepare(`SELECT search_text FROM snip_snippets WHERE id = ?`)
      .get(target.id) as { search_text: string }
    expect(row.search_text).toContain(';pay')
    expect(row.search_text).toContain(`fetch('/api/pay')`)
  })
})
