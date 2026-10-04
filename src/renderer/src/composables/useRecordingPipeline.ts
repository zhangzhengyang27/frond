import type { Ref } from 'vue'
import type { CanvasSource, MediaStreamAudioTrackSource, Output } from 'mediabunny'

/**
 * WebCodecs/Mediabunny 录制管线（engine='webcodecs'）
 *
 * RECORDING_MEDIABUNNY_DESIGN.md P1：Canvas 合成帧逐帧喂 CanvasSource（await 背压），
 * 音频走 MediaStreamAudioTrackSource，封装 fragmented MP4 流式落盘（复用现有
 * beginWrite/appendChunk/endWrite 通道——fMP4 为 append-only，position 守卫防乱序）。
 * 与 P0 试点（scripts/mediabunny-pilot/）同构；mediabunny 惰性加载，旧引擎零影响。
 *
 * 单例录制状态（refs/时长账本）归 useScreenRecorder 门面所有，经 PipelineHost 注入，
 * 管线模块只持引擎自己的会话/暂停/区域快照。
 */

/** 供 RecordPage 在 startRecording 前注入的编码参数（来自录制设置） */
export interface RecorderOptions {
  /** 期望的 mimeType 候选（按序降级，isTypeSupported 探测）——仅 mediarecorder 引擎 */
  mimeTypeCandidates?: string[]
  videoBitsPerSecond?: number
  audioBitsPerSecond?: number
  /** 录制引擎（B57 根因① 治理，D6 特性开关）：缺省 'mediarecorder' 走旧链路 */
  engine?: 'mediarecorder' | 'webcodecs'
  /** webcodecs 引擎的视频编码器（mp4 容器）；缺省 avc */
  codec?: 'avc' | 'vp9'
  /** webcodecs 引擎的合成帧率；缺省 30 */
  fps?: number
  /** webcodecs 引擎的区域裁剪（屏幕 DIP 坐标）+ 所在显示器 scaleFactor；
   *  仅纯屏幕源（无摄像头）时传入——合成流路径的区域/画中画/光圈已在合成层绘制 */
  region?: { x: number; y: number; width: number; height: number } | null
  regionScale?: number
  /** webcodecs 引擎的光圈位置读取器（DIP）；配合 region 绘制 */
  getCursor?: (() => { x: number; y: number } | null) | null
}

/** 门面（useScreenRecorder）注入的共享状态访问器 */
export interface PipelineHost {
  isRecording: Ref<boolean>
  isPaused: Ref<boolean>
  recordingTime: Ref<number>
  savePath: Ref<string | null>
  currentRecordingId: Ref<string | null>
  getAccumulatedMs(): number
  /** 累计当前段（now - segmentStartTs）进 committed 时长 */
  commitSegment(): void
  resetTimeline(): void
  markSegmentStart(): void
  clearRecordingTimer(): void
  finalizeRecordingRow(fileSize: number): Promise<void>
  segmentIpc(kind: 'open' | 'close'): void
}

interface PipelineSession {
  output: Output
  canvasSource: CanvasSource
  audioSource: MediaStreamAudioTrackSource | null
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
  path: string
  stopped: boolean
  bytesWritten: () => number
  writeError: () => string | null
  loopDone: Promise<void>
}

let pipeline: PipelineSession | null = null
// 本次录制走的引擎（stop/pause/resume 分支依据；随 start 置位、收尾复位）
let pipelineEngine = false
// 管线暂停记账：暂停时刻（0=未暂停）与累计暂停时长（时间轴要剔除暂停段）
let pipelinePauseStartTs = 0
let pipelinePausedTotalMs = 0
// 管线帧循环的光标/区域快照（startRecording 时从 recorderOptions 固化）
let pipelineRegion: RecorderOptions['region'] = null
let pipelineRegionScale = 1
let pipelineGetCursor: RecorderOptions['getCursor'] = null
let pipelineFps = 30

