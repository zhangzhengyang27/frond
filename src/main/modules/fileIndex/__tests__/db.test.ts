import { describe, it, expect, beforeEach } from 'vitest'
import { FileIndexDb } from '../db'

/**
 * 文件索引库（独立 sqlite 文件；测试用 :memory:）：
 * files 主表 + files_fts（FTS5 外部内容表，触发器同步）+ dirs 目录水位表。
 * 查询：name 模式走 {name skeleton path}，content 模式走 {content}；token 前缀匹配。
 */
function makeDb(): FileIndexDb {
  const db = FileIndexDb.openInMemory()
  db.upsertFiles([
    { path: '/repo/项目计划.md', parent: '/repo', name: '项目计划.md', ext: 'md', size: 100, mtime: 1, isDir: false, skeleton: 'xmjhmd', content: '# 项目计划\n完成文件索引' },
    { path: '/repo/README.md', parent: '/repo', name: 'README.md', ext: 'md', size: 20, mtime: 2, isDir: false, skeleton: 'readmemd', content: 'hello world' },
    { path: '/repo/src/fileIndex/a.ts', parent: '/repo/src/fileIndex', name: 'a.ts', ext: 'ts', size: 5, mtime: 3, isDir: false, skeleton: 'ats', content: 'const a = 1' }
  ])
  return db
}

describe('FileIndexDb 基础读写', () => {
  let db: FileIndexDb
  beforeEach(() => {
    db = makeDb()
  })

  it('count 与按 parent 列目录', () => {
    expect(db.count()).toBe(3)
    const children = db.listDirChildren('/repo')
    expect(children.map((c) => c.name).sort()).toEqual(['README.md', '项目计划.md'])
  })

  it('name 模式：标题子串前缀命中', () => {
    const hits = db.search(['readme'], { mode: 'name', limit: 10 })
    expect(hits).toHaveLength(1)
    expect(hits[0].path).toBe('/repo/README.md')
  })

  it('skeleton：拼音首字母可搜中文文件名', () => {
    const hits = db.search(['xmjh'], { mode: 'name', limit: 10 })
    expect(hits).toHaveLength(1)
    expect(hits[0].path).toBe('/repo/项目计划.md')
  })

  it('中文原文可搜（unicode61 逐字 token）', () => {
    const hits = db.search(['项目'], { mode: 'name', limit: 10 })
    expect(hits.map((h) => h.path)).toContain('/repo/项目计划.md')
  })

  it('content 模式命中正文', () => {
    const hits = db.search(['hello'], { mode: 'content', limit: 10 })
    expect(hits.map((h) => h.path)).toEqual(['/repo/README.md'])
  })

  it('删除后 FTS 同步消失（触发器）', () => {
    db.deleteByPaths(['/repo/README.md'])
    expect(db.count()).toBe(2)
    expect(db.search(['hello'], { mode: 'content', limit: 10 })).toEqual([])
    expect(db.search(['readme'], { mode: 'name', limit: 10 })).toEqual([])
  })

  it('目录水位表', () => {
    db.markDir('/repo', 12345)
    expect(db.getDirEpoch('/repo')).toBe(12345)
    expect(db.getDirEpoch('/nope')).toBeNull()
  })

  it('前缀级联删除（目录被移除）', () => {
    db.deleteByPrefix('/repo/src/')
    expect(db.count()).toBe(2)
    expect(db.search(['a.ts'], { mode: 'name', limit: 10 })).toEqual([])
  })

  it('limit 生效', () => {
    expect(db.search(['md'], { mode: 'name', limit: 1 })).toHaveLength(1)
  })
})
