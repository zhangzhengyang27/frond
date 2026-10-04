// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScreenRecorder } from '../useScreenRecorder'

/**
 * B57-5 回归钉：分片写盘丢尾竞态。
 * ondataavailable 的 event.data.arrayBuffer() 是异步链，可能在 onstop 的
 * flushPendingChunk 之后才落到 bufferChunk——旧实现在 50ms 硬等待后直接
 * endWrite，最后一批字节永久丢失（文件尾部损坏、播放器报错）。
 * 断言口径：endWrite 执行时，喂给 MediaRecorder 的全部字节都已 appendChunk
 * 落盘，且任何 append 都不晚于 endWrite。
 */

const fakeStream = {} as unknown as MediaStream

class FakeMediaRecorder {
  static isTypeSupported(): boolean {
    return true
  }
  static instances: FakeMediaRecorder[] = []
  state = 'inactive'
  onstop: (() => void) | null = null
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  constructor() {
    FakeMediaRecorder.instances.push(this)
  }
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    this.onstop?.()
  }
}

/** 构造可控延迟的 Blob：gate resolve 前 arrayBuffer() 一直挂起 */
function makeDeferredBlob(bytes: number[], gate?: Promise<void>): Blob {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'video/webm' })
  if (gate) {
    const original = blob.arrayBuffer.bind(blob)
    blob.arrayBuffer = () => gate.then(() => original())
  }
  return blob
}

function installFakes(): { events: string[]; appendedBytes: () => number } {
  FakeMediaRecorder.instances = []
  const events: string[] = []
  let appended = 0
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  ;(window as unknown as { api: unknown }).api = {
    screenRecorder: {
      getDefaultSavePath: async () => '/downloads/chunk-test.webm',
      beginWrite: async () => {
        events.push('begin')
        return { ok: true }
      },
      appendChunk: async (_p: string, data: Uint8Array) => {
        appended += data.length
        events.push(`append:${data.length}`)
        return { ok: true }
      },
      endWrite: async (p: string) => {
        events.push('end')
        return { success: true, filePath: p }
      },
      abortWrite: async () => ({ ok: true })
    },
    notification: { recording: async () => {} },
    recording: {
      start: async () => ({ recordingId: 'rid-chunk' }),
      finalize: async () => ({ ok: true })
    }
  }
  return { events, appendedBytes: () => appended }
}

/** onstop 收尾完成（isRecording 翻 false）后才继续断言 */
async function waitStopped(rec: ReturnType<typeof useScreenRecorder>): Promise<void> {
  for (let i = 0; i < 400 && rec.isRecording.value; i++) {
    await new Promise((r) => setTimeout(r, 10))
  }
  expect(rec.isRecording.value).toBe(false)
}

describe('useScreenRecorder 分片写盘不丢尾（B57-5）', () => {
  beforeEach(() => {
    installFakes()
  })

  it('onstop 之后才就绪的尾部分片必须先于 endWrite 落盘', async () => {
    const f = installFakes()
    const rec = useScreenRecorder()
    await rec.startRecording(fakeStream)

    const mr = FakeMediaRecorder.instances[0]!
    // 第一批：arrayBuffer 立即就绪
    mr.ondataavailable?.({ data: makeDeferredBlob([1, 2, 3]) })
    // 尾批：arrayBuffer 挂起（模拟主线程忙，就绪晚于 onstop 的 flush）
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    mr.ondataavailable?.({ data: makeDeferredBlob([4, 5, 6, 7], gate) })

    rec.stopRecording()
    // onstop 已开始收尾……此刻放行尾部分片
    await new Promise((r) => setTimeout(r, 20))
    release()
    await waitStopped(rec)

    expect(f.appendedBytes()).toBe(7)
    const endIdx = f.events.indexOf('end')
    expect(endIdx).toBeGreaterThan(-1)
    // 修复前：尾批 4 字节永远进不了磁盘（append 缺失或晚于 end）
    expect(f.events.lastIndexOf('append:4')).toBeLessThan(endIdx)
  })

  it('常规停止：全部分片 append 完成后才是 endWrite', async () => {
    const f = installFakes()
    const rec = useScreenRecorder()
    await rec.startRecording(fakeStream)

    const mr = FakeMediaRecorder.instances[0]!
    mr.ondataavailable?.({ data: makeDeferredBlob([1, 2]) })
    // 让 arrayBuffer 链与缓冲 flush 窗口先落地
    await new Promise((r) => setTimeout(r, 0))

    rec.stopRecording()
    await waitStopped(rec)

    expect(f.appendedBytes()).toBe(2)
    expect(f.events.indexOf('end')).toBe(f.events.length - 1)
  })
})
