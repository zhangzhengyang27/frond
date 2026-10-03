import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb, closeTestDb } from './testDb'
import { RecordingRepository } from '../repos/RecordingRepository'

/**
 * RecordingRepository.findByFilePath（B48 白名单数据源）：
 * recording.export.getInfo / export.start 的 sourcePath 守卫要按「已登记的
 * 录制文件路径」放行——查询语义钉住三条：精确匹配、软删行不放行、未知路径 null。
 */
describe('RecordingRepository.findByFilePath', () => {
  let db: Database.Database
  let repo: RecordingRepository

  beforeEach(() => {
    db = createTestDb()
    repo = new RecordingRepository(db)
  })

  afterEach(() => {
    closeTestDb(db)
  })

  it('精确匹配已登记路径，返回未删除行', () => {
    repo.insert({ id: 'r1', file_path: '/tmp/rec/a.mp4', file_name: 'a.mp4' })
    expect(repo.findByFilePath('/tmp/rec/a.mp4')?.id).toBe('r1')
    // 相似但不同的路径不命中（不是 LIKE）
    expect(repo.findByFilePath('/tmp/rec/a.mp')).toBeNull()
  })

  it('软删除的行不放行（deleted_at 过滤）', () => {
    repo.insert({ id: 'r2', file_path: '/tmp/rec/b.mp4', file_name: 'b.mp4' })
    repo.softDelete('r2')
    expect(repo.findByFilePath('/tmp/rec/b.mp4')).toBeNull()
  })

  it('未知路径返回 null', () => {
    expect(repo.findByFilePath('/etc/passwd')).toBeNull()
  })
})
