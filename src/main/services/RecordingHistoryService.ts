/**
 * @deprecated
 *
 * 本服务使用 JSON 文件存储历史，**将于 1.0 起 6 个月内移除**（预计 2026-12 之前删）。
 *
 * **迁移路径**：
 * - 写入：改用 `recordingRepository.insert()`（基于 SQLite rec_recordings 表）
 * - 读取：改用 `recordingRepository.list()` / `findById()`
 * - IPC：旧 `recording-history:*` 保留；新通道 `recording.list / get / delete`
 *
 * **为什么仍然保留**：
 * - 现有 renderer / IPC handler 大量依赖本类
 * - 1.0 阶段需要保留"切换回旧版"的环境开关（USE_SQLITE_RECORDING=0）
 * - 数据迁移在 Sprint 5 集中处理，本类在那之前不能直接删
 *
 * 详见 `docs/modules/07-screen-recorder.md` §3 迁移路线。
 */
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { promisify } from 'util'
import { execFile } from 'child_process'
import { getFfmpegPath } from '../utils/ffmpeg'
import { recordingRepository } from '../db/repos/RecordingRepository'

// 使用 execFile + 参数数组，避免路径中的特殊字符导致命令注入/破坏
const execFileAsync = promisify(execFile)

export interface RecordingHistory {
  id: string
  filename: string
  filePath: string
  duration: number // 秒
  fileSize: number // 字节
  createdAt: number // 时间戳
  thumbnail?: string // 缩略图路径
}

export class RecordingHistoryService {
  private static instance: RecordingHistoryService
  private historyPath: string
  private history: RecordingHistory[] = []
  private readonly MAX_HISTORY_COUNT = 100 // 最多保留 100 条记录
  private readonly CLEANUP_DAYS = 30 // 30 天后自动清理

  private constructor() {
    this.historyPath = join(app.getPath('userData'), 'recording-history.json')
    this.loadHistory()
    this.cleanupOldRecords()
  }

  static getInstance(): RecordingHistoryService {
    if (!RecordingHistoryService.instance) {
      RecordingHistoryService.instance = new RecordingHistoryService()
    }
    return RecordingHistoryService.instance
  }

  /**
   * 加载历史记录
   */
  private loadHistory(): void {
    if (existsSync(this.historyPath)) {
      try {
        const data = readFileSync(this.historyPath, 'utf-8')
        this.history = JSON.parse(data)
        // 验证并过滤无效记录
        this.history = this.history.filter((item) => {
          // 检查文件是否存在
          if (!existsSync(item.filePath)) {
            return false
          }
          return true
        })
      } catch (error) {
        console.error('加载录制历史失败:', error)
        this.history = []
      }
    }
  }

