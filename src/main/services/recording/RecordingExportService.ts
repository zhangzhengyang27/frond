/**
 * Leaf · RecordingExportService
 *
 * 职责：单录制文件转码（mp4/webm → mp4/webm）+ 进度推送。
 *
 * 与 ClipService.exportClips 的区别：
 *  - ClipService 处理"多个剪辑片段拼接 + 片头片尾 + 背景音乐 + 转场"
 *  - 本服务处理"单录制文件格式/分辨率/码率转码"
 *
 * 设计：
 *  - ffmpeg 通过 child_process.spawn 启动，stderr 解析 `time=HH:MM:SS.MS` 算进度
 *  - 进度通过 callback 推送，单录制 → renderer 弹 ExportProgressDialog
 *  - 取消：通过 AbortController 中断 child_process
 *  - 转码完成后可选择把 rec_recordings.file_path 更新到新路径（不更新即「保留原档」）
 */

import { spawn } from 'child_process'
import { existsSync, statSync } from 'fs'
import {
  getFfmpegPath,
  probeMediaInfo,
  probeDurationSec,
  createStderrTail,
  killFfmpegProcess,
  xfadeSupportedAsync
} from '../../utils/ffmpeg'

export type ExportFormat = 'mp4' | 'webm' | 'gif'
export type ExportResolution = 720 | 1080 | 1440 | 2160
export type ExportFps = 30 | 60
export type ExportTransition = 'fade' | 'cut' | 'slide'
export type GifPreset = 'compact' | 'standard' | 'high'

export interface RecordingExportOptions {
  /** 原录制文件路径 */
  sourcePath: string
  /** 目标路径（不含后缀则按 format 自动补） */
  outputPath: string
  /** 输出格式 */
  format: ExportFormat
  /** 目标短边分辨率（高度），宽度按源宽高比自动 */
  resolution: ExportResolution
  fps: ExportFps
  /** 视频码率（kbps）。未指定走预设 */
  videoBitrateKbps?: number
  /** 音频码率（kbps）。默认 128 */
  audioBitrateKbps?: number
  // PR-6: 片头片尾
  introPath?: string
  outroPath?: string
  /**
   * PR-6: 转场。**仅在同时存在 intro/outro 时生效**：
   *   - 'fade':  前后片段与片头/片尾之间用 fade 黑场（afade+xfade）
   *   - 'cut':   直接硬切（默认）
   *   - 'slide': 横向滑动过渡（仅横向拼接）
   * 单条录制无 intro/outro 时忽略。
   */
  transition?: ExportTransition
  // PR-6: 背景音乐（与主音频 amix 叠加）
  backgroundMusic?: {
    path: string
    /** 音量 0..1（线性）。默认 0.5 */
    volume?: number
  }
  /**
   * PR-6: 音频淡入淡出时长（秒）。应用到主音频 + BGM（若 BGM 长于视频则会循环/截断到视频末端）。
   * 默认 0（不淡）。建议 0.5 ~ 2 秒。
   */
  fadeDurationSec?: number
  // PR-7c: GIF 档位（仅当 format='gif' 时生效）
  gifPreset?: GifPreset
}

export interface ExportProgress {
  percent: number
  message: string
  /** 当前已耗时（微秒）- 来自 ffmpeg time= */
  currentTimeSec?: number
}

export type ExportProgressCallback = (p: ExportProgress) => void

export interface ExportResult {
  ok: true
  outputPath: string
  fileSize: number
}

export interface ExportFailure {
  ok: false
  error: string
}

export class RecordingExportService {
  private activeChild: ReturnType<typeof spawn> | null = null

  /**
   * 同步探测源文件时长（秒）。用 ffmpeg 解析 container 元数据。
   * 若获取失败返回 null，进度将只能按"瞬时已写入字节"估算。
   */
  async probeDurationSec(sourcePath: string): Promise<number | null> {
    return probeDurationSec(sourcePath)
  }

