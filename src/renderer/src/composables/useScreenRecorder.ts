import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  recordingTime: number
  savePath: string | null
}

/** 供 RecordPage 在 startRecording 前注入的编码参数（来自录制设置） */
export interface RecorderOptions {
  /** 期望的 mimeType 候选（按序降级，isTypeSupported 探测） */
  mimeTypeCandidates?: string[]
  videoBitsPerSecond?: number
  audioBitsPerSecond?: number
}

// 检查窗口/API 是否可用
function isApiAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.api && !!window.api.screenRecorder
}

// ── 模块级单例状态 ──────────────────────────────────────────
// Layout / RecordPage 等多个组件共享同一份录制状态。
// 之前每个组件各自 useScreenRecorder() 产生独立 refs，导致
// 录制中 isRecording/recordingTime 在父组件恒为初始值（计时不动、
// 停止按钮不出现、暂停发到空实例）。所有 ref 只在这里创建一次。
const isRecording = ref(false)
const isPaused = ref(false)
const recordingTime = ref(0)
const savePath = ref<string | null>(null)
const loading = ref(false)
const currentRecordingId = ref<string | null>(null)

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
// 分片模式累计收到的字节数（数据流式写盘、不在内存驻留，finalize 用它上报文件大小）
let chunkedTotalBytes = 0
let recordingTimer: number | null = null
// 段起点累计（用于扣除 paused 时间）：
// - segmentStartTs：段开始时间戳（每次 start/resume 时记录）
// - accumulatedMs：累计的 committed 时长（每次 pause/stop 时把当前段时长加进去）
let segmentStartTs: number = 0
let accumulatedMs: number = 0

// 由 RecordPage 注入的编码参数（默认值兜底）
let recorderOptions: RecorderOptions = {}
// 分片写盘会话路径；null 表示本次录制未启用流式写盘（退回内存攒满一次性保存）
let chunkedWritePath: string | null = null
// 待 flush 的分片缓冲
let pendingChunk: Uint8Array | null = null
let pendingChunkSize = 0
const CHUNK_FLUSH_BYTES = 512 * 1024
const CHUNK_FLUSH_MS = 500
let chunkFlushTimer: number | null = null
let chunkWriteError: string | null = null

const canRecord = computed(() => {
  return !loading.value && !isRecording.value
})

/** 当前显示时间 = 累计 committed + 本段已录制（毫秒转秒，向下取整） */
const liveDurationMs = computed(() => {
  if (!isRecording.value) return 0
  if (isPaused.value) return accumulatedMs
  return accumulatedMs + (Date.now() - segmentStartTs)
})

/** 注入编码参数（RecordPage 从录制设置读取后调用） */
function setRecorderOptions(options: RecorderOptions): void {
  recorderOptions = options ?? {}
}

/** 把不含 .webm 后缀的保存路径强制补上（MediaRecorder 只产 webm 容器） */
function ensureWebmPath(path: string): string {
  return path.toLowerCase().endsWith('.webm') ? path : `${path}.webm`
}

// ── B8：新旧双轨归一（加法式） ──────────────────────────────
// 旧链路：screenRecorder.saveFile → JSON 历史（RecordingHistoryService，双写 SQLite）
// 新链路：recording.start / finalize → rec_recordings 表
// 录制开始时先走 recording.start 拿到正式 UUID，贯穿 segments/markers/finalize，
// 不再使用临时 ID（旧版临时 ID 与 UUID 并存，segments 挂在临时 ID 下无法关联）。
async function startNewRecording(fileName: string): Promise<string | null> {
  try {
    const api = window.api?.recording
    if (!api?.start) return null
    const res = await api.start({ fileName })
    return res?.recordingId ?? null
  } catch (error) {
    console.warn('[ScreenRecorder] 新通道登记失败（回退旧链路）:', error)
    return null
  }
}

async function finalizeNewRecording(fileSize: number): Promise<void> {
  try {
    const api = window.api?.recording
    if (!api?.finalize || !currentRecordingId.value) return
    await api.finalize({
      recordingId: currentRecordingId.value,
      finalFilePath: savePath.value ?? '',
      fileSize,
      durationMs: accumulatedMs
    })
  } catch (error) {
    console.warn('[ScreenRecorder] 新通道最终化失败:', error)
  }
}

