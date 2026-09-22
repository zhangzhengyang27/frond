import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, existsSync, unlinkSync } from 'fs'
import { promisify } from 'util'
import { execFile } from 'child_process'
import Store from 'electron-store'
import { getFfmpegPath, probeMediaInfo } from '../utils/ffmpeg'

// 使用 execFile + 参数数组，避免路径中的特殊字符（引号、$、反引号等）导致命令注入/破坏
const execFileAsync = promisify(execFile)

/**
 * 剪辑片段接口
 */
export interface Clip {
  id: string
  startTime: number // 秒
  endTime: number // 秒
  label?: string
}

/**
 * 导出选项接口
 */
export interface ExportOptions {
  clips: Clip[]
  transition?: 'fade' | 'cut' | 'slide'
  intro?: string // 片头路径
  outro?: string // 片尾路径
  backgroundMusic?: {
    path: string
    volume: number // 0-1
  }
  resolution: 720 | 1080 | 1440 | 2160
  fps: 30 | 60
  outputPath: string
}

/**
 * 导出进度回调
 */
export type ExportProgressCallback = (progress: {
  percent: number
  currentClip: number
  totalClips: number
  message: string
}) => void

/**
 * 视频剪辑服务类
 */
export class ClipService {
  private static instance: ClipService
  private clipsStore: Store
  private clips: Map<string, Clip[]> = new Map() // videoId -> clips[]

  private constructor() {
    this.clipsStore = new Store({
      name: 'clips',
      defaults: {}
    })
    this.loadClips()
  }

  static getInstance(): ClipService {
    if (!ClipService.instance) {
      ClipService.instance = new ClipService()
    }
    return ClipService.instance
  }

  /**
   * 从持久化存储加载剪辑
   */
  private loadClips(): void {
    try {
      const data = this.clipsStore.store
      Object.keys(data).forEach((videoId) => {
        const clips = data[videoId] as Clip[]
        if (Array.isArray(clips)) {
          this.clips.set(videoId, clips)
        }
      })
    } catch (error) {
      console.error('加载剪辑失败:', error)
    }
  }

  /**
   * 保存剪辑到持久化存储
   */
  private saveClips(videoId: string): void {
    try {
      const clips = this.clips.get(videoId) || []
      this.clipsStore.set(videoId, clips)
    } catch (error) {
      console.error('保存剪辑失败:', error)
    }
  }

  /**
   * 格式化时间为 HH:MM:SS
   */
  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  /**
   * 添加剪辑片段
   */
  addClip(videoId: string, startTime: number, endTime: number, label?: string): Clip {
    if (startTime >= endTime) {
      throw new Error('开始时间必须小于结束时间')
    }

    if (startTime < 0) {
      throw new Error('开始时间不能为负数')
    }

    const clip: Clip = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime,
      endTime,
      label: label || `片段 ${startTime}s - ${endTime}s`
    }

    if (!this.clips.has(videoId)) {
      this.clips.set(videoId, [])
    }

    const clips = this.clips.get(videoId)!
    clips.push(clip)
    // 按开始时间排序
    clips.sort((a, b) => a.startTime - b.startTime)