/** fMP4 追加写桥：StreamTarget 的 WritableStream → appendChunk IPC。
 *  position 守卫：fMP4 是 append-only，mediabunny 给出的偏移必须严格递增，
 *  错位即抛错让 output.finalize() reject（收尾统一走 abortWrite 清场）。
 *  导出以便单测直接钉桥契约（useScreenRecorder.pipeline.test.ts）。 */
export function createPipelineWriteBridge(path: string): {
  writable: WritableStream<{ data: Uint8Array; position: number }>
  bytesWritten: () => number
  writeError: () => string | null
} {
  let expectedPos = 0
  let bytes = 0
  let error: string | null = null
  const writable = new WritableStream({
    async write(chunk: { data: Uint8Array; position: number }) {
      if (error) throw new Error(error)
      if (chunk.position !== expectedPos) {
        error = `fMP4 chunk offset mismatch: expected ${expectedPos}, got ${chunk.position}`
        throw new Error(error)
      }
      const r = await window.api.screenRecorder.appendChunk(path, chunk.data)
      if (!r?.ok) {
        error = 'appendChunk failed'
        throw new Error(error)
      }
      expectedPos += chunk.data.byteLength
      bytes += chunk.data.byteLength
    }
  })
  return { writable, bytesWritten: () => bytes, writeError: () => error }
}

/** 从注入的录制设置固化管线参数（engine=webcodecs 时由门面在 startRecording 调用） */
export function configurePipeline(opts: RecorderOptions): void {
  pipelineRegion = opts.region ?? null
  pipelineRegionScale = opts.regionScale ?? 1
  pipelineGetCursor = opts.getCursor ?? null
  pipelineFps = opts.fps === 60 ? 60 : 30
  pipelinePauseStartTs = 0
  pipelinePausedTotalMs = 0
}

export function pipelineEngineActive(): boolean {
  return pipelineEngine
}

export function hasActivePipelineSession(): boolean {
  return pipeline !== null
}

/** 管线的段开关通知主进程（与旧链路 pause/resume 的 segments IPC 语义一致） */
function segmentIpc(host: PipelineHost, kind: 'open' | 'close'): void {
  const recordingId = host.currentRecordingId.value
  if (!recordingId) return
  const recApi = (
    window as unknown as {
      recording?: {
        segments?: Record<
          'open' | 'close',
          (req: { recordingId: string }) => Promise<{ ok: boolean }>
        >
      }
    }
  ).recording
  recApi?.segments?.[kind]?.({ recordingId }).catch((e: unknown) => {
    console.warn(`[useRecordingPipeline] segments.${kind} failed:`, e)
  })
}

