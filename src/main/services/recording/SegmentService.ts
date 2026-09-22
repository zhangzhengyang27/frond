/**
 * Leaf · SegmentService
 *
 * 职责：在录制暂停/恢复场景里，封装对 rec_segments 表的状态转换语义。
 *
 * 关系：
 *   - 数据层：RecordingSegmentRepository（纯 SQL 增删改查）
 *   - 本服务：在 Repository 之上加语义（openSegment 自动找当前未关闭段；
 *           closeOpenSegment 自动定位；discardOpenForCrash 标记所有未关闭为 discarded）
 *   - 调用方：src/main/ipc/recording.ts（recording.segments.*）、
 *           screenRecorderSave.ts（finalize 时关闭最后一段）
 *
 * 设计要点：
 *   - 支持依赖注入：测试时传入带 db 的 Repository 实例，避免全局 database.handle
 *   - 不传时落回全局 singleton（生产环境行为）
 */

import type Database from 'better-sqlite3'
import {
  RecordingSegmentRepository,
  recordingSegmentRepository,
  type SegmentRow
} from '../../db/repos/RecordingSegmentRepository'

export class SegmentService {
  private readonly repo: RecordingSegmentRepository

  constructor(repo?: RecordingSegmentRepository) {
    this.repo = repo ?? recordingSegmentRepository
  }

  /**
   * 打开新分片（resume 时）。
   * 始终新建一行；不依赖上次是否还有未关闭段。
   */
  openSegment(recordingId: string): SegmentRow {
    return this.repo.open(recordingId)
  }

  /**
   * 关闭当前未关闭分片（pause / stop 时）。
   * - 若显式传 segmentId：优先按 id 关闭
   * - 否则：自动找当前录制最近一个 ended_at IS NULL 的分片
   * 返回是否真的关闭了某个分片
   */
  closeOpenSegment(
    recordingId: string,
    segmentId?: number
  ): { ok: boolean; reason?: 'no open segment' } {
    let id = segmentId
    if (id == null) {
      const open = this.repo.findOpen(recordingId)
      if (!open) return { ok: false, reason: 'no open segment' }
      id = open.id
    }
    this.repo.close(id)
    return { ok: true }
  }

  /**
   * 异常退出（app crash / kill -9 / power loss）后的恢复动作：
   * 把所有仍未关闭的分片标记为 discarded，不计入总时长。
   * 返回被标记的分片数量
   */
  discardOpenForCrash(recordingId: string): number {
    return this.repo.discardOpen(recordingId)
  }

  /**
   * 计算总时长（毫秒），扣除暂停间隔。
   * forwarded to RecordingSegmentRepository.totalDurationMs()
   */
  totalDurationMs(recordingId: string, asOf?: number): number {
    return this.repo.totalDurationMs(recordingId, asOf)
  }
}

// 工厂：main 进程 IPC 共享同一个实例
export const segmentService = new SegmentService()

// 工厂：测试可注入专属 db
export function createSegmentService(db: Database.Database): SegmentService {
  return new SegmentService(new RecordingSegmentRepository(db))
}
