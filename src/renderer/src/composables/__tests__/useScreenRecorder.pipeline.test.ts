// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScreenRecorder } from '../useScreenRecorder'

/**
 * P1 管线分支回归钉（RECORDING_MEDIABUNNY_DESIGN.md，engine='webcodecs'）：
 *  1. 引擎选择：webcodecs → mediabunny Output(fastStart:'fragmented') + mp4 路径签发，
 *     不创建 MediaRecorder；缺省 → 旧链路，mediabunny 零调用
 *  2. 逐帧 add：时间戳递增、await 背压
 *  3. 暂停：音频采样 pause + 时间轴冻结（add 停止推进）
 *  4. 停止：finalize → endWrite(duration, recordingId) → recording.finalize → 通知
 *  5. 写桥 position 守卫：错位即抛错，收尾走 abortWrite + error 通知
 * 真实 mediabunny 行为已在 P0 试点（scripts/mediabunny-pilot/）真机验证，
 * 此处用 fake 锁定「渲染端胶水」的接线契约。
 */

const fakeStream = {
  getVideoTracks: () => [{ readyState: 'live' }],
  getAudioTracks: () => []
} as unknown as MediaStream

// ── mediabunny fake ─────────────────────────────────────────
const mbFakes = vi.hoisted(() => {
  const calls = {
    outputConstructed: [] as Array<{ fastStart?: string | undefined; hasTarget: boolean }>,
    addVideoTrack: [] as Array<{ frameRate?: number | undefined; sourceKind: string }>,
    addAudioTrack: [] as Array<{ sourceKind: string }>,
    started: 0,
    finalized: 0,
    canceled: 0,
    canvasAdds: [] as Array<{ t: number; dur: number }>,
    audioPaused: 0,
    audioResumed: 0,
    canvasConstructed: 0,
    failStart: false,
    failFinalize: false
  }
  class FakeQuality {
    constructor(public opts: { bitrate?: number }) {}
  }
  class FakeCanvasSource {
    kind = 'canvas'
    constructor(
      _canvas: unknown,
      public config: Record<string, unknown>
    ) {
      calls.canvasConstructed++
    }
    async add(t: number, dur: number): Promise<void> {
      calls.canvasAdds.push({ t, dur })
    }
  }
  class FakeAudioTrackSource {
    kind = 'audioTrack'
    constructor(
      _track: unknown,
      public config: Record<string, unknown>
    ) {}
    pause(): void {
      calls.audioPaused++
    }
    resume(): void {
      calls.audioResumed++
    }
  }
  class FakeOutput {
    constructor(opts: { format?: { opts?: { fastStart?: string } }; target?: unknown }) {
      calls.outputConstructed.push({
        fastStart: opts.format?.opts?.fastStart,
        hasTarget: !!opts.target
      })
    }
    addVideoTrack(source: { kind: string }, metadata?: { frameRate?: number }): void {
      calls.addVideoTrack.push({ sourceKind: source.kind, frameRate: metadata?.frameRate })
    }
    addAudioTrack(source: { kind: string }): void {
      calls.addAudioTrack.push({ sourceKind: source.kind })
    }
    async start(): Promise<void> {
      if (calls.failStart) throw new Error('start failed (simulated)')
      calls.started++
    }
    async finalize(): Promise<void> {
      if (calls.failFinalize) throw new Error('finalize failed (simulated writer error)')
      calls.finalized++
    }
    async cancel(): Promise<void> {
      calls.canceled++
    }
  }
  class FakeMp4OutputFormat {
    constructor(public opts: { fastStart?: string }) {}
  }
  class FakeStreamTarget {
    constructor(
      public writable: unknown,
      public opts?: Record<string, unknown>
    ) {}
  }
  return {
    calls,
    FakeQuality,
    FakeCanvasSource,
    FakeAudioTrackSource,
    FakeOutput,
    FakeMp4OutputFormat,
    FakeStreamTarget
  }
})