export async function startPipelineRecording(
  host: PipelineHost,
  stream: MediaStream,
  opts: RecorderOptions
): Promise<void> {
  const path = host.savePath.value!
  // beginWrite 必须先于 output.start（首块 ftyp 落盘前会话要已建立）
  const begin = await window.api.screenRecorder.beginWrite(path)
  if (!begin?.ok) {
    throw new Error(begin?.error ? `beginWrite rejected: ${begin.error}` : 'beginWrite rejected')
  }

  const mb = await import('mediabunny')
  const videoTrack = stream.getVideoTracks()[0]
  if (!videoTrack) throw new Error('录制流没有视频轨道')

  // 隐藏 video 承接源流，canvas 按区域/源分辨率定型（CanvasSource 默认拒绝中途变尺寸）
  const video = document.createElement('video')
  video.srcObject = new MediaStream([videoTrack])
  video.muted = true
  video.playsInline = true
  video.style.position = 'absolute'
  video.style.left = '-9999px'
  video.style.width = '1px'
  video.style.height = '1px'
  document.body.appendChild(video)
  try {
    await video.play()
  } catch {
    // 部分 WebView 首帧前 play() 可能 reject，readyState 轮询兜底
  }

  const canvas = document.createElement('canvas')
  if (pipelineRegion) {
    canvas.width = Math.max(2, Math.round(pipelineRegion.width * pipelineRegionScale))
    canvas.height = Math.max(2, Math.round(pipelineRegion.height * pipelineRegionScale))
  } else {
    // 等首帧就绪拿原生分辨率（最多 5s；拿不到退 1080p）
    for (let i = 0; i < 100 && video.videoWidth === 0; i++) {
      await new Promise((r) => setTimeout(r, 50))
    }
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 1080
  }

  const fps = pipelineFps
  const bridge = createPipelineWriteBridge(path)
  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: 'fragmented' }),
    target: new mb.StreamTarget(bridge.writable, {
      chunked: true,
      chunkSize: 512 * 1024
    })
  })

  const canvasSource = new mb.CanvasSource(canvas, {
    codec: opts.codec ?? 'avc',
    bitrate: new mb.Quality({ bitrate: opts.videoBitsPerSecond ?? 2500000 }),
    hardwareAcceleration: 'prefer-hardware',
    keyFrameInterval: 2
  })
  output.addVideoTrack(canvasSource, { frameRate: fps })

  const audioTrack = stream.getAudioTracks()[0]
  let audioSource: MediaStreamAudioTrackSource | null = null
  if (audioTrack) {
    audioSource = new mb.MediaStreamAudioTrackSource(audioTrack, {
      codec: 'opus',
      bitrate: new mb.Quality({ bitrate: opts.audioBitsPerSecond ?? 128000 })
    })
    output.addAudioTrack(audioSource)
  }

  await output.start()

  // 逐帧喂帧循环：await add() 传导编码背压（P0 实测零漂移的关键）。
  // 暂停 = 不出帧（时间轴冻结），resume 时补记 pipelinePausedTotalMs 把 wall
  // 回拨到 nextT 之前，恢复后无补帧爆发。循环闭包直接持有 session
  // （stopPipeline 会把模块级 pipeline 置 null，经模块变量判活会让循环退不出）。
  const frameDur = 1 / fps
  const t0 = performance.now()
  let frame = 0
  const ctx = canvas.getContext('2d')

  const session: PipelineSession = {
    output,
    canvasSource,
    audioSource,
    canvas,
    video,
    path,
    stopped: false,
    bytesWritten: bridge.bytesWritten,
    writeError: bridge.writeError,
    loopDone: Promise.resolve()
  }

  session.loopDone = (async () => {
    while (!session.stopped) {
      if (host.isPaused.value) {
        await new Promise((r) => setTimeout(r, 50))
        continue
      }
      const nextT = (frame + 1) * frameDur
      const wall = (performance.now() - t0 - pipelinePausedTotalMs) / 1000
      if (wall < nextT) {
        // 分片保眠：暂停/停止都要能及时唤醒
        await new Promise((r) => setTimeout(r, Math.min(100, (nextT - wall) * 1000)))
        continue
      }
      drawPipelineFrame(ctx, canvas, video)
      try {
        await canvasSource.add(nextT, frameDur)
      } catch (e) {
        console.warn('[useRecordingPipeline] canvasSource.add failed:', e)
        return // 写桥/编码器已坏，stopPipeline 的 finalize 会拿到错误
      }
      frame++
    }
  })()

  pipeline = session
  pipelineEngine = true
}

/** 管线帧绘制：区域裁剪（物理像素换算）+ 光圈；无区域时整帧贴绘 */
function drawPipelineFrame(
  ctx: CanvasRenderingContext2D | null,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement
): void {
  if (!ctx) return
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (video.videoWidth === 0 || video.videoHeight === 0) return

  if (pipelineRegion) {
    const scale = pipelineRegionScale
    const sx = Math.max(0, Math.round(pipelineRegion.x * scale))
    const sy = Math.max(0, Math.round(pipelineRegion.y * scale))
    const srcW = Math.max(
      2,
      Math.min(video.videoWidth - sx, Math.round(pipelineRegion.width * scale))
    )
    const srcH = Math.max(
      2,
      Math.min(video.videoHeight - sy, Math.round(pipelineRegion.height * scale))
    )
    ctx.drawImage(video, sx, sy, srcW, srcH, 0, 0, canvas.width, canvas.height)
    const cursor = pipelineGetCursor?.() ?? null
    if (cursor) {
      const cx = (cursor.x - pipelineRegion.x) * scale
      const cy = (cursor.y - pipelineRegion.y) * scale
      if (cx >= 0 && cx <= canvas.width && cy >= 0 && cy <= canvas.height) {
        ctx.beginPath()
        ctx.arc(cx, cy, 18, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 216, 59, 0.9)'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 216, 59, 1)'
        ctx.fill()
      }
    }
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }
}

