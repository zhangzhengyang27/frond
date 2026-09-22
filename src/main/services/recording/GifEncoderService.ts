/**
 * Leaf · GifEncoderService（PR-7c）
 *
 * 职责：把 mp4/webm 录制成 GIF。
 *
 * 方案：两阶段 ffmpeg pipeline
 *   1. palettegen:  从源提取调色板（pal.png）
 *   2. paletteuse:  用调色板重编码为 GIF
 *
 * 档位预设（PR-7 设计稿）：
 *   - 'compact':  5 fps,  -vf scale=480:-1, palette=64  → 体积小
 *   - 'standard': 10 fps, -vf scale=720:-1, palette=128 → 平衡
 *   - 'high':     15 fps, -vf scale=960:-1, palette=256 → 质量高
 *
 * 设计：
 *  - 拆分为纯函数 buildGifArgs(source, output, preset) 便于单测
 *  - 进度解析依赖 sequence_pts/frame= 后面的 N/M 形式；GIF 编码时没有 time=，
 *    用 frame= 加上总帧数 totalFrames = ceil(duration * fps) 算百分比
 *  - 临时 palette 文件放在 app.getPath('temp')
 */

import { spawn } from 'child_process'
import { existsSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  getFfmpegPath,
  probeDurationSec,
  createStderrTail,
  killFfmpegProcess
} from '../../utils/ffmpeg'

export type GifPreset = 'compact' | 'standard' | 'high'

export interface GifPresetConfig {
  fps: number
  width: number
  paletteSize: number
}

export const GIF_PRESETS: Record<GifPreset, GifPresetConfig> = {
  compact: { fps: 5, width: 480, paletteSize: 64 },
  standard: { fps: 10, width: 720, paletteSize: 128 },
  high: { fps: 15, width: 960, paletteSize: 256 }
}

export interface GifEncodeOptions {
  sourcePath: string
  outputPath: string
  preset: GifPreset
}

export interface GifProgress {
  percent: number
  message: string
}

export type GifProgressCallback = (p: GifProgress) => void

export interface GifEncodeResult {
  ok: true
  outputPath: string
  fileSize: number
}

export interface GifEncodeFailure {
  ok: false
  error: string
}

export function buildGifArgs(
  opts: GifEncodeOptions,
  paletteDir: string = '/tmp'
): {
  stage1: string[]
  stage2: string[]
  palettePath: string
} {
  const cfg = GIF_PRESETS[opts.preset]
  const palettePath = join(paletteDir, `gif-palette-${Date.now()}.png`)
  // stage1: palettegen
  const stage1 = [
    '-y',
    '-i',
    opts.sourcePath,
    '-vf',
    `fps=${cfg.fps},scale=${cfg.width}:-1:flags=lanczos,palettegen=max_colors=${cfg.paletteSize}`,
    palettePath
  ]
  // stage2: paletteuse
  const stage2 = [
    '-y',
    '-i',
    opts.sourcePath,
    '-i',
    palettePath,
    '-lavfi',
    `fps=${cfg.fps},scale=${cfg.width}:-1:flags=lanczos [v]; [v][1:v] paletteuse=dither=sierra2_4a`,
    '-loop',
    '0',
    opts.outputPath
  ]
  return { stage1, stage2, palettePath }
}

export class GifEncoderService {
  private activeChild: ReturnType<typeof spawn> | null = null

  async probeFrames(sourcePath: string, fps: number): Promise<number | null> {
    const sec = await probeDurationSec(sourcePath)
    if (sec == null) return null
    return Math.ceil(sec * fps)
  }

  async encode(
    options: GifEncodeOptions,
    onProgress: GifProgressCallback,
    abortSignal?: AbortSignal
  ): Promise<GifEncodeResult | GifEncodeFailure> {
    if (!existsSync(options.sourcePath)) {
      return { ok: false, error: 'source file not found' }
    }
    const cfg = GIF_PRESETS[options.preset]
    const totalFrames = await this.probeFrames(options.sourcePath, cfg.fps)
    const { stage1, stage2, palettePath } = buildGifArgs(options, app.getPath('temp'))
    const ffmpeg = getFfmpegPath()

    onProgress({ percent: 0, message: '正在生成调色板…' })
    const stage1Result = await this.runStage(
      ffmpeg,
      stage1,
      totalFrames,
      onProgress,
      'palettegen',
      abortSignal
    )
    if (!stage1Result.ok) {
      try {
        unlinkSync(palettePath)
      } catch {
        /* 已不存在则忽略 */
      }
      return stage1Result
    }

    onProgress({ percent: 50, message: '正在编码 GIF…' })
    const stage2Result = await this.runStage(
      ffmpeg,
      stage2,
      totalFrames,
      onProgress,
      'paletteuse',
      abortSignal,
      50
    )
    // 清理 palette
    try {
      unlinkSync(palettePath)
    } catch {
      /* 已不存在则忽略 */
    }

    if (!stage2Result.ok) return stage2Result

    if (!existsSync(options.outputPath)) {
      return { ok: false, error: 'output file not created' }
    }
    const stat = statSync(options.outputPath)
    onProgress({ percent: 100, message: 'GIF 完成' })
    return { ok: true, outputPath: options.outputPath, fileSize: stat.size }
  }

  private runStage(
    ffmpeg: string,
    args: string[],
    totalFrames: number | null,
    onProgress: GifProgressCallback,
    stage: 'palettegen' | 'paletteuse',
    abortSignal: AbortSignal | undefined,
    basePercent: number = 0
  ): Promise<GifEncodeResult | GifEncodeFailure> {
    return new Promise((resolve) => {
      const child = spawn(ffmpeg, args)
      this.activeChild = child
      const stderrTail = createStderrTail()
      let lastPercent = 0
      child.stderr.on('data', (b: Buffer) => {
        const chunk = b.toString()
        stderrTail.push(chunk)
        // 优先用 frame= 形式（paletteuse 阶段输出）
        const frameMatch = /frame=\s*(\d+)/.exec(chunk)
        if (frameMatch && totalFrames && totalFrames > 0) {
          const f = Number(frameMatch[1])
          const pct = Math.min(99, Math.floor((f / totalFrames) * 100))
          if (pct > lastPercent) {
            lastPercent = pct
            const stagePct = Math.floor(
              basePercent + (pct / 100) * (stage === 'palettegen' ? 50 : 50)
            )
            onProgress({
              percent: stagePct,
              message: stage === 'palettegen' ? `调色板 ${pct}%` : `GIF ${pct}%`
            })
          }
        }
      })
      child.on('close', (code) => {
        this.activeChild = null
        if (code === 0) {
          resolve({ ok: true, outputPath: '', fileSize: 0 })
        } else {
          resolve({ ok: false, error: `ffmpeg(${stage}) exited ${code}\n${stderrTail.tail()}` })
        }
      })
      child.on('error', (err) => {
        this.activeChild = null
        resolve({ ok: false, error: `spawn failed: ${err.message}` })
      })
      if (abortSignal) {
        if (abortSignal.aborted) {
          killFfmpegProcess(child)
        } else {
          abortSignal.addEventListener('abort', () => killFfmpegProcess(child), {
            once: true
          })
        }
      }
    })
  }

  cancel(): void {
    if (this.activeChild) {
      killFfmpegProcess(this.activeChild)
      this.activeChild = null
    }
  }
}

export const gifEncoderService = new GifEncoderService()