vi.mock('mediabunny', () => ({
  Output: mbFakes.FakeOutput,
  Mp4OutputFormat: mbFakes.FakeMp4OutputFormat,
  StreamTarget: mbFakes.FakeStreamTarget,
  CanvasSource: mbFakes.FakeCanvasSource,
  MediaStreamAudioTrackSource: mbFakes.FakeAudioTrackSource,
  Quality: mbFakes.FakeQuality
}))

// MediaRecorder 哨兵：webcodecs 分支绝不该构造它
class SentinelMediaRecorder {
  static constructed = 0
  static isTypeSupported(): boolean {
    return true
  }
  constructor() {
    SentinelMediaRecorder.constructed++
  }
  state = 'inactive'
  onstop: (() => void) | null = null
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    this.onstop?.()
  }
}

/** 带音频轨的假流（音频采样源接线/暂停恢复用） */
const fakeStreamWithAudio = {
  getVideoTracks: () => [{ readyState: 'live' }],
  getAudioTracks: () => [{ readyState: 'live' }]
} as unknown as MediaStream

function installApi(): {
  ipc: {
    defaultPathReqs: unknown[]
    appended: number[]
    endWriteReqs: Array<{
      path: string
      duration?: number | undefined
      recordingId?: string | undefined
    }>
    aborted: string[]
    finalizes: Array<{ recordingId?: string; fileSize?: number; durationMs?: number }>
    notifications: string[]
  }
  rejectAppend: () => void
} {
  const ipc = {
    defaultPathReqs: [] as unknown[],
    appended: [] as number[],
    endWriteReqs: [] as Array<{
      path: string
      duration?: number | undefined
      recordingId?: string | undefined
    }>,
    aborted: [] as string[],
    finalizes: [] as Array<{ recordingId?: string; fileSize?: number; durationMs?: number }>,
    notifications: [] as string[]
  }
  let failAppend = false
  ;(window as unknown as { api: unknown }).api = {
    screenRecorder: {
      getDefaultSavePath: async (req?: { extension?: string }) => {
        ipc.defaultPathReqs.push(req)
        // 主进程按请求扩展名签发（与实现一致）
        return `/downloads/pilot.${req?.extension === 'mp4' ? 'mp4' : 'webm'}`
      },
      beginWrite: async () => ({ ok: true }),
      appendChunk: async (_p: string, data: Uint8Array) => {
        if (failAppend) return { ok: false }
        ipc.appended.push(data.byteLength)
        return { ok: true }
      },
      endWrite: async (path: string, duration?: number, recordingId?: string) => {
        ipc.endWriteReqs.push({ path, duration, recordingId })
        return { success: true, filePath: path }
      },
      abortWrite: async (path: string) => {
        ipc.aborted.push(path)
        return { ok: true }
      }
    },
    notification: {
      recording: async (kind: string, message: string) => {
        ipc.notifications.push(`${kind}:${message}`)
      }
    },
    recording: {
      start: async () => ({ recordingId: 'rid-pipeline' }),
      finalize: async (req: { recordingId?: string; fileSize?: number; durationMs?: number }) => {
        ipc.finalizes.push(req)
        return { ok: true }
      },
      segments: {
        close: async () => ({ ok: true }),
        open: async () => ({ ok: true })
      }
    }
  }
  return {
    ipc,
    rejectAppend: () => {
      failAppend = true
    }
  }
}

/** 等到条件成立（轮询，真实定时器——帧循环节拍是 setTimeout） */
async function waitUntil(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  for (let t = 0; t < timeoutMs && !cond(); t += 25) {
    await new Promise((r) => setTimeout(r, 25))
  }
  expect(cond()).toBe(true)
}

