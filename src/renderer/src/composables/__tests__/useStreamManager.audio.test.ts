// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { markRaw, toRaw } from 'vue'
import { useStreamManager } from '../useStreamManager'

/**
 * B57-3 回归钉（P0：画中画开麦 → 关摄像头 → 再录制 = 全程无声）：
 *  1. closeCamera 曾对 canvasStream 全轨 stop——canvasStream 的音轨是
 *     combineStreams addTrack 进来的共享 mic 轨（同一对象也挂在屏幕流/音频
 *     缓存上），杀死它之后所有后续录制都拿不到声音。修复：只停视频轨、
 *     音轨 removeTrack 摘除（所有权归音频缓存管理）
 *  2. combineStreams 的重装条件曾只看 getAudioTracks().length===0——死轨
 *     仍挂在流上（length>0）永不重装。修复：检查 readyState，死轨先摘除
 *     再走统一装配（缓存失效自动重开设备）
 */

function fakeTrack(kind: 'video' | 'audio'): MediaStreamTrack & { stop: ReturnType<typeof vi.fn> } {
  const t = {
    kind,
    readyState: 'live',
    stop: vi.fn(() => {
      t.readyState = 'ended'
    }),
    enabled: true
  }
  return t as unknown as MediaStreamTrack & { stop: ReturnType<typeof vi.fn>; readyState: string }
}

class FakeStream {
  private video: MediaStreamTrack[]
  private audio: MediaStreamTrack[]
  constructor(tracks: MediaStreamTrack[]) {
    this.video = tracks.filter((t) => t.kind === 'video')
    this.audio = tracks.filter((t) => t.kind === 'audio')
  }
  getVideoTracks(): MediaStreamTrack[] {
    return this.video
  }
  getAudioTracks(): MediaStreamTrack[] {
    return this.audio
  }
  getTracks(): MediaStreamTrack[] {
    return [...this.video, ...this.audio]
  }
  addTrack(t: MediaStreamTrack): void {
    ;(t.kind === 'video' ? this.video : this.audio).push(t)
  }
  removeTrack(t: MediaStreamTrack): void {
    const list = t.kind === 'video' ? this.video : this.audio
    const i = list.indexOf(t)
    if (i >= 0) list.splice(i, 1)
  }
  get tracks(): MediaStreamTrack[] {
    return [...this.video, ...this.audio]
  }
  get id(): string {
    return 'fake'
  }
  active = true
  onaddtrack: ((e: unknown) => void) | null = null
  onremovetrack: ((e: unknown) => void) | null = null
  addEventListener(): void {
    /* no-op */
  }
  removeEventListener(): void {
    /* no-op */
  }
  dispatchEvent(): boolean {
    return true
  }
  clone(): FakeStream {
    return this
  }
  getTrackById(): MediaStreamTrack | null {
    return null
  }
}

beforeEach(() => {
  // 复位模块级单例状态（上一用例可能残留流）
  const sm = useStreamManager()
  sm.cleanup()
})

describe('closeCamera 不杀共享音轨（B57-3）', () => {
  it('关摄像头：canvasStream 只停视频轨、音轨摘除不 stop；屏幕流/相机流的共享音轨存活', () => {
    const sm = useStreamManager()
    const sharedAudio = fakeTrack('audio')
    const canvasVideo = fakeTrack('video')
    const cameraVideo = fakeTrack('video')
    const screenVideo = fakeTrack('video')

    sm.stream.value = markRaw(new FakeStream([screenVideo, sharedAudio])) as unknown as MediaStream
    sm.cameraStream.value = markRaw(
      new FakeStream([cameraVideo, sharedAudio])
    ) as unknown as MediaStream
    sm.canvasStream.value = markRaw(
      new FakeStream([canvasVideo, sharedAudio])
    ) as unknown as MediaStream

    sm.closeCamera()

    // 共享音轨绝不能被 stop（否则后续录制全程无声）
    expect(sharedAudio.stop).not.toHaveBeenCalled()
    expect(sharedAudio.readyState).toBe('live')
    // 视频轨正常停
    expect(canvasVideo.stop).toHaveBeenCalled()
    expect(cameraVideo.stop).toHaveBeenCalled()
    // 音轨从 canvasStream 摘除而非随流陪葬
    expect(sm.canvasStream.value).toBeNull()
    expect(sm.stream.value.getAudioTracks()[0]).toBe(sharedAudio)
    // 摄像头引用清空
    expect(sm.cameraStream.value).toBeNull()
  })
})

describe('combineStreams 死音轨重装（B57-3）', () => {
  it('屏幕流上挂着 ended 音轨时：摘除死轨、重开音频设备并挂上新轨', async () => {
    // happy-dom 缺媒体栈：桩掉 captureStream / video 元数据 / play
    const canvasVideoTrack = fakeTrack('video')
    ;(HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream = vi.fn(
      () => markRaw(new FakeStream([canvasVideoTrack])) as unknown as MediaStream
    )
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      get: () => 1280,
      configurable: true
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      get: () => 720,
      configurable: true
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      get: () => 4,
      configurable: true
    })
    HTMLMediaElement.prototype.play = vi.fn(async () => undefined)
    // happy-dom 的 srcObject setter 校验真实 MediaStream 类型；桩掉（代码只写不读）
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      set: vi.fn(),
      get: () => null,
      configurable: true
    })
    // happy-dom 无 2D 上下文：桩掉（合成绘制逻辑不属本钉断言范围）
    const fakeCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      strokeStyle: '',
      lineWidth: 0
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeCtx as unknown as CanvasRenderingContext2D
    )

    const newAudio = fakeTrack('audio')
    const getUserMedia = vi.fn(async () => new FakeStream([newAudio]))
    ;(navigator as unknown as { mediaDevices: { getUserMedia: unknown } }).mediaDevices = {
      getUserMedia
    }

    const sm = useStreamManager()
    const deadAudio = fakeTrack('audio')
    ;(deadAudio as unknown as { readyState: string }).readyState = 'ended'
    const screenVideo = fakeTrack('video')
    // 死轨仍挂在流上（旧条件 length>0 → 永不重装的病灶形态）
    sm.stream.value = markRaw(new FakeStream([screenVideo, deadAudio])) as unknown as MediaStream
    // 合成流要求屏幕流与摄像头流同时存在
    sm.cameraStream.value = markRaw(new FakeStream([fakeTrack('video')])) as unknown as MediaStream

    await sm.combineStreams()

    // 重开了音频设备
    expect(getUserMedia).toHaveBeenCalled()
    // 死轨已从屏幕流摘除，新轨挂上（ref 代理包裹，断言经 toRaw 取原对象）
    const audio = sm.stream.value.getAudioTracks().map((t) => toRaw(t))
    expect(audio).toContain(newAudio)
    expect(audio).not.toContain(deadAudio)
    // 合成流携带新音轨
    const canvasAudio = sm.canvasStream.value!.getAudioTracks().map((t) => toRaw(t))
    expect(canvasAudio).toContain(newAudio)
  })
})