export async function stopPipelineRecording(host: PipelineHost): Promise<void> {
  const s = pipeline
  pipeline = null
  pipelineEngine = false
  if (!s) return
  try {
    s.stopped = true
    await s.loopDone.catch(() => {})
    // 正常停止：把最后一段累计进时长（与旧链路 onstop 语义一致）
    if (!host.isPaused.value) {
      host.commitSegment()
    } else {
      pipelinePauseStartTs = 0
    }
    s.audioSource?.pause()
    const totalSeconds = Math.floor(host.getAccumulatedMs() / 1000)

    const err = s.writeError()
    if (err) {
      await window.api.screenRecorder.abortWrite?.(s.path)
      await window.api.notification.recording('error', `保存失败: ${err}`)
      return
    }
    // finalize 关闭 StreamTarget writer，等待全部在途 appendChunk 落盘后才 resolve
    // ——替代旧链路的 50ms FIFO 猜等，尾帧不丢
    await s.output.finalize()
    const result = await window.api.screenRecorder.endWrite(
      s.path,
      totalSeconds,
      host.currentRecordingId.value || undefined
    )
    if (result?.success) {
      if (result.filePath) host.savePath.value = result.filePath
      void host.finalizeRecordingRow(s.bytesWritten())
      await window.api.notification.recording('stop', `录制已保存: ${host.savePath.value}`)
    } else {
      await window.api.notification.recording(
        'error',
        `保存失败: ${result?.error ?? 'endWrite failed'}`
      )
    }
  } catch (error) {
    console.error('[useRecordingPipeline] 管线收尾失败:', error)
    try {
      await s.output.cancel()
    } catch {
      // cancel 失败不阻塞清场
    }
    try {
      await window.api.screenRecorder.abortWrite?.(s.path)
    } catch {
      // abort 失败不阻塞通知
    }
    await window.api.notification.recording('error', `保存失败: ${(error as Error).message}`)
  } finally {
    s.video.srcObject = null
    s.video.remove()
    s.canvas.width = 0
    s.canvas.height = 0
    pipelinePauseStartTs = 0
    pipelinePausedTotalMs = 0
    pipelineRegion = null
    pipelineGetCursor = null
    // 重置共享状态（与旧链路 onstop 尾部一致）
    host.isRecording.value = false
    host.isPaused.value = false
    host.recordingTime.value = 0
    host.resetTimeline()
    host.currentRecordingId.value = null
    host.savePath.value = null
    host.clearRecordingTimer()
  }
}

export function pausePipeline(host: PipelineHost): void {
  host.commitSegment()
  host.isPaused.value = true
  pipelinePauseStartTs = Date.now()
  pipeline?.audioSource?.pause()
  segmentIpc(host, 'close')
}

export function resumePipeline(host: PipelineHost): void {
  if (pipelinePauseStartTs) {
    pipelinePausedTotalMs += Date.now() - pipelinePauseStartTs
    pipelinePauseStartTs = 0
  }
  host.isPaused.value = false
  host.markSegmentStart()
  pipeline?.audioSource?.resume()
  segmentIpc(host, 'open')
}

/** startRecording 异常路径：beginWrite 会话已建但管线未跑起来 → 中止撤销授权 */
export async function abortPipelineStart(host: PipelineHost): Promise<void> {
  pipelineEngine = false
  const p = host.savePath.value
  try {
    if (p) await window.api.screenRecorder.abortWrite?.(p)
  } catch {
    // abort 失败不阻塞通知
  }
}