beforeEach(() => {
  vi.stubGlobal('MediaRecorder', SentinelMediaRecorder)
  SentinelMediaRecorder.constructed = 0
  mbFakes.calls.failStart = false
  mbFakes.calls.failFinalize = false
  Object.keys(mbFakes.calls).forEach((k) => {
    const v = (mbFakes.calls as unknown as Record<string, unknown>)[k]
    if (Array.isArray(v)) v.length = 0
    else if (typeof v === 'number') (mbFakes.calls as unknown as Record<string, number>)[k] = 0
  })
  // 复位模块级单例的引擎选项（recorderOptions 是跨用例共享状态）
  useScreenRecorder().setRecorderOptions({})
})

describe('useScreenRecorder webcodecs 管线分支（P1）', () => {
  it('engine=webcodecs：mp4 路径签发 + fragmented Output + 逐帧 add + 不创建 MediaRecorder', async () => {
    const { ipc } = installApi()
    const rec = useScreenRecorder()
    rec.setRecorderOptions({
      engine: 'webcodecs',
      fps: 30,
      codec: 'avc',
      videoBitsPerSecond: 2500000
    })

    await rec.startRecording(fakeStream)
    expect(rec.isRecording.value).toBe(true)
    // mp4 容器：默认路径请求带 mp4 扩展名，主进程按扩展名签发
    expect(ipc.defaultPathReqs[0]).toEqual({ extension: 'mp4' })
    expect(rec.savePath.value).toBe('/downloads/pilot.mp4')
    // mediabunny 接线
    expect(mbFakes.calls.outputConstructed).toHaveLength(1)
    expect(mbFakes.calls.outputConstructed[0]!.fastStart).toBe('fragmented')
    expect(mbFakes.calls.outputConstructed[0]!.hasTarget).toBe(true)
    expect(mbFakes.calls.addVideoTrack[0]!.frameRate).toBe(30)
    expect(mbFakes.calls.started).toBe(1)
    expect(mbFakes.calls.canvasConstructed).toBe(1)
    expect(SentinelMediaRecorder.constructed).toBe(0)

    // 逐帧 add：时间戳按 1/30 递增
    await waitUntil(() => mbFakes.calls.canvasAdds.length >= 4)
    const adds = mbFakes.calls.canvasAdds
    expect(adds[1]!.t - adds[0]!.t).toBeCloseTo(1 / 30, 5)
    expect(adds[0]!.dur).toBeCloseTo(1 / 30, 5)

    rec.stopRecording()
    await waitUntil(() => !rec.isRecording.value)
  })

  it('停止：finalize → endWrite(时长, recordingId) → recording.finalize → stop 通知，savePath 复位', async () => {
    const { ipc } = installApi()
    const rec = useScreenRecorder()
    rec.setRecorderOptions({ engine: 'webcodecs', fps: 30 })
    await rec.startRecording(fakeStream)
    await waitUntil(() => mbFakes.calls.canvasAdds.length >= 3)

    rec.stopRecording()
    await waitUntil(() => !rec.isRecording.value)
    // 等异步收尾链落定
    await new Promise((r) => setTimeout(r, 50))

    expect(mbFakes.calls.finalized).toBe(1)
    expect(ipc.endWriteReqs).toHaveLength(1)
    expect(ipc.endWriteReqs[0]!.recordingId).toBe('rid-pipeline')
    expect(ipc.endWriteReqs[0]!.path).toBe('/downloads/pilot.mp4')
    expect(ipc.endWriteReqs[0]!.duration).toBeGreaterThanOrEqual(0)
    expect(ipc.finalizes[0]!.recordingId).toBe('rid-pipeline')
    expect(ipc.notifications.some((n) => n.startsWith('stop:'))).toBe(true)
    // 一次性签发：收尾后 savePath 复位
    expect(rec.savePath.value).toBeNull()
  })

  it('暂停：音频采样 pause + add 停止推进；恢复后继续', async () => {
    const { ipc } = installApi()
    const rec = useScreenRecorder()
    rec.setRecorderOptions({ engine: 'webcodecs', fps: 30 })
    await rec.startRecording(fakeStreamWithAudio)
    // 音频轨存在 → MediaStreamAudioTrackSource 挂到 output
    expect(mbFakes.calls.addAudioTrack).toHaveLength(1)
    await waitUntil(() => mbFakes.calls.canvasAdds.length >= 3)

    rec.togglePause()
    expect(rec.isPaused.value).toBe(true)
    expect(mbFakes.calls.audioPaused).toBe(1)
    const frozenAt = mbFakes.calls.canvasAdds.length
    await new Promise((r) => setTimeout(r, 300))
    expect(mbFakes.calls.canvasAdds.length).toBe(frozenAt) // 时间轴冻结

    rec.togglePause()
    expect(rec.isPaused.value).toBe(false)
    expect(mbFakes.calls.audioResumed).toBe(1)
    await waitUntil(() => mbFakes.calls.canvasAdds.length > frozenAt)

    rec.stopRecording()
    await waitUntil(() => !rec.isRecording.value)
    expect(ipc.notifications.some((n) => n.startsWith('stop:'))).toBe(true)
  })

  it('finalize 失败（写桥/编码器错误模拟）：abortWrite 清场 + error 通知，不写 endWrite/历史', async () => {
    const { ipc } = installApi()
    const rec = useScreenRecorder()
    rec.setRecorderOptions({ engine: 'webcodecs', fps: 30 })
    await rec.startRecording(fakeStream)
    await waitUntil(() => mbFakes.calls.canvasAdds.length >= 1)

    // 模拟写桥错误向上传播：output.finalize() reject
    mbFakes.calls.failFinalize = true
    rec.stopRecording()
    await waitUntil(() => !rec.isRecording.value, 5000)
    await new Promise((r) => setTimeout(r, 50))

    expect(ipc.aborted).toHaveLength(1)
    expect(ipc.endWriteReqs).toHaveLength(0)
    expect(ipc.finalizes).toHaveLength(0)
    expect(ipc.notifications.some((n) => n.startsWith('error:'))).toBe(true)
  })

  it('fMP4 写桥：position 严格递增校验 + appendChunk 拒绝置错 + 字节统计', async () => {
    const { createPipelineWriteBridge } = await import('../useRecordingPipeline')
    const { ipc, rejectAppend } = installApi()
    const bridge = createPipelineWriteBridge('/tmp/x.mp4')
    const writer = bridge.writable.getWriter()

    await writer.write({ data: new Uint8Array([1, 2, 3]), position: 0 })
    expect(bridge.bytesWritten()).toBe(3)
    expect(ipc.appended).toEqual([3])

    // 偏移错位（fMP4 破坏性信号）必须抛错拒绝写入
    await expect(writer.write({ data: new Uint8Array([4]), position: 9 })).rejects.toThrow(
      'offset mismatch'
    )
    expect(bridge.writeError()).toContain('offset mismatch')

    // appendChunk 返回 ok:false → 置错并抛出（错误经 finalize 上浮触发 abort 清场）
    const bridge2 = createPipelineWriteBridge('/tmp/y.mp4')
    const writer2 = bridge2.writable.getWriter()
    rejectAppend()
    await expect(writer2.write({ data: new Uint8Array([1]), position: 0 })).rejects.toThrow(
      'appendChunk failed'
    )
    expect(bridge2.writeError()).toBe('appendChunk failed')
  })

  it('engine 缺省：走旧链路（构造 MediaRecorder），mediabunny 零调用', async () => {
    installApi()
    const rec = useScreenRecorder()
    rec.setRecorderOptions({})
    await rec.startRecording(fakeStream)
    expect(rec.isRecording.value).toBe(true)
    expect(SentinelMediaRecorder.constructed).toBe(1)
    expect(mbFakes.calls.outputConstructed).toHaveLength(0)
    rec.stopRecording()
    await waitUntil(() => !rec.isRecording.value)
  })
})
