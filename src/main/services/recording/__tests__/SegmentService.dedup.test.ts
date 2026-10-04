import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb, closeTestDb } from '../../../db/__tests__/testDb'
import { RecordingSegmentRepository } from '../../../db/repos/RecordingSegmentRepository'
import { RecordingRepository } from '../../../db/repos/RecordingRepository'
import { SegmentService } from '../SegmentService'

/**
 * B57-9 回归钉：open 段防重。
 * 旧实现 openSegment「始终新建一行」且 close 只关 findOpen 最新一条——
 * pause/stop 竞态产生两个 open 段时，旧段永远 ended_at IS NULL，
 * totalDurationMs 按 now()-started_at 无限虚增（挂机越久历史时长越离谱）。
 * 修复：open 前自动关闭该录制的一切遗留 open 段（同一时刻至多一个 open）。
 */

let db: Database.Database
let repo: RecordingSegmentRepository
let svc: SegmentService
let recordings: RecordingRepository

beforeEach(() => {
  db = createTestDb()
  repo = new RecordingSegmentRepository(db)
  svc = new SegmentService(repo)
  recordings = new RecordingRepository(db)
  // rec_segments.recording_id 外键指向 rec_recordings：先建父行
  for (const id of ['r1', 'r2', 'r3', 'r4']) {
    recordings.insert({ id, file_path: `/tmp/${id}.mp4`, file_name: `${id}.mp4` })
  }
})

afterEach(() => {
  closeTestDb(db)
})

describe('RecordingSegmentRepository.open 防重（B57-9）', () => {
  it('连续 open：上一段自动关闭，任一时刻至多一个 open 段', () => {
    const first = repo.open('r1')
    const second = repo.open('r1')

    expect(repo.findOpen('r1')?.id).toBe(second.id)
    const rows = repo.listByRecording('r1')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.ended_at).not.toBeNull() // 遗留 open 已被自动关闭
    expect(rows[1]!.ended_at).toBeNull()
    void first
  })

  it('totalDurationMs 不再随时间虚增：全段关闭后两次计算稳定', () => {
    repo.open('r2')
    repo.open('r2') // 触发自动关闭（新实现）——旧实现首段永远 open
    const second = repo.findOpen('r2')
    // 显式 endedAt：同毫秒开合的段会被 `end > started_at` 严格判断跳过（时长 0）
    const base = Date.now() + 10_000
    repo.close(second!.id, base) // 收尾：全段关闭
    // asOf 必须大于真实时间戳，否则开放段按 ref 算出负值被跳过（恒 0 的假绿）
    const a = repo.totalDurationMs('r2', base + 1)
    const b = repo.totalDurationMs('r2', base + 3_600_000)
    expect(a).toBe(b)
    expect(a).toBeGreaterThan(0)
  })

  it('服务层 openSegment 同样防重（调用方零改动获益）', () => {
    svc.openSegment('r3')
    svc.openSegment('r3')
    svc.openSegment('r3')
    expect(repo.listByRecording('r3')).toHaveLength(3)
    expect(repo.listByRecording('r3').filter((r) => r.ended_at === null)).toHaveLength(1)
  })

  it('正常节奏 open→close→open 不受影响（暂停/恢复语义保持）', () => {
    const s1 = svc.openSegment('r4')
    svc.closeOpenSegment('r4')
    const s2 = svc.openSegment('r4')
    expect(s2.seg_index).toBe(s1.seg_index + 1)
    expect(s2.ended_at).toBeNull()
    expect(repo.totalDurationMs('r4')).toBeGreaterThanOrEqual(0)
  })
})