// ── 分片流式写盘 ────────────────────────────────────────────
// 旧实现在 onstop 时把全部 chunks → Blob → arrayBuffer → Uint8Array → IPC →
// writeFileSync，长录制（2.5Mbps ≈ 1.1GB/小时）峰值同时驻留 4~5 份拷贝。
// 这里改为 ondataavailable 就分批 append 到主进程的 WriteStream，内存 O(1)。
// 会话必须在 mediaRecorder.start 之前建立（首个分片含 webm 头），
// 否则竞态下头部进内存、后续进磁盘 → 文件损坏。
async function startChunkedWrite(path: string): Promise<void> {
  if (!isApiAvailable()) return
  const api = window.api.screenRecorder as unknown as {
    beginWrite?: (path: string) => Promise<{ ok: boolean; error?: string }>
    appendChunk?: (path: string, chunk: Uint8Array) => Promise<{ ok: boolean }>
    endWrite?: (
      path: string,
      durationSeconds: number,
      recordingId?: string
    ) => Promise<{ success: boolean; filePath?: string; error?: string; historyId?: string }>
    abortWrite?: (path: string) => Promise<{ ok: boolean }>
  }
  if (!api.beginWrite || !api.appendChunk || !api.endWrite) return
  try {
    const r = await api.beginWrite(path)
    if (r?.ok) {
      chunkedWritePath = path
      chunkWriteError = null
      chunkApi = api
    } else {
      console.warn('[ScreenRecorder] beginWrite rejected，退回一次性保存:', r?.error)
    }
  } catch (e) {
    console.warn('[ScreenRecorder] beginWrite failed，退回一次性保存:', e)
  }
}