    this.saveClips(videoId)
    return clip
  }

  /**
   * 删除剪辑片段
   */
  removeClip(videoId: string, clipId: string): boolean {
    const clips = this.clips.get(videoId)
    if (!clips) {
      return false
    }

    const index = clips.findIndex((c) => c.id === clipId)
    if (index === -1) {
      return false
    }

    clips.splice(index, 1)
    this.saveClips(videoId)
    return true
  }

  /**
   * 更新剪辑片段
   */
  updateClip(videoId: string, clipId: string, updates: Partial<Clip>): Clip | null {
    const clips = this.clips.get(videoId)
    if (!clips) {
      return null
    }

    const clip = clips.find((c) => c.id === clipId)
    if (!clip) {
      return null
    }

    Object.assign(clip, updates)
    // 重新排序
    clips.sort((a, b) => a.startTime - b.startTime)
    this.saveClips(videoId)
    return clip
  }

  /**
   * 获取所有剪辑片段
   */
  getClips(videoId: string): Clip[] {
    return this.clips.get(videoId) || []
  }

  /**
   * 清空所有剪辑片段
   */
  clearClips(videoId: string): void {
    this.clips.delete(videoId)
    this.clipsStore.delete(videoId)
  }

  /**
   * 预览剪辑片段（生成预览视频）
   */
  async previewClip(videoPath: string, clip: Clip): Promise<string> {
    if (!existsSync(videoPath)) {
      throw new Error('视频文件不存在')
    }

    const ffmpeg = getFfmpegPath()
    const outputPath = join(app.getPath('temp'), `preview-${clip.id}.mp4`)

    const startTime = this.formatTime(clip.startTime)
    const duration = clip.endTime - clip.startTime

    // 构建 ffmpeg 参数：提取指定时间段的视频
    const args = [
      '-ss',
      startTime,
      '-i',
      videoPath,
      '-t',
      String(duration),
      '-c',
      'copy',
      '-y',
      outputPath
    ]

    try {
      await execFileAsync(ffmpeg, args, { timeout: 60000 }) // 60 秒超时

      if (existsSync(outputPath)) {
        return outputPath
      } else {
        throw new Error('预览视频生成失败')
      }
    } catch (error) {
      console.error('预览剪辑失败:', error)
      throw new Error(`预览剪辑失败: ${(error as Error).message}`)
    }
  }

  /**
   * 导出剪辑后的视频
   */
  async exportClips(
    videoPath: string,
    options: ExportOptions,
    progressCallback?: ExportProgressCallback
  ): Promise<string> {
    if (!existsSync(videoPath)) {
      throw new Error('视频文件不存在')
    }

    if (options.clips.length === 0) {
      throw new Error('没有要导出的剪辑片段')
    }

    const ffmpeg = getFfmpegPath()
    const tempDir = app.getPath('temp')
    const clipFiles: string[] = []
    // 各阶段中间产物：失败时也要清理（集中在 finally，按已创建的为准）
    const normalizedEdges: string[] = []
    let concatFilePath: string | null = null
    let mergedPath: string | null = null

    try {
      // 步骤 1: 提取每个剪辑片段
      progressCallback?.({
        percent: 0,
        currentClip: 0,
        totalClips: options.clips.length,
        message: '正在提取剪辑片段...'
      })

      for (let i = 0; i < options.clips.length; i++) {
        const clip = options.clips[i]
        const clipPath = join(tempDir, `clip-${clip.id}.mp4`)
        const startTime = this.formatTime(clip.startTime)
        const duration = clip.endTime - clip.startTime

        // 提取片段
        const extractArgs = [
          '-ss',
          startTime,
          '-i',
          videoPath,
          '-t',
          String(duration),
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '23',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-y',
          clipPath
        ]
        await execFileAsync(ffmpeg, extractArgs, { timeout: 300000 }) // 5 分钟超时

        if (!existsSync(clipPath)) {
          throw new Error(`提取片段 ${i + 1} 失败`)
        }

        clipFiles.push(clipPath)

        progressCallback?.({
          percent: Math.floor(((i + 1) / options.clips.length) * 30),
          currentClip: i + 1,
          totalClips: options.clips.length,
          message: `已提取 ${i + 1}/${options.clips.length} 个片段`
        })
      }

      // 步骤 2: 创建 concat 文件列表
      // concat demuxer 要求所有输入编码参数一致：片段已经统一转码（libx264/aac），
      // 但 intro/outro 是用户任意文件 —— 分辨率/编码不同会花屏或直接失败，
      // 统一归一化到源视频分辨率（等比缩放 + 补边），并保证有音轨
      const normalizeEdge = async (edgePath: string, tag: string): Promise<string | null> => {
        try {
          const srcInfo = await probeMediaInfo(videoPath)
          const out = join(tempDir, `${tag}-norm-${Date.now()}.mp4`)
          const args: string[] = ['-i', edgePath]
          if (srcInfo.width && srcInfo.height) {
            args.push(
              '-f',
              'lavfi',
              '-i',
              'anullsrc=channel_layout=stereo:sample_rate=44100',
              '-vf',
              `scale=${srcInfo.width}:${srcInfo.height}:force_original_aspect_ratio=decrease,pad=${srcInfo.width}:${srcInfo.height}:(ow-iw)/2:(oh-ih)/2`
            )
          } else {
            args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')
          }
          args.push(
            '-map',
            '0:v',
            '-map',
            '1:a',
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-shortest',
            '-y',
            out
          )
          await execFileAsync(ffmpeg, args, { timeout: 300000 })
          if (!existsSync(out)) return null
          normalizedEdges.push(out)
          return out
        } catch (error) {
          console.warn(`[ClipService] ${tag} 归一化失败，使用原文件:`, error)
          return null
        }
      }

      let introNorm: string | null = null
      let outroNorm: string | null = null
      if (options.intro && existsSync(options.intro)) {
        introNorm = await normalizeEdge(options.intro, 'intro')
      }
      if (options.outro && existsSync(options.outro)) {
        outroNorm = await normalizeEdge(options.outro, 'outro')
      }

      concatFilePath = join(tempDir, `concat-${Date.now()}.txt`)
      const concatLines: string[] = []

      // 添加片头（如果有）
      if (introNorm) {
        concatLines.push(`file '${introNorm.replace(/'/g, "'\\''")}'`)
        concatLines.push('')
      }

      // 添加剪辑片段
      for (const clipFile of clipFiles) {
        concatLines.push(`file '${clipFile.replace(/'/g, "'\\''")}'`)
        concatLines.push('')
      }

      // 添加片尾（如果有）
      if (outroNorm) {
        concatLines.push(`file '${outroNorm.replace(/'/g, "'\\''")}'`)
        concatLines.push('')
      }

      writeFileSync(concatFilePath, concatLines.join('\n'), 'utf-8')

      progressCallback?.({
        percent: 35,
        currentClip: options.clips.length,
        totalClips: options.clips.length,
        message: '正在合并视频...'
      })

      // 步骤 3: 合并视频
      mergedPath = join(tempDir, `merged-${Date.now()}.mp4`)
      const mergeArgs = [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatFilePath,
        '-c',
        'copy',
        '-y',
        mergedPath
      ]
      await execFileAsync(ffmpeg, mergeArgs, { timeout: 300000 })

      if (!existsSync(mergedPath)) {
        throw new Error('合并视频失败')
      }

      progressCallback?.({
        percent: 60,
        currentClip: options.clips.length,
        totalClips: options.clips.length,
        message: '正在处理视频效果...'
      })

      // 步骤 4: 应用转场效果、添加背景音乐、调整分辨率和帧率
      const finalArgs = this.buildFinalArgs(mergedPath, options.outputPath, options)
      await execFileAsync(ffmpeg, finalArgs, { timeout: 600000 }) // 10 分钟超时

      progressCallback?.({
        percent: 100,
        currentClip: options.clips.length,
        totalClips: options.clips.length,
        message: '导出完成'
      })

      // 临时文件统一由 finally 清理（成功/失败共用同一路径）
      return options.outputPath
    } catch (error) {
      throw new Error(`导出失败: ${(error as Error).message}`)
    } finally {
      // 失败路径同样要清各阶段中间产物（normalizedEdges/concat/merged），
      // 否则残留文件会在 temp 目录越积越多
      const stageFiles: string[] = [...clipFiles, ...normalizedEdges]
      if (concatFilePath) stageFiles.push(concatFilePath)
      if (mergedPath) stageFiles.push(mergedPath)
      this.cleanupTempFiles(stageFiles)
    }
  }

  /**
   * 构建最终导出参数（execFile 参数数组，无需处理引号转义）
   */
  private buildFinalArgs(inputPath: string, outputPath: string, options: ExportOptions): string[] {
    const args: string[] = ['-i', inputPath]

    const hasBgm = !!(options.backgroundMusic && existsSync(options.backgroundMusic.path))

    // 添加背景音乐（如果有）
    if (hasBgm) {
      args.push('-i', options.backgroundMusic!.path)
    }

    // 视频编码设置
    args.push('-c:v', 'libx264')
    args.push('-preset', 'medium')
    args.push('-crf', '23')
    args.push('-s', `${options.resolution}x${Math.round((options.resolution * 9) / 16)}`) // 16:9 比例（宽 x 高）
    args.push('-r', String(options.fps))

    // 音频设置
    if (hasBgm) {
      // 混合音频：降低原视频音量，添加背景音乐
      const videoVolume = Math.max(0, 1 - options.backgroundMusic!.volume)
      args.push(
        '-filter_complex',
        `[0:a]volume=${videoVolume}[v0a];[1:a]volume=${options.backgroundMusic!.volume}[v1a];[v0a][v1a]amix=inputs=2:duration=first:dropout_transition=2[outa]`
      )
      args.push('-map', '0:v')
      args.push('-map', '[outa]')
    } else {
      args.push('-c:a', 'copy')
    }

    // 输出文件
    args.push('-y', outputPath)

    return args
  }

  /**
   * 清理临时文件
   */
  private cleanupTempFiles(files: string[]): void {
    for (const file of files) {
      try {
        if (existsSync(file)) {
          unlinkSync(file)
        }
      } catch (error) {
        console.warn(`清理临时文件失败: ${file}`, error)
      }
    }
  }

  /**
   * 获取视频信息（时长、分辨率等）
   * 注意：@ffmpeg-installer 只提供 ffmpeg 不含 ffprobe，
   * 因此改用 `ffmpeg -i` 并解析 stderr 中的媒体信息（跨平台兼容）
   */
  async getVideoInfo(videoPath: string): Promise<{
    duration: number
    width: number
    height: number
    fps: number
  }> {
    if (!existsSync(videoPath)) {
      throw new Error('视频文件不存在')
    }

    const ffmpeg = getFfmpegPath()

    // ffmpeg -i 无输出文件时会以非 0 退出码结束（"At least one output file must be specified"），
    // 但媒体信息已完整打印在 stderr 中，故 catch 中也要解析 stderr
    let stderr = ''
    try {
      const result = await execFileAsync(ffmpeg, ['-hide_banner', '-i', videoPath], {
        timeout: 30000
      })
      stderr = result.stderr
    } catch (error) {
      stderr = (error as { stderr?: string }).stderr || ''
    }

    if (!stderr) {
      console.error('获取视频信息失败: ffmpeg 无输出')
      return { duration: 0, width: 1920, height: 1080, fps: 30 }
    }

    // 解析时长: "Duration: 00:01:23.45"
    let duration = 0
    const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    if (durationMatch) {
      duration = Math.round(
        parseInt(durationMatch[1]) * 3600 +
          parseInt(durationMatch[2]) * 60 +
          parseFloat(durationMatch[3])
      )
    }

    // 解析分辨率: "Video: h264 ..., 1920x1080 [...]"（排除比特率等干扰，限定在 Video 流行内）
    let width = 1920
    let height = 1080
    const videoLineMatch = stderr.match(/Stream #.*Video:.*?(\d{2,5})x(\d{2,5})/)
    if (videoLineMatch) {
      width = parseInt(videoLineMatch[1])
      height = parseInt(videoLineMatch[2])
    }

    // 解析帧率: "30 fps" 或 "29.97 fps"
    let fps = 30
    const fpsMatch = stderr.match(/(\d+(?:\.\d+)?)\s*fps/)
    if (fpsMatch) {
      fps = Math.round(parseFloat(fpsMatch[1]))
    }

    return { duration, width, height, fps }
  }
}
