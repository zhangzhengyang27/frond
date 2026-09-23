import { describe, it, expect } from 'vitest'
import {
  SNIPPET_EXPORT_VERSION,
  buildExportPayload,
  parseImportPayload,
  partitionForImport,
  type ExportedSnippet,
  type TransferableSnippet
} from '../SnippetTransferService'

/**
 * B3 片段导入导出：纯逻辑单测（导出负载构建 / 导入 JSON 校验归一 / 去重切分 / 往返幂等）
 */

const baseSnippet = (overrides?: Partial<TransferableSnippet>): TransferableSnippet => ({
  id: 'snip-1',
  name: '签名',
  contents: [
    { id: 'c1', label: '正文', value: 'Best regards', language: 'plaintext' }
  ],
  tagIds: [],
  isDeleted: false,
  isFavorites: false,
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  ...overrides
})

const exported = (overrides?: Partial<ExportedSnippet>): ExportedSnippet => ({
  id: 'snip-1',
  name: '签名',
  contents: [
    { id: 'c1', label: '正文', value: 'Best regards', language: 'plaintext', contentType: 'text' }
  ],
  tagIds: [],
  isDeleted: false,
  isFavorites: false,
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  folderId: null,
  ...overrides
})

describe('buildExportPayload 导出负载', () => {
  it('文件头字段完整（app/kind/version/exportedAt）', () => {
    const payload = buildExportPayload([baseSnippet()])
    expect(payload.app).toBe('frond')
    expect(payload.kind).toBe('snippets')
    expect(payload.version).toBe(SNIPPET_EXPORT_VERSION)
    expect(typeof payload.exportedAt).toBe('number')
    expect(payload.snippets).toHaveLength(1)
  })

  it('字段显式投影：folderId 归一为 null、tagIds 拷贝、contentType 保留', () => {
    const payload = buildExportPayload([
      baseSnippet({
        folderId: undefined,
        tagIds: ['t1'],
        description: 'desc',
        trigger: ';sig',
        isFavorites: true,
        contents: [{ id: 'c1', label: '正文', value: '<b>hi</b>', language: 'html', contentType: 'rich' }]
      })
    ])
    const s = payload.snippets[0]
    expect(s.folderId).toBeNull()
    expect(s.tagIds).toEqual(['t1'])
    expect(s.description).toBe('desc')
    expect(s.trigger).toBe(';sig')
    expect(s.isFavorites).toBe(true)
    expect(s.contents[0].contentType).toBe('rich')
  })
})

describe('parseImportPayload 导入校验', () => {
  it('合法文件通过，缺失字段按默认值归一', () => {
    const json = JSON.stringify({
      app: 'frond',
      kind: 'snippets',
      version: 1,
      exportedAt: 1,
      snippets: [
        {
          id: 'a',
          name: '片段A',
          contents: [{ value: 'hello' }],
          createdAt: 100,
          updatedAt: 200
        }
      ]
    })
    const r = parseImportPayload(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snippets).toEqual([
      {
        id: 'a',
        name: '片段A',
        contents: [{ id: '', label: '', value: 'hello', language: 'plaintext', contentType: 'text' }],
        tagIds: [],
        isDeleted: false,
        isFavorites: false,
        createdAt: 100,
        updatedAt: 200,
        folderId: null
      }
    ])
  })

  it('非 JSON / 非对象 / 缺 snippets 数组 → 文件级报错', () => {
    expect(parseImportPayload('not json')).toEqual({ ok: false, error: '文件不是合法 JSON' })
    expect(parseImportPayload('[1,2]')).toEqual({ ok: false, error: '文件结构不正确：应为对象' })
    expect(parseImportPayload('{"foo":1}')).toEqual({
      ok: false,
      error: '文件结构不正确：缺少 snippets 数组'
    })
    expect(parseImportPayload('null')).toEqual({ ok: false, error: '文件结构不正确：应为对象' })
  })

  it('缺 id / 缺 name / 缺 contents / 缺时间戳的条目被丢弃', () => {
    const json = JSON.stringify({
      snippets: [
        { name: 'no id', contents: [], createdAt: 1, updatedAt: 2 },
        { id: 'b', contents: [], createdAt: 1, updatedAt: 2 },
        { id: 'c', name: 'no contents', createdAt: 1, updatedAt: 2 },
        { id: 'd', name: 'no time', contents: [] },
        { id: 'e', name: 'ok', contents: [], createdAt: 1, updatedAt: 2 }
      ]
    })
    const r = parseImportPayload(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snippets.map((s) => s.id)).toEqual(['e'])
  })

  it('非法 contents 条目被过滤，合法的保留并归一', () => {
    const json = JSON.stringify({
      snippets: [
        {
          id: 'a',
          name: 'mixed',
          contents: ['bad', null, { value: 'v', contentType: 'rich' }, { label: 'no value' }],
          createdAt: 1,
          updatedAt: 2
        }
      ]
    })
    const r = parseImportPayload(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.snippets[0].contents).toEqual([
      { id: '', label: '', value: 'v', language: 'plaintext', contentType: 'rich' }
    ])
  })

  it('空 snippets 数组合法（0 条导入）', () => {
    const r = parseImportPayload(JSON.stringify({ snippets: [] }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.snippets).toEqual([])
  })
})

describe('partitionForImport 去重切分', () => {
  it('同 id 跳过（含回收站内的 id），其余进入待导入', () => {
    const snippets = [exported({ id: 'a' }), exported({ id: 'b' }), exported({ id: 'c' })]
    const { toImport, skipped } = partitionForImport(snippets, new Set(['b', 'trash-1']))
    expect(toImport.map((s) => s.id)).toEqual(['a', 'c'])
    expect(skipped).toBe(1)
  })

  it('全部已存在时 toImport 为空', () => {
    const { toImport, skipped } = partitionForImport([exported()], new Set(['snip-1']))
    expect(toImport).toEqual([])
    expect(skipped).toBe(1)
  })
})

describe('导出 → 导入往返（结构自洽）', () => {
  it('buildExportPayload 落盘再解析，得到等价片段列表', () => {
    const payload = buildExportPayload([
      baseSnippet({ id: 'x1', trigger: ';brb', tagIds: ['t1'] }),
      baseSnippet({ id: 'x2', isFavorites: true })
    ])
    const roundTrip = parseImportPayload(JSON.stringify(payload))
    expect(roundTrip.ok).toBe(true)
    if (!roundTrip.ok) return
    expect(roundTrip.snippets.map((s) => s.id)).toEqual(['x1', 'x2'])
    expect(roundTrip.snippets[0].trigger).toBe(';brb')
    expect(roundTrip.snippets[0].tagIds).toEqual(['t1'])
    expect(roundTrip.snippets[1].isFavorites).toBe(true)
  })
})
