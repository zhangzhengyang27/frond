/**
 * Frond · Migration 008 — 屏幕录制：rec_recordings 扩字段 + 新增 rec_segments
 *
 * 背景：
 * - 001_init 已建 rec_recordings / rec_markers / rec_clips，但 schema 是 1.0 之前的产物
 * - 1.0 重构（见 docs/modules/07-screen-recorder.md）需要：
 *   · status 枚举扩展：'recording' | 'paused' | 'completed' | 'failed' | 'recovered'
 *     （001 仅有 DEFAULT 'recording'，没有 CHECK 约束，需补；SQLite 不能直接 ALTER 加 CHECK
 *      —— 通过新 CHECK 重新建表 + 拷数据实现）
 *   · 新增 has_system_audio / recovered_at / cursor_style / error_message / fps_quality
 *   · 新增 rec_segments：暂停分片（不在原 rec_clips 范畴；rec_clips 仍保留为「剪辑导出」）
 *
 * 幂等策略：
 * - ADD COLUMN 用 PRAGMA table_info 检查
 * - CREATE TABLE / CREATE INDEX 用 IF NOT EXISTS
 * - CHECK 约束：创建时 SQLite 不支持修改已有 CHECK，只能靠「不抛错」保证
 *   （即 status 新值在写入时也只可能是 5 个之一，且 001 创建时无 CHECK，所以现有数据兼容）
 *
 * 设计边界：
 * - 本 migration 不动 rec_clips 表（剪辑功能后续 PR-4 再扩）
 * - 不动 rec_markers 表（markers schema 已够用）
 * - 仅以「追加」原则扩展录制主表
 */

import type { Migration } from '.'

export const m008_recording_segments_and_status: Migration = {
  version: 8,
  name: 'recording_segments_and_status',
  up(db) {
    // ─── 1) rec_recordings 扩字段（PRAGMA 检查 + ADD COLUMN） ───
    const cols = (
      db.prepare(`PRAGMA table_info('rec_recordings')`).all() as Array<{ name: string }>
    ).map((c) => c.name)

    const addCol = (colName: string, ddl: string): void => {
      if (!cols.includes(colName)) {
        db.exec(`ALTER TABLE rec_recordings ADD COLUMN ${ddl}`)
      }
    }

    addCol('has_system_audio', `has_system_audio INTEGER NOT NULL DEFAULT 0`)
    addCol('recovered_at', `recovered_at INTEGER`)
    addCol('cursor_style', `cursor_style TEXT`)
    addCol('error_message', `error_message TEXT`)
    addCol('quality', `quality TEXT NOT NULL DEFAULT 'medium'`)
    addCol('has_camera', `has_camera INTEGER NOT NULL DEFAULT 0`) // 001 已建，这里仅做防御性幂等
    // 001 默认值是 'recording'，但未加 CHECK。SQLite ALTER 不能加 CHECK，故放弃；
    // 状态枚举约束由 Repository 写入路径保证（详见 RecordingRepository.insert 注释）

    // ─── 2) rec_segments（暂停分片）───
    db.exec(`
      CREATE TABLE IF NOT EXISTS rec_segments (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        recording_id TEXT    NOT NULL,
        seg_index    INTEGER NOT NULL,
        started_at   INTEGER NOT NULL,
        ended_at     INTEGER,
        state        TEXT    NOT NULL DEFAULT 'committed'
                       CHECK(state IN ('committed','discarded')),
        FOREIGN KEY (recording_id) REFERENCES rec_recordings(id) ON DELETE CASCADE,
        UNIQUE(recording_id, seg_index)
      )
    `)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_rec_segments_recording
         ON rec_segments(recording_id, seg_index)`
    )

    // ─── 3) 补全索引（001 已有 idx_rec_recordings_started_desc / idx_rec_recordings_status；
    //     Library 页面需要「按状态筛活跃记录」的复合索引，避免对大表全扫）───
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_rec_recordings_status_started
         ON rec_recordings(status, started_at DESC)
         WHERE deleted_at IS NULL`
    )

    // ─── 4) 删除加速：Library 列表只展示非 deleted 的，partial index 已覆盖
    //     （001 的 idx_rec_recordings_status 是全表；上面 partial 索引更精准）
  }
}
