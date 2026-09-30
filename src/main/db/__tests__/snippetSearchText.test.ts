import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { createTestDb, closeTestDb } from './testDb'
import { migrations } from '../migrations'
import { m032_snippet_search_text } from '../migrations/032_snippet_search_text'
import { SnippetRepository, buildSnippetSearchText } from '../repos/SnippetRepository'
import { encryptText } from '../../utils/crypto'

/**
 * B42 回归钉：片段明文搜索列（search_text，迁移 032）。
 *
 * 此前搜索在 JS 层对候选全量解密（千条级每键数十 ms）。现在 search_text 由
 * 写入路径同步维护（name/description/contents 明文投影），搜索下沉 SQL LIKE。
 * 钉住三件事：①写入→可搜；②更新→投影跟着变；③迁移 032 回填存量密文。
 *
 * electron mock 必需：contents 加密落盘的密钥写在 userData/.frond-key（同
 * 5_6b.snippet.test.ts 的口径）。
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

describe('片段明文搜索列（B42）', () => {
  let db: Database.Database
  let repo: SnippetRepository
  let userData: string

  beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-snippet-search-'))
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

  it('写入即可搜：内容子串命中（大小写不敏感），不相关词不命中', () => {
    repo.addSnippet({
      name: '部署脚本',
      contents: [
        { id: 'c1', label: 'bash', value: 'kubectl apply -f prod.yaml', language: 'plaintext' }
      ],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    repo.addSnippet({
      name: '无关条目',
      contents: [{ id: 'c2', label: 'txt', value: 'hello world', language: 'plaintext' }],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    const hit = repo.getSnippets({ search: 'KUBECTL' })
    expect(hit.map((s) => s.name)).toEqual(['部署脚本'])
    expect(repo.getSnippets({ search: '不存在的词' })).toEqual([])
  })

  it('updateSnippet 后投影跟着变：旧关键词不再命中、新关键词命中', () => {
    const s = repo.addSnippet({
      name: '笔记',
      contents: [{ id: 'c1', label: 'txt', value: '旧密码是 123456', language: 'plaintext' }],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    repo.updateSnippet(s.id, {
      contents: [{ id: 'c2', label: 'txt', value: '新密码是 654321', language: 'plaintext' }]
    })
    expect(repo.getSnippets({ search: '123456' })).toEqual([])
    expect(repo.getSnippets({ search: '654321' }).map((x) => x.id)).toEqual([s.id])
  })

  it('LIKE 通配符按字面义匹配（对齐旧 includes 语义）', () => {
    repo.addSnippet({
      name: '折扣码',
      contents: [{ id: 'c1', label: 'txt', value: '优惠 50%_off 生效', language: 'plaintext' }],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    repo.addSnippet({
      name: '普通',
      contents: [{ id: 'c2', label: 'txt', value: '50xA off', language: 'plaintext' }],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    // % _ 若当通配符，'50%_off' 会怪异地命中第二行；字面义下只命中第一行
    expect(repo.getSnippets({ search: '50%_off' }).map((s) => s.name)).toEqual(['折扣码'])
  })

  it('迁移 032 回填存量：密文内容解密进投影，损坏密文置安全值不崩', () => {
    // 造一台停在 031 的库：手工只跑到 m031
    const legacy = new Database(':memory:')
    legacy.exec(
      `CREATE TABLE IF NOT EXISTS meta (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)`
    )
    for (const m of migrations) {
      if (m.version > 31) continue
      legacy
        .prepare(`INSERT INTO meta (version, applied_at) VALUES (?, ?)`)
        .run(m.version, Date.now())
      m.up(legacy)
    }
    legacy
      .prepare(
        `INSERT INTO snip_snippets (id, folder_id, title, content, language, description, trigger, is_favorite, usage_count, created_at, updated_at, deleted_at)
         VALUES ('s1', NULL, '老片段', '', 'plaintext', NULL, NULL, 0, 0, 1, 1, NULL)`
      )
      .run()
    legacy
      .prepare(
        `INSERT INTO snip_snippet_contents (id, snippet_id, label, value, language, position, content_type)
         VALUES ('c1', 's1', '秘钥', ?, 'plaintext', 0, 'text')`
      )
      .run(encryptText('legacy-secret-值'))
    legacy
      .prepare(
        `INSERT INTO snip_snippet_contents (id, snippet_id, label, value, language, position, content_type)
         VALUES ('c2', 's1', '坏数据', 'enc:not-valid-ciphertext', 'plaintext', 1, 'text')`
      )
      .run()

    expect(() => m032_snippet_search_text.up(legacy)).not.toThrow()
    const st = (
      legacy.prepare(`SELECT search_text FROM snip_snippets WHERE id = 's1'`).get() as {
        search_text: string
      }
    ).search_text
    expect(st).toContain('老片段')
    expect(st).toContain('legacy-secret-值')
    expect(st).not.toContain('enc:not-valid-ciphertext')
    legacy.close()
  })

  it('buildSnippetSearchText：纯函数拼接', () => {
    expect(
      buildSnippetSearchText('名', '描述', [{ label: 'L1', value: 'V1' }, { label: 'L2' }])
    ).toBe('名\n描述\nL1\nV1\nL2\n')
  })
})
