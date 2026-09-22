   * 恢复一个 orphan
   * - ffprobe 校验时长 ≥ 1s（类注释承诺的校验，旧实现缺失 → 可能恢复损坏残片）
   * - 若 DB 已有 row（status=failed）→ 走 markRecovered + rename
   * - 若 DB 没 row（orphan file）→ 创建新 row（status='recovered'）+ rename
   *
   * 返回新 / 更新的 recordingId；文件不可恢复时抛错（IPC 层转提示）
   */
  async recover(filePath: string): Promise<{ recordingId: string }> {
    if (!existsSync(filePath)) {
      throw new Error(`[RecoveryManager] file not found: ${filePath}`)
    }

    const probe = this.deps.probeDuration ?? probeDurationSec
    const dur = await probe(filePath)
    if (dur == null || dur < MIN_RECOVER_DURATION_SEC) {
      throw new Error(
        `[RecoveryManager] file too short/corrupted to recover (${dur ?? 'unknown'}s): ${filePath}`
      )
    }

    const fileName = basename(filePath)
    const dbRow = this.findRowByFileName(fileName)

    // rename: <name>.partial.mp4 → <name-replace-partial>.mp4
    const newPath = filePath.replace(PARTIAL_SUFFIX, '.mp4')
    renameSync(filePath, newPath)

    if (dbRow) {
      recordingRepository.markRecovered(dbRow.id)
      // 更新 file_path / file_name 指向新路径
      database.handle
        .prepare(
          `UPDATE rec_recordings
           SET file_path = ?, file_name = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(newPath, basename(newPath), this.nowFn(), dbRow.id)
      return { recordingId: dbRow.id }
    }

    // 无 DB 行：创建 recovered 行（最小字段集）
    const id = this.generateId()
    recordingRepository.insert({
      id,
      file_path: newPath,
      file_name: basename(newPath),
      status: 'recording' // insert 后立即 markRecovered
    })
    recordingRepository.markRecovered(id)
    return { recordingId: id }
  }

  /**
   * 丢弃一个 orphan（unlink + 清理关联行）
   */
  discard(rawFilePath: string): { ok: boolean } {
    let filePath: string
    try {
      filePath = this.resolvePartialPathForMutation(rawFilePath)
    } catch {
      return { ok: false }
    }
    if (!existsSync(filePath)) {
      return { ok: false }
    }
    const fileName = basename(filePath)
    const dbRow = this.findRowByFileName(fileName)

    try {
      unlinkSync(filePath)
    } catch {
      return { ok: false }
    }

    if (dbRow) {
      recordingRepository.hardDelete(dbRow.id)
    }
    return { ok: true }
  }

  /**