  /**
   * 启动导出。
   * AbortSignal 可选：传入 ctor 内部的 AbortController 即可取消。
   */
  async export(
    options: RecordingExportOptions,
    onProgress: ExportProgressCallback,
    abortSignal?: AbortSignal
  ): Promise<ExportResult | ExportFailure> {
    if (!existsSync(options.sourcePath)) {
      return { ok: false, error: 'source file not found' }
    }
    const outputPath = ensureExtension(options.outputPath, options.format)
    if (outputPath === options.sourcePath) {
      return { ok: false, error: 'outputPath must differ from sourcePath' }
    }

    // PR-7c: GIF 走 GifEncoderService（双阶段 ffmpeg palettegen/paletteuse）
    if (options.format === 'gif') {
      const { gifEncoderService } = await import('./GifEncoderService')
      const r = await gifEncoderService.encode(
        {
          sourcePath: options.sourcePath,
          outputPath,
          preset: options.gifPreset ?? 'standard'
        },
        onProgress,
        abortSignal
      )
      if (r.ok) return { ok: true, outputPath: r.outputPath, fileSize: r.fileSize }
      return { ok: false, error: r.error }
    }

    const ffmpeg = getFfmpegPath()
    const hasIntro = !!options.introPath && existsSync(options.introPath)
    const hasOutro = !!options.outroPath && existsSync(options.outroPath)
    const hasBgm = !!options.backgroundMusic?.path && existsSync(options.backgroundMusic.path)
    const transition = options.transition ?? 'cut'
    const fadeSec = clampNonNeg(options.fadeDurationSec ?? 0)

    // 先探测各输入的时长/音轨情况：xfade offset、afade out 起点、BGM 循环长度、
    // 无音轨输入的静音替代都依赖这些数据（旧实现在构建参数之后才探测，
    // 且所有 filter 都假设输入有音轨 → 静音录制的复杂导出直接失败）
    const [srcInfo, introInfo, outroInfo] = await Promise.all([
      probeMediaInfo(options.sourcePath),
      hasIntro ? probeMediaInfo(options.introPath!) : Promise.resolve(null),
      hasOutro ? probeMediaInfo(options.outroPath!) : Promise.resolve(null)
    ])

    // intro/outro 缺音轨时需要用 anullsrc 替代等长静音；若连时长都探测不到，
    // 无法构造等长静音 → 降级为忽略该段（否则 concat 音频远短于视频，-shortest
    // 会把成片截断到静音长度）
    let hasIntroEff = hasIntro
    let hasOutroEff = hasOutro
    if (hasIntro && !introInfo?.hasAudio && introInfo?.durationSec == null) {
      console.warn('[RecordingExportService] intro 缺少音轨且时长不可探测，已忽略 intro')
      hasIntroEff = false
    }
    if (hasOutro && !outroInfo?.hasAudio && outroInfo?.durationSec == null) {
      console.warn('[RecordingExportService] outro 缺少音轨且时长不可探测，已忽略 outro')
      hasOutroEff = false
    }

    // 转场仅在 intro/outro 组合 + 各段时长可探测 + ffmpeg 支持 xfade 时生效
    // （xfade offset 必须知道前段时长；捆绑的 @ffmpeg-installer 是 pre-4.3
    // 构建没有 xfade，此时降级为硬切而不是让导出直接失败）
    const durationsKnown =
      srcInfo.durationSec !== null &&
      (!hasIntroEff || (introInfo?.durationSec ?? 0) > 0) &&
      (!hasOutroEff || (outroInfo?.durationSec ?? 0) > 0)
    const applyTransition =
      transition !== 'cut' &&
      (hasIntroEff || hasOutroEff) &&
      durationsKnown &&
      (await xfadeSupportedAsync())

    // 两路径：complex（intro/outro/bgm/transition）走 concat+amix；simple 走单一 ffmpeg。
    // 例外：源无音轨且时长不可探测时无法构造等长静音，强制走 simple
    const complexPossible = !(!srcInfo.hasAudio && srcInfo.durationSec == null)
    const useComplex =
      (hasIntroEff || hasOutroEff || hasBgm || transition !== 'cut') && complexPossible

    let args: string[]
    if (useComplex) {
      args = buildComplexExportArgs({
        source: options.sourcePath,
        hasIntro: hasIntroEff,
        intro: options.introPath,
        hasOutro: hasOutroEff,
        outro: options.outroPath,
        hasBgm,
        bgm: options.backgroundMusic?.path,
        bgmVolume: options.backgroundMusic?.volume,
        transition,
        applyTransition,
        format: options.format,
        resolution: options.resolution,
        fps: options.fps,
        videoBitrateKbps: options.videoBitrateKbps,
        audioBitrateKbps: options.audioBitrateKbps,
        fadeSec,
        outputPath,
        durations: {
          source: srcInfo.durationSec,
          intro: hasIntroEff ? (introInfo?.durationSec ?? null) : null,
          outro: hasOutroEff ? (outroInfo?.durationSec ?? null) : null
        },
        hasAudio: {
          source: srcInfo.hasAudio,
          intro: hasIntroEff ? (introInfo?.hasAudio ?? false) : false,
          outro: hasOutroEff ? (outroInfo?.hasAudio ?? false) : false
        }
      })
    } else {
      args = buildSimpleExportArgs(options)
    }

    const totalSec = srcInfo.durationSec
    onProgress({ percent: 0, message: useComplex ? '合成中…' : '开始转码…' })

    const result = await new Promise<ExportResult | ExportFailure>((resolve) => {
      const child = spawn(ffmpeg, args)
      this.activeChild = child
      const stderrTail = createStderrTail()
      let lastPercent = 0

      child.stderr.on('data', (b: Buffer) => {
        const chunk = b.toString()
        stderrTail.push(chunk)
        const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(chunk)
        if (m && totalSec && totalSec > 0) {
          const cur = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
          const percent = Math.min(99, Math.floor((cur / totalSec) * 100))
          if (percent > lastPercent) {
            lastPercent = percent
            onProgress({
              percent,
              message: useComplex ? `合成中 ${percent}%` : `转码中 ${percent}%`,
              currentTimeSec: cur
            })
          }
        }
      })

      child.on('close', (code) => {
        this.activeChild = null
        if (code === 0 && existsSync(outputPath)) {
          try {
            const stat = statSync(outputPath)
            onProgress({ percent: 100, message: '导出完成' })
            resolve({ ok: true, outputPath, fileSize: stat.size })
          } catch (e) {
            resolve({ ok: false, error: `stat failed: ${(e as Error).message}` })
          }
        } else {
          resolve({ ok: false, error: `ffmpeg exited ${code}\n${stderrTail.tail()}` })
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

    return result
  }

  cancel(): void {
    if (this.activeChild) {
      killFfmpegProcess(this.activeChild)
      this.activeChild = null
    }
  }
}

function ensureExtension(path: string, format: ExportFormat): string {
  if (path.toLowerCase().endsWith(`.${format}`)) return path
  const base = path.replace(/\.[^.]+$/, '')
  return `${base}.${format}`
}

/**
 * PR-6: pure helper — 把非负数裁剪到 [0, 60] 范围（5 分钟淡入太夸张）
 */
function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 60) return 60
  return n
}

/**
 * PR-6: pure helper — 单录制快速转码（无 intro/outro/bgm/transitions）。
 * 与旧 buildFfmpegArgs 行为一致。
 */
export function buildSimpleExportArgs(opts: RecordingExportOptions): string[] {
  const args: string[] = ['-y', '-i', opts.sourcePath]
  // 视频编码：mp4 → h264, webm → vp9
  if (opts.format === 'mp4') {
    args.push('-c:v', 'libx264', '-preset', 'fast')
  } else {
    args.push('-c:v', 'libvpx-vp9')
  }
  // 缩放（保持 source 宽高比，按高度归一）
  const h = opts.resolution
  args.push('-vf', `scale=-2:${h}`)
  // 帧率
  args.push('-r', String(opts.fps))
  // 码率
  args.push('-b:v', `${opts.videoBitrateKbps ?? defaultVideoBitrate(opts.resolution)}k`)
  // 音频
  args.push('-c:a', opts.format === 'mp4' ? 'aac' : 'libopus')
  args.push('-b:a', `${opts.audioBitrateKbps ?? 128}k`)
  // 输出
  args.push(opts.outputPath)
  return args
}

/**
 * PR-6: complex export — 支持 intro/outro 拼接 + BGM 叠加 + transition。
 *
 * filter_complex 结构：
 *   视频：各输入统一 scale/fps → concat 或 xfade 串联
 *   音频：各输入 aresample=44100（无音轨输入用 anullsrc 静音替代）
 *         → concat / acrossfade → 与 BGM amix
 *
 * 关键约束（旧实现的四个 bug 都在这条链上）：
 *   - xfade offset 必须是「前段时长 - 转场时长」，offset=0 会把片头整段跳过
 *   - BGM 无限循环后必须 atrim 到成片时长，atrim=duration=0 会把 BGM 剪成空流
 *   - afade out 的 st 必须是「段时长 - 淡出时长」，st=0 等于把淡出加在开头
 *   - 静音录制的源没有 [0:a]，直接引用会让 filter_complex 建图失败
 */
interface ComplexArgs {
  source: string
  hasIntro: boolean
  intro?: string
  hasOutro: boolean
  outro?: string
  hasBgm: boolean
  bgm?: string
  bgmVolume?: number
  transition: ExportTransition
  applyTransition: boolean
  format: ExportFormat
  resolution: ExportResolution
  fps: ExportFps
  videoBitrateKbps?: number
  audioBitrateKbps?: number
  fadeSec: number
  outputPath: string
  /** 各输入时长（秒）。xfade offset / 静音替代 trim / BGM 循环长度依赖 */
  durations: { source: number | null; intro: number | null; outro: number | null }
  /** 各输入是否含音轨 */
  hasAudio: { source: boolean; intro: boolean; outro: boolean }
}

export function buildComplexExportArgs(c: ComplexArgs): string[] {
  const XFADE_DUR = 0.5
  const args: string[] = ['-y']
  // 输入顺序按 push 顺序动态分配索引（旧实现硬编码 intro=1/outro=2/bgm=3，
  // 只有 outro 或只有 bgm 时会引用不存在的输入索引）
  args.push('-i', c.source)
  if (c.hasIntro) args.push('-i', c.intro!)
  if (c.hasOutro) args.push('-i', c.outro!)
  if (c.hasBgm) args.push('-i', c.bgm!)
  let nextIdx = 1
  const idxSrc = 0
  const idxIntro = c.hasIntro ? nextIdx++ : -1
  const idxOutro = c.hasOutro ? nextIdx++ : -1
  const idxBgm = c.hasBgm ? nextIdx++ : -1

  const silentSegCount =
    (!c.hasAudio.source ? 1 : 0) +
    (c.hasIntro && !c.hasAudio.intro ? 1 : 0) +
    (c.hasOutro && !c.hasAudio.outro ? 1 : 0)
  const silenceIdx = silentSegCount > 0 ? nextIdx++ : -1
  if (silenceIdx >= 0) {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')
  }

  const fps = String(c.fps)
  const vbr = `${c.videoBitrateKbps ?? defaultVideoBitrate(c.resolution)}k`
  const abr = `${c.audioBitrateKbps ?? 128}k`
  const scale = `scale=-2:${c.resolution},fps=${c.fps},format=yuv420p`

  // ── 视频链 ──────────────────────────────────────────────
  const videoLabels: string[] = []
  let chain = ''
  if (c.hasIntro) {
    chain += `[${idxIntro}:v]${scale}[v1];`
    videoLabels.push('v1')
  }
  chain += `[${idxSrc}:v]${scale}[v0];`
  videoLabels.push('v0')
  if (c.hasOutro) {
    chain += `[${idxOutro}:v]${scale}[v2];`
    videoLabels.push('v2')
  }

  // ── 音频链：为每个视频输入生成对应音频段 ────────────────
  // 静音源被多个段引用时需要 asplit 扇出（ffmpeg 不允许同一输入流多次消费）
  if (silenceIdx >= 0 && silentSegCount > 1) {
    const labels = Array.from({ length: silentSegCount }, (_, i) => `[sil${i}]`).join('')
    chain += `[${silenceIdx}:a]asplit=${silentSegCount}${labels};`
  }
  let nextSil = 0
  const takeSilenceLabel = (): string =>
    silentSegCount > 1 ? `[sil${nextSil++}]` : `[${silenceIdx}:a]`
  const audioSeg = (
    inputIdx: number,
    has: boolean,
    dur: number | null,
    label: string,
    extra = ''
  ): void => {
    if (has) {
      chain += `[${inputIdx}:a]aresample=44100${extra}[${label}];`
    } else {
      // 无音轨输入：从静音源 trim 出等长静音（保证 concat/xfade 的时间对齐）
      const d = Math.max(dur ?? 0, 0.04)
      chain += `${takeSilenceLabel()}atrim=duration=${d.toFixed(3)},aresample=44100[${label}];`
    }
  }
  // 主音频淡入；淡出起点 = 段尾（旧实现 st=0 把淡出加在了开头）
  const srcDur = c.durations.source
  const srcExtra = c.fadeSec
    ? `,afade=t=in:st=0:d=${c.fadeSec}` +
      (srcDur && srcDur > c.fadeSec
        ? `,afade=t=out:st=${Math.max(0, srcDur - c.fadeSec).toFixed(3)}:d=${c.fadeSec}`
        : '')
    : ''
  if (c.hasIntro) audioSeg(idxIntro, c.hasAudio.intro, c.durations.intro, 'a1')
  audioSeg(idxSrc, c.hasAudio.source, srcDur, 'a0', srcExtra)
  if (c.hasOutro) audioSeg(idxOutro, c.hasAudio.outro, c.durations.outro, 'a2')

  // ── concat / xfade ─────────────────────────────────────
  // 成片音频总时长（BGM 循环长度、afade 依据）
  const segDur = (d: number | null): number => d ?? 0
  let outAudioDur: number | null
  if (c.durations.source === null) {
    outAudioDur = null
  } else {
    let total = segDur(c.durations.source)
    if (c.hasIntro) total += segDur(c.durations.intro)
    if (c.hasOutro) total += segDur(c.durations.outro)
    if (c.applyTransition) {
      const nTrans = (c.hasIntro ? 1 : 0) + (c.hasOutro ? 1 : 0)
      total = Math.max(0.5, total - nTrans * XFADE_DUR)
    }
    outAudioDur = total
  }

  let vOut = '[vconcat]'
  let aOut = '[aconcat]'
  if (c.applyTransition) {
    // xfade：offset = 前段累计时长 - 转场时长（offset=0 会把前段整段跳过）
    let accDur = 0
    if (c.hasIntro && c.hasOutro) {
      const off1 = Math.max(0.04, segDur(c.durations.intro) - XFADE_DUR)
      chain += `[v1][v0]xfade=transition=fade:duration=${XFADE_DUR}:offset=${off1.toFixed(3)}[f01];`
      chain += `[a1][a0]acrossfade=d=${XFADE_DUR}[af01];`
      accDur = off1 + XFADE_DUR + segDur(srcDur) - XFADE_DUR
      const off2 = Math.max(0.04, accDur - XFADE_DUR)
      chain += `[f01][v2]xfade=transition=fade:duration=${XFADE_DUR}:offset=${off2.toFixed(3)}[f012];`
      chain += `[af01][a2]acrossfade=d=${XFADE_DUR}[af012];`
      vOut = '[f012]'
      aOut = '[af012]'
    } else if (c.hasIntro) {
      const off1 = Math.max(0.04, segDur(c.durations.intro) - XFADE_DUR)
      chain += `[v1][v0]xfade=transition=fade:duration=${XFADE_DUR}:offset=${off1.toFixed(3)}[f01];`
      chain += `[a1][a0]acrossfade=d=${XFADE_DUR}[af01];`
      vOut = '[f01]'
      aOut = '[af01]'
    } else if (c.hasOutro) {
      const off = Math.max(0.04, segDur(srcDur) - XFADE_DUR)
      chain += `[v0][v2]xfade=transition=fade:duration=${XFADE_DUR}:offset=${off.toFixed(3)}[f02];`
      chain += `[a0][a2]acrossfade=d=${XFADE_DUR}[af02];`
      vOut = '[f02]'
      aOut = '[af02]'
    }
  } else {
    chain += `${videoLabels.map((l) => `[${l}]`).join('')}concat=n=${videoLabels.length}:v=1:a=0[vconcat];`
    const audioLabels: string[] = []
    if (c.hasIntro) audioLabels.push('a1')
    audioLabels.push('a0')
    if (c.hasOutro) audioLabels.push('a2')
    chain += `${audioLabels.map((l) => `[${l}]`).join('')}concat=n=${audioLabels.length}:v=0:a=1[aconcat];`
  }

  // ── BGM 叠加 ────────────────────────────────────────────
  if (c.hasBgm) {
    const volume = clamp01(c.bgmVolume ?? 0.5)
    // 循环铺满成片时长；成片时长未知时退化为单次播放（-shortest 截断）。
    // 只消费一个副本，无需 asplit（多余输出 pad 未连接会让建图失败）
    const loopTail =
      outAudioDur !== null ? `,aloop=loop=-1:size=2e9,atrim=duration=${outAudioDur.toFixed(3)}` : ''
    chain += `[${idxBgm}:a]aresample=44100,volume=${volume}${loopTail}[bgm_l];`
    chain += `${aOut}[bgm_l]amix=inputs=2:duration=first:dropout_transition=0[mix];`
    aOut = '[mix]'
  }

  // 最终映射：-map 是 CLI 参数，绝不能拼进 filter_complex 字符串
  // （旧实现 `chain += '-map ...'` 让整个 complex 路径直接报 Invalid argument）
  args.push('-filter_complex', chain.replace(/;+$/, ''))
  args.push('-map', vOut, '-map', aOut)
  // 编码参数
  args.push('-c:v', c.format === 'mp4' ? 'libx264' : 'libvpx-vp9')
  // -preset 是 libx264 的选项；libvpx-vp9 没有该选项，传了 ffmpeg 直接报错
  if (c.format === 'mp4') args.push('-preset', 'fast')
  args.push('-b:v', vbr)
  args.push('-c:a', c.format === 'mp4' ? 'aac' : 'libopus')
  args.push('-b:a', abr)
  args.push('-r', fps)
  // xfade/concat 都需 shortest 停止
  args.push('-shortest')
  if (c.format === 'mp4') {
    args.push('-movflags', '+faststart')
  }
  args.push(c.outputPath)
  return args
}

/** clamp 0..1 */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function defaultVideoBitrate(res: ExportResolution): number {
  switch (res) {
    case 720:
      return 2000
    case 1080:
      return 5000
    case 1440:
      return 10000
    case 2160:
      return 20000
    default:
      // 非枚举分辨率兜底（旧实现返回 undefined → "undefinedk" 让 ffmpeg 报错）
      return 5000
  }
}
