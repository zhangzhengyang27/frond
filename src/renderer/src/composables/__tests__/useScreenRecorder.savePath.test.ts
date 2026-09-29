// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useScreenRecorder } from '../useScreenRecorder'

/**
 * B30 回归钉：savePath 是一次性签发（endWrite 成功 / abortWrite 即撤销）。
 * onstop 复位漏掉它的话，同会话第二段录制 beginWrite 会被「未签发」拒绝，
 * 渲染端静默降级内存模式 → 保存同样被拒 → 录像整体丢失。
 * 断言口径：每轮 startRecording 必须重新向主进程要一次 getDefaultSavePath。
 */

const fakeStream = {} as unknown as MediaStream

function installFakes(): { defaultPathCalls: () => number } {
  let defaultPathCount = 0
  class FakeMediaRecorder {
    static isTypeSupported(): boolean {
      return true
    }
    state = 'inactive'
    onstop: (() => void) | null = null
    ondataavailable: ((e: unknown) => void) | null = null
    start(): void {
      this.state = 'recording'
    }
    stop(): void {
      if (this.state === 'inactive') return
      this.state = 'inactive'
      this.onstop?.()
    }
  }
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  ;(window as unknown as { api: unknown }).api = {
    screenRecorder: {
      getDefaultSavePath: async () => {
        defaultPathCount += 1
        return `/downloads/rec-${defaultPathCount}.webm`
      },
      beginWrite: async () => ({ ok: true }),
      appendChunk: async () => ({ ok: true }),
      endWrite: async (path: string) => ({ success: true, filePath: path, historyId: 'h1' })
    },
    notification: { recording: async () => {} },
    recording: {
      start: async () => ({ recordingId: 'rid-test' }),
      finalize: async () => ({ ok: true })
    }
  }
  return { defaultPathCalls: () => defaultPathCount }
}

/** onstop 是 async（内含 50ms FIFO 等待），isRecording 翻 false 即收尾完成 */
async function waitStopped(rec: ReturnType<typeof useScreenRecorder>): Promise<void> {
  for (let i = 0; i < 200 && rec.isRecording.value; i++) {
    await new Promise((r) => setTimeout(r, 10))
  }
  expect(rec.isRecording.value).toBe(false)
}

describe('useScreenRecorder savePath 一次性签发（B30）', () => {
  beforeEach(() => {
    installFakes()
  })

  it('第二段录制必须重新签发保存路径（不能复用已被撤销的旧路径）', async () => {
    const rec = useScreenRecorder()

    await rec.startRecording(fakeStream)
    expect(rec.savePath.value).toBe('/downloads/rec-1.webm')
    rec.stopRecording()
    await waitStopped(rec)

    await rec.startRecording(fakeStream)
    // 修复前：savePath 单例残留 → 不再调用 getDefaultSavePath，
    // 复用已被主进程撤销的 rec-1 → beginWrite 拒绝 → 录像丢失
    expect(rec.savePath.value).toBe('/downloads/rec-2.webm')
    rec.stopRecording()
    await waitStopped(rec)
  })
})