let chunkApi: {
  appendChunk?: (path: string, chunk: Uint8Array) => Promise<{ ok: boolean }>
  endWrite?: (
    path: string,
    durationSeconds: number,
    recordingId?: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  abortWrite?: (path: string) => Promise<{ ok: boolean }>
} | null = null

function flushPendingChunk(): void {
  if (chunkFlushTimer) {
    clearTimeout(chunkFlushTimer)
    chunkFlushTimer = null
  }
  if (!chunkedWritePath || !pendingChunk || pendingChunkSize === 0) return
  const path = chunkedWritePath
  const data = pendingChunk.subarray(0, pendingChunkSize)
  pendingChunk = null
  pendingChunkSize = 0
  if (!chunkApi?.appendChunk) return
  chunkApi
    .appendChunk(path, data)
    .then((r) => {
      if (!r?.ok) chunkWriteError = 'appendChunk failed'
    })
    .catch((e) => {
      console.warn('[ScreenRecorder] appendChunk failed:', e)
      chunkWriteError = String(e)
    })
}

function bufferChunk(data: Uint8Array): void {
  if (!chunkedWritePath) return
  if (!pendingChunk) {
    pendingChunk = new Uint8Array(Math.max(CHUNK_FLUSH_BYTES, data.length))
    pendingChunkSize = 0
  }
  if (pendingChunkSize + data.length > pendingChunk.length) {
    flushPendingChunk()
    pendingChunk = new Uint8Array(Math.max(CHUNK_FLUSH_BYTES, data.length))
    pendingChunkSize = 0
  }
  pendingChunk.set(data, pendingChunkSize)
  pendingChunkSize += data.length
  if (!chunkFlushTimer) {
    chunkFlushTimer = window.setTimeout(flushPendingChunk, CHUNK_FLUSH_MS)
  }
}

/** 开始录制。返回本次录制的正式 recordingId（新链路不可用时为本地临时 ID）。 */
const startRecording = async (
  stream: MediaStream,
  recordingId?: string
): Promise<string | null> => {
  if (isRecording.value) {
    return currentRecordingId.value
  }

  // 如果没有选择保存路径，使用默认路径（不弹窗）
  if (!savePath.value && isApiAvailable()) {
    const path = await window.api.screenRecorder.getDefaultSavePath()
    if (!path) {
      return null
    }
    savePath.value = path
  } else if (!savePath.value) {
    console.warn('[ScreenRecorder] API 不可用，无法获取默认路径')
    return null
  }
  // MediaRecorder 只产 webm 容器；用户通过旧入口选了 .mp4 后缀时补正，
  // 避免「webm 数据 + mp4 后缀」的假容器文件
  savePath.value = ensureWebmPath(savePath.value)

  try {
    recordedChunks = []
    chunkedTotalBytes = 0
    accumulatedMs = 0
    segmentStartTs = Date.now()
    isPaused.value = false
    chunkWriteError = null

    // mimeType：优先用设置注入的候选，按支持度降级；最后兜底裸 webm
    const candidates =
      recorderOptions.mimeTypeCandidates && recorderOptions.mimeTypeCandidates.length > 0
        ? recorderOptions.mimeTypeCandidates
        : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? 'video/webm'

    const options: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: recorderOptions.videoBitsPerSecond ?? 2500000,
      audioBitsPerSecond: recorderOptions.audioBitsPerSecond ?? 128000
    }

    // 先建立分片写盘会话（必须 await 完成后再 start recorder：
    // 首个分片包含 webm 头，竞态下头部进内存、后续进磁盘会导致文件损坏）
    await startChunkedWrite(savePath.value)

    mediaRecorder = new MediaRecorder(stream, options)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        if (chunkedWritePath) {
          // 分片模式：数据流式写盘，不在内存驻留（仅累计字节数供 finalize 上报）
          chunkedTotalBytes += event.data.size
          void event.data.arrayBuffer().then((ab) => bufferChunk(new Uint8Array(ab)))
        } else {
          // 一次性保存：内存攒满，onstop 统一构建 Blob
          recordedChunks.push(event.data)
        }
      }
    }

    mediaRecorder.onstop = async () => {
      // onstop 触发时若仍处于录制中（正常 stop），把最后一段累计进去
      if (isRecording.value && !isPaused.value) {
        accumulatedMs += Date.now() - segmentStartTs
      }

      // 分片模式下数据已流式写盘，跳过 Blob/arrayBuffer/Uint8Array 全量构建；
      // 一次性保存路径保持原逻辑（仅在内存攒满 chunks 时才构建 buffer）
      let buffer: Uint8Array | null = null
      let totalBytes = 0
      if (chunkedWritePath) {
        totalBytes = chunkedTotalBytes
      } else {
        const blob = new Blob(recordedChunks, { type: 'video/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        buffer = new Uint8Array(arrayBuffer)
        totalBytes = buffer.byteLength
      }

      // 秒 = 累计毫秒 / 1000，向下取整
      const totalSeconds = Math.floor(accumulatedMs / 1000)

      if (savePath.value && isApiAvailable()) {
        try {
          let result: {
            success: boolean
            filePath?: string
            error?: string
            historyId?: string
          }
          if (chunkedWritePath && chunkApi) {
            flushPendingChunk()
            // 等 IPC FIFO 保证在途 append 先于 endWrite 到达主进程后落地
            await new Promise((r) => setTimeout(r, 50))
            if (chunkWriteError) {
              // 写盘已坏：丢弃半截文件并结束会话，不写历史
              await chunkApi.abortWrite?.(chunkedWritePath)?.catch(() => {})
              chunkedWritePath = null
              result = { success: false, error: chunkWriteError }
            } else {
              result = (await chunkApi.endWrite?.(
                chunkedWritePath,
                totalSeconds,
                currentRecordingId.value || undefined
              )) ?? { success: false, error: 'endWrite unavailable' }
              chunkedWritePath = null
            }
          } else {
            result = await window.api.screenRecorder.saveFile(
              savePath.value,
              // 仅一次性保存路径会走到这里（chunkedWritePath 非空时 buffer 恒为 null）
              buffer!,
              totalSeconds,
              currentRecordingId.value || undefined
            )
          }
          if (result.success) {
            // 若主进程未回传最终路径，则用它修正本地 savePath，保证 finalize 拿到真实路径
            if (result.filePath) {
              savePath.value = result.filePath
            }
            void finalizeNewRecording(totalBytes)
            await window.api.notification.recording('stop', `录制已保存: ${savePath.value}`)
          } else {
            await window.api.notification.recording('error', `保存失败: ${result.error}`)
          }
        } catch (error) {
          console.error('保存文件失败:', error)
          chunkedWritePath = null
          await window.api.notification.recording('error', `保存失败: ${(error as Error).message}`)
        }
      } else {
        await window.api.notification.recording('stop', '录制已停止')
      }

      // 重置状态
      isRecording.value = false
      isPaused.value = false
      recordingTime.value = 0
      accumulatedMs = 0
      segmentStartTs = 0
      currentRecordingId.value = null
      if (recordingTimer) {
        clearInterval(recordingTimer)
        recordingTimer = null
      }
    }

    // 使用 timeslice 确保时间戳正确，100ms 收集一次数据
    mediaRecorder.start(100)
    isRecording.value = true
    recordingTime.value = 0

    // 先在新 SQLite 通道登记本次录制拿正式 UUID（失败回退本地临时 ID）
    const fileName = savePath.value.split(/[\\/]/).pop() || `recording-${Date.now()}.webm`
    const newId = await startNewRecording(fileName)
    if (recordingId) {
      currentRecordingId.value = recordingId
    } else if (newId) {
      currentRecordingId.value = newId
    } else {
      currentRecordingId.value = `recording-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    }

    // 显示开始录制通知
    window.api.notification.recording('start', '屏幕录制已开始')

    // 计时器每秒刷新显示（基于 liveDurationMs 计算秒数）
    recordingTimer = window.setInterval(() => {
      recordingTime.value = Math.floor(liveDurationMs.value / 1000)
    }, 1000)
    return currentRecordingId.value
  } catch (error) {
    console.error('开始录制失败:', error)
    // 会话可能已建立但 recorder 未跑起来：中止写盘避免主进程侧泄漏
    if (chunkedWritePath && chunkApi) {
      const p = chunkedWritePath
      chunkedWritePath = null
      void chunkApi.abortWrite?.(p)?.catch(() => {})
    }
    await window.api.notification.recording('error', `开始录制失败: ${(error as Error).message}`)
    throw error
  }
}

// 停止录制
const stopRecording = (): void => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
}

// 暂停录制
const pauseRecording = (): void => {
  if (!isRecording.value || isPaused.value) return
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  // 累计当前段时长
  accumulatedMs += Date.now() - segmentStartTs
  isPaused.value = true
  try {
    mediaRecorder.pause()
  } catch (e) {
    console.warn('[useScreenRecorder] MediaRecorder.pause() failed:', e)
  }
  // 通知主进程关闭当前段（写入 ended_at）
  if (currentRecordingId.value && isApiAvailable()) {
    const recApi = (
      window.api as unknown as {
        recording?: {
          segments?: { close?: (req: { recordingId: string }) => Promise<{ ok: boolean }> }
        }
      }
    ).recording
    if (recApi?.segments?.close) {
      recApi.segments.close({ recordingId: currentRecordingId.value }).catch((e: unknown) => {
        console.warn('[useScreenRecorder] segments.close failed:', e)
      })
    }
  }
}

// 恢复录制
const resumeRecording = (): void => {
  if (!isRecording.value || !isPaused.value) return
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  isPaused.value = false
  segmentStartTs = Date.now() // 重置本段起点
  try {
    mediaRecorder.resume()
  } catch (e) {
    console.warn('[useScreenRecorder] MediaRecorder.resume() failed:', e)
  }
  // 通知主进程打开新段
  if (currentRecordingId.value && isApiAvailable()) {
    const recApi = (
      window.api as unknown as {
        recording?: {
          segments?: { open?: (req: { recordingId: string }) => Promise<{ ok: boolean }> }
        }
      }
    ).recording
    if (recApi?.segments?.open) {
      recApi.segments.open({ recordingId: currentRecordingId.value }).catch((e: unknown) => {
        console.warn('[useScreenRecorder] segments.open failed:', e)
      })
    }
  }
}

// 切换暂停/恢复
const togglePause = (): void => {
  if (isPaused.value) resumeRecording()
  else pauseRecording()
}

// 选择保存路径
const selectSavePath = async (): Promise<string | null> => {
  if (!isApiAvailable()) return null
  const path = await window.api.screenRecorder.selectSavePath()
  if (path) {
    savePath.value = ensureWebmPath(path)
  }
  return savePath.value
}

// 格式化时间
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 活跃消费者计数（Layout + RecordPage 共享模块级单例状态，见 useScreenRecorder）
let mountedConsumers = 0

// 清理资源
const cleanup = (): void => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  // 分片会话仍活跃时保留在途缓冲：stop() 触发的 onstop 还要 flush + endWrite
  if (!chunkedWritePath) {
    if (chunkFlushTimer) {
      clearTimeout(chunkFlushTimer)
      chunkFlushTimer = null
    }
    pendingChunk = null
    pendingChunkSize = 0
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  recordedChunks = []
  chunkedTotalBytes = 0
  isRecording.value = false
  isPaused.value = false
  accumulatedMs = 0
  segmentStartTs = 0
}

/** useScreenRecorder 返回结构 */
export interface ScreenRecorderComposable {
  isRecording: Ref<boolean>
  isPaused: Ref<boolean>
  recordingTime: Ref<number>
  savePath: Ref<string | null>
  loading: Ref<boolean>
  canRecord: ComputedRef<boolean>
  currentRecordingId: Ref<string | null>
  setRecorderOptions: (options: RecorderOptions) => void
  startRecording: (stream: MediaStream, recordingId?: string) => Promise<string | null>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  togglePause: () => void
  selectSavePath: () => Promise<string | null>
  formatTime: (seconds: number) => string
  cleanup: () => void
}

export function useScreenRecorder(): ScreenRecorderComposable {
  // 状态是模块级单例，多个组件（Layout + RecordPage）共享。清理按引用计数：
  // RecordPage 切到 history 标签卸载时 Layout 仍在用（录制不能被打断），
  // 只有最后一个消费者卸载（离开 screenRecorder 模块）才执行 cleanup
  mountedConsumers += 1
  onUnmounted(() => {
    mountedConsumers = Math.max(0, mountedConsumers - 1)
    if (mountedConsumers === 0) cleanup()
  })
  return {
    isRecording,
    isPaused,
    recordingTime,
    savePath,
    loading,
    canRecord,
    currentRecordingId,
    setRecorderOptions,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    togglePause,
    selectSavePath,
    formatTime,
    cleanup
  }
}