  /**
   * 保存历史记录
   */
  private saveHistory(): void {
    try {
      writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2), 'utf-8')
    } catch (error) {
      console.error('保存录制历史失败:', error)
    }
  }

  /**
   * 添加录制历史
   *
   * PR-2 改造：除写 JSON 外，**双写到 SQLite rec_recordings**（基于 recordingRepository）。
   * 双写失败时仅 log.error，不抛错——保持旧 JSON 路径的可用性。
   */
  addHistory(recording: Omit<RecordingHistory, 'id' | 'createdAt'>): RecordingHistory {
    // 检查文件是否存在
    if (!existsSync(recording.filePath)) {
      throw new Error('录制文件不存在')
    }

    // 获取文件大小
    let fileSize = recording.fileSize
    if (!fileSize) {
      try {
        const stats = statSync(recording.filePath)
        fileSize = stats.size
      } catch (error) {
        console.error('获取文件大小失败:', error)
        fileSize = 0
      }
    }

    const historyItem: RecordingHistory = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      filename: recording.filename,
      filePath: recording.filePath,
      duration: recording.duration,
      fileSize,
      createdAt: Date.now(),
      thumbnail: recording.thumbnail
    }

    // 添加到列表开头
    this.history.unshift(historyItem)

    // 限制历史记录数量
    if (this.history.length > this.MAX_HISTORY_COUNT) {
      this.history = this.history.slice(0, this.MAX_HISTORY_COUNT)
    }

    this.saveHistory()

    // ── 双写到 SQLite（PR-2 新增；失败不抛错）──
    try {
      // 用 UUIDv4 当新行 id；旧 id 写进 description 字段供溯源
      recordingRepository.insert({
        id: randomUUID(),
        file_path: historyItem.filePath,
        file_name: historyItem.filename,
        duration_ms: Math.round((historyItem.duration ?? 0) * 1000),
        file_size: historyItem.fileSize,
        fps: 30,
        status: 'completed',
        description: `legacy:${historyItem.id}`,
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
      this.history.splice(index, 1)
      this.saveHistory()
      return true
    }
    return false
  }

  /**
   * 清空所有历史记录
   */
  clearHistory(): void {
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
    const afterCount = this.history.length

    if (beforeCount !== afterCount) {
      console.log(`清理了 ${beforeCount - afterCount} 条旧记录`)
      this.saveHistory()
    }
  }

  /**
   * 生成视频缩略图
   * @param videoPath 视频文件路径
   * @param timestamp 提取的时间点（秒），默认为 1 秒
   * @returns 缩略图文件路径，失败返回 null
   */
  async generateThumbnail(videoPath: string, timestamp: number = 1): Promise<string | null> {
    // 验证视频文件是否存在
    if (!existsSync(videoPath)) {
      console.error('视频文件不存在:', videoPath)
      return null
    }

    try {
      const ffmpeg = getFfmpegPath()
      const thumbnailPath = videoPath.replace(/\.[^/.]+$/, '.jpg')

      // 构建 ffmpeg 命令
      // -ss: 跳转到指定时间点
      // -i: 输入文件
      // -vframes 1: 只提取一帧
      // -y: 覆盖输出文件（如果存在）
      // -q:v 2: 高质量 JPEG（1-31，2 是高质量）
      const hours = Math.floor(timestamp / 3600)
      const minutes = Math.floor((timestamp % 3600) / 60)
      const seconds = Math.floor(timestamp % 60)
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

      const args = [
        '-ss',
        timeStr,
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-q:v',
        '2',
        '-y',
        thumbnailPath
      ]

      console.log('生成缩略图:', { videoPath, thumbnailPath, timestamp, ffmpeg })
      await execFileAsync(ffmpeg, args, { timeout: 30000 }) // 30 秒超时

      // 验证缩略图是否成功生成
      if (existsSync(thumbnailPath)) {
        const stats = statSync(thumbnailPath)
        if (stats.size > 0) {
          console.log('缩略图生成成功:', thumbnailPath)
          return thumbnailPath
        } else {
          console.warn('缩略图文件为空:', thumbnailPath)
          return null
        }
      } else {
        console.warn('缩略图文件未生成:', thumbnailPath)
        return null
      }
    } catch (error) {
      const errorMsg = (error as Error).message || String(error)
      console.error('生成缩略图失败:', {
        videoPath,
        error: errorMsg,
        ffmpeg: getFfmpegPath()
      })

      // 提供更详细的错误信息
      if (
        errorMsg.includes('ffmpeg') ||
        errorMsg.includes('No such file') ||
        errorMsg.includes('ENOENT')
      ) {
        console.error('ffmpeg 未找到，请确保已安装 ffmpeg 或使用打包版本')
      } else if (errorMsg.includes('timeout')) {
        console.error('生成缩略图超时，视频文件可能已损坏')
      } else if (errorMsg.includes('Invalid data found')) {
        console.error('视频文件格式无效或已损坏')
      }

      return null
    }
  }

  /**
   * 更新历史记录的缩略图
   */
  async updateThumbnail(id: string): Promise<string | null> {
    const item = this.history.find((h) => h.id === id)
    if (!item) {
      return null
    }

    const thumbnail = await this.generateThumbnail(item.filePath)
    if (thumbnail) {
      item.thumbnail = thumbnail
      this.saveHistory()
    }
    return thumbnail
  }

  /**
   * 获取历史记录统计信息
   */
  getStatistics(): {
    total: number
    totalSize: number // 总大小（字节）
    totalDuration: number // 总时长（秒）
    oldestDate: number | null
    newestDate: number | null
  } {
    if (this.history.length === 0) {
      return {
        total: 0,
        totalSize: 0,
        totalDuration: 0,
        oldestDate: null,
        newestDate: null
      }
    }

    const totalSize = this.history.reduce((sum, item) => sum + item.fileSize, 0)
    const totalDuration = this.history.reduce((sum, item) => sum + item.duration, 0)
    const dates = this.history.map((item) => item.createdAt)
    const oldestDate = Math.min(...dates)
    const newestDate = Math.max(...dates)

    return {
      total: this.history.length,
      totalSize,
      totalDuration,
      oldestDate,
      newestDate
    }
  }
}

