import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb, closeTestDb } from './testDb'
import { SnippetRepository, type SnippetContent } from '../repos/SnippetRepository'

/**
 * Frond · SnippetRepository 存储测试
 *
 * ⚠ 恢复说明：本文件随 2026-09-22 删除事故被切成 254 行、其中 219 行是
 * 「第 N 行未留存」占位。留下的是头部与一条 FTS 用例（下面按原文保留）；
 * beforeEach 与其余用例按当前仓库层 API 重写，不代表原用例的断言集合。
 *
 * 这段 electron mock 是必需而非样板：contents.value 走 utils/crypto 的加密落盘，
 * 密钥文件写在 app.getPath('userData')/.frond-key；加密失败时它**故意**抛错
 * （拒绝静默降级为明文），所以没有这个 userData 就会 5 条全红。
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

describe('SnippetRepository', () => {
  let db: Database.Database
  let repo: SnippetRepository
  let userData: string

  beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'frond-snippet-crypto-'))
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

  const content = (over: Partial<SnippetContent> = {}): SnippetContent => ({
    id: over.id ?? 'c1',
    label: over.label ?? 'first',
    value: over.value ?? 'some basic code',
    language: over.language ?? 'txt'
  })

  const base = (over: Partial<Parameters<SnippetRepository['addSnippet']>[0]> = {}) => ({
    name: 'beta',
    contents: [content()],
    folderId: null,
    tagIds: [],
    isDeleted: false,
    isFavorites: false,
    ...over
  })

  it('FTS search 命中', () => {
    repo.addSnippet({
      name: 'uniqueword-alpha',
      contents: [{ id: 'c1', label: 'first', value: 'some basic code', language: 'txt' }],
      folderId: null,
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    repo.addSnippet({
      name: 'beta',
      contents: [{ id: 'c2', label: 'second', value: 'no match here', language: 'txt' }],
      folderId: null,
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    const hits = db
      .prepare(`SELECT rowid FROM snip_snippets_fts WHERE snip_snippets_fts MATCH ?`)
      .all('uniqueword') as Array<{ rowid: number }>
    expect(hits.length).toBeGreaterThan(0)
  })

  it('contents 走子表：写入后按 position 原序读回，值经加解密往返不变', () => {
    const s = repo.addSnippet(
      base({
        contents: [
          content({ id: 'c1', value: '第一段 中文 + emoji 🌿' }),
          content({ id: 'c2', label: 'second', value: 'second block' })
        ]
      })
    )
    const back = repo.getSnippetById(s.id)
    expect(back?.contents.map((c) => c.value)).toEqual(['第一段 中文 + emoji 🌿', 'second block'])
    // 库里存的是密文，明文不得出现在 snip_snippet_contents.value
    const raw = db.prepare(`SELECT value FROM snip_snippet_contents WHERE id = ?`).get('c1') as {
      value: string
    }
    expect(raw.value).not.toContain('第一段')
  })

  it('软删除只打 deleted_at：列表按 isDeleted 过滤，restore 后回到未删集合', () => {
    const s = repo.addSnippet(base())
    expect(repo.deleteSnippet(s.id)).toBe(true)
    // 契约：不传 isDeleted 就不加删除过滤（由调用方决定），所以裸列表仍看得见
    expect(repo.getSnippets({ isDeleted: false }).some((x) => x.id === s.id)).toBe(false)
    expect(repo.getSnippets({ isDeleted: true }).some((x) => x.id === s.id)).toBe(true)
    expect(repo.restoreSnippet(s.id)).toBe(true)
    expect(repo.getSnippets({ isDeleted: false }).some((x) => x.id === s.id)).toBe(true)
    expect(repo.permanentlyDeleteSnippet(s.id)).toBe(true)
    expect(repo.getSnippetById(s.id)).toBeUndefined()
  })

  it('updateSnippet 换掉 contents 时旧子行被替换而不是追加', () => {
    const s = repo.addSnippet(base({ contents: [content({ id: 'c1', value: 'old' })] }))
    const updated = repo.updateSnippet(s.id, {
      contents: [content({ id: 'c9', label: 'new', value: 'new' })]
    })
    expect(updated?.contents.map((c) => c.value)).toEqual(['new'])
    const rows = db
      .prepare(`SELECT id FROM snip_snippet_contents WHERE snippet_id = ?`)
      .all(s.id) as Array<{ id: string }>
    expect(rows.map((r) => r.id)).toEqual(['c9'])
  })

  it('trigger 参与唯一性读取：按触发词能找回同一条', () => {
    const s = repo.addSnippet(base({ trigger: ';brb', name: 'away' }))
    expect(repo.getSnippetById(s.id)?.trigger).toBe(';brb')
  })
})
