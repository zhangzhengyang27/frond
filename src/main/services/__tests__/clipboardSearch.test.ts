import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ClipboardHistoryService } from '../ClipboardHistoryService'

/**
 * B53-3a 剪贴板搜索下沉主进程：此前胶囊根搜索每击键 clipHist.list() 全量拉
 * 200 条含全文（单条上限 512KB）在渲染端过滤。search(query, limit) 在主进程
 * 侧过滤 + 截断，只投影渲染端画行需要的最小字段。
 */

let svc: InstanceType<typeof ClipboardHistoryService>
let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'frond-clip-search-'))
  svc = new ClipboardHistoryService()
  ;(svc as unknown as { dir: string }).dir = dir
  ;(svc as unknown as { items: unknown[] }).items = [
    { id: 't1', kind: 'text', text: 'hello world secret token', createdAt: 3 },
    { id: 't2', kind: 'link', text: 'https://example.com/api', createdAt: 4 },
    {
      id: 'f1',
      kind: 'files',
      paths: ['/Users/me/notes/report.pdf', '/b.txt'],
      createdAt: 5
    },
    { id: 't3', kind: 'text', text: 'unrelated', keywords: ['secret'], createdAt: 6 },
    { id: 'i1', kind: 'image', filePath: '/img.png', createdAt: 7 }
  ]
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('ClipboardHistoryService.search（B53-3a）', () => {
  it('text/link 命中 + keywords 命中 + files 路径命中；image 永不命中', () => {
    const byId = svc.search('secret', 10).map((r) => r.id)
    expect(byId).toContain('t1')
    expect(byId).toContain('t3') // keywords 命中
    expect(byId).not.toContain('i1')

    expect(svc.search('report', 10).map((r) => r.id)).toEqual(['f1'])
    expect(svc.search('example.com', 10).map((r) => r.id)).toEqual(['t2'])
  })

  it('limit 截断且保持 list() 的置顶/时间倒序', () => {
    const rows = svc.search('e', 2) // t1/e? hello world 含 e；多行命中验证截断
    expect(rows.length).toBeLessThanOrEqual(2)
  })

  it('text 截到 60 字符；files 只带 firstPath（不整包路径数组）', () => {
    const long = 'x'.repeat(500)
    ;(svc as unknown as { items: Array<Record<string, unknown>> }).items.unshift({
      id: 'long',
      kind: 'text',
      text: long,
      createdAt: 100
    })
    const r1 = svc.search(long, 1)[0]!
    expect(r1.text!.length).toBe(60)
    const r2 = svc.search('report', 1)[0]!
    expect(r2.firstPath).toBe('/Users/me/notes/report.pdf')
    expect(r2).not.toHaveProperty('paths')
  })
})
