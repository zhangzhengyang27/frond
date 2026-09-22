    tx()
    return changes > 0
  }

  /**
   * 找出所有 status='recording' 的行（启动扫描 / 崩溃恢复用）
   */
  findInProgress(): RecordingRow[] {
    return this.db
      .prepare(
        `SELECT * FROM rec_recordings
         WHERE status IN ('recording','paused') AND deleted_at IS NULL`
      )
      .all() as RecordingRow[]
  }

  /**
   * 按 file_name 硬删（含软删行）。legacy JSON 通道的双写行 id 是重新生成的
   * UUID，与 JSON id 不同源，删除同步只能按文件名匹配。
   */
  hardDeleteByFileName(fileName: string): number {
    return this.db.prepare('DELETE FROM rec_recordings WHERE file_name = ?').run(fileName).changes
  }

  /**
   * 标记恢复成功（orphan → recovered）
   */
  markRecovered(id: string, endedAt?: number): void {
    this.db
      .prepare(
        `UPDATE rec_recordings
         SET status        = 'recovered',
             recovered_at  = ?,
             ended_at      = COALESCE(?, ended_at),
             updated_at    = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(now(), endedAt ?? null, now(), id)
