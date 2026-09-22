        thumbnail_path: historyItem.thumbnail ?? null,
        started_at: historyItem.createdAt
      })
    } catch (e) {
      console.error('[RecordingHistoryServiceLegacy] dual-write to SQLite failed:', e)
    }

    return historyItem
  }

  /**
   * 获取所有历史记录
   */
  getHistory(): RecordingHistory[] {
    // 按创建时间倒序排列
    return [...this.history].sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * 根据日期范围获取历史记录
   */
  getHistoryByDateRange(start: Date, end: Date): RecordingHistory[] {
    const startTime = start.getTime()
    const endTime = end.getTime()
    return this.history.filter((item) => item.createdAt >= startTime && item.createdAt <= endTime)
  }

  /**
   * 删除历史记录
   */
  deleteHistory(id: string): boolean {
    const index = this.history.findIndex((item) => item.id === id)
    if (index !== -1) {
      const item = this.history[index]
      this.history.splice(index, 1)
      this.saveHistory()
      // 同步硬删双写进 SQLite 的行：否则 UI 删除后记录会从 SQLite「复活」
      try {
        recordingRepository.hardDeleteByFileName(item.filename)
      } catch (e) {
        console.error('[RecordingHistoryServiceLegacy] sync hardDelete to SQLite failed:', e)
      }
      return true
    }
    return false
  }

  /**
   * 清空所有历史记录
   */
  clearHistory(): void {
    for (const item of this.history) {
      try {
        recordingRepository.hardDeleteByFileName(item.filename)
      } catch {
        /* 单条失败不阻断清空 */
      }
    }
    this.history = []
    this.saveHistory()
  }

  /**
   * 清理旧记录（30天前的记录）
   */
  private cleanupOldRecords(): void {
    const cutoffTime = Date.now() - this.CLEANUP_DAYS * 24 * 60 * 60 * 1000
    const beforeCount = this.history.length
    this.history = this.history.filter((item) => item.createdAt >= cutoffTime)
