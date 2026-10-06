import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * B53-2 剪贴板轮询重排回归钉：指纹先行——剪贴板内容没变化时**不得**查询前台
 * 应用（osascript 子进程 spawn ~5-15ms，此前每秒一次 ≈ 8.6 万次/天）。
 * 只有指纹变化、即将入账时才需要 frontApp（屏蔽判断 + 来源应用）。
 *
 * P1-6 语义保持：屏蔽应用前台的复制不入历史（该轮指纹记为已见，后续同内容
 * 轮询同样不再查前台应用——与「同内容重复复制不重复入账」的既有语义一致）。
 */

const { clipboardMock, execFileMock } = vi.hoisted(() => {
  let imageSeq = 0
  const clipboardMock = {
    readText: vi.fn((): string => ''),
    availableFormats: vi.fn((): string[] => []),
    readImage: vi.fn(() => {
      const seq = ++imageSeq
      return {
        isEmpty: () => false,
        getSize: () => ({ width: 10, height: 10 }),
        // 每次内容不同 → 指纹不同（模拟不同图片）
        resize: () => ({ toDataURL: () => `data:image/png;base64,IMG${seq}` }),
        toPNG: () => Buffer.alloc(8)
      }
    })
  }
  return {
    clipboardMock,
    execFileMock: vi.fn(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (e: Error | null, out: string) => void
      ) => {
        cb(null, 'Finder')
      }
    )
  }
})
void execFileMock

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/frond-test-userdata') },
  clipboard: clipboardMock,
  nativeImage: { createFromPath: vi.fn(() => ({ toPNG: () => Buffer.alloc(0) })) }
}))

vi.mock('child_process', () => ({ execFile: execFileMock }))

import { ClipboardHistoryService } from '../ClipboardHistoryService'

let svc: InstanceType<typeof ClipboardHistoryService>
let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'frond-clip-')) // saveImage 要往里写 PNG，目录必须真实存在
  svc = new ClipboardHistoryService()
  ;(svc as unknown as { dir: string }).dir = dir
  execFileMock.mockClear()
  clipboardMock.readText.mockReturnValue('')
  clipboardMock.availableFormats.mockReturnValue([])
  clipboardMock.readImage.mockClear()
})

const poll = (): Promise<void> => (svc as unknown as { poll(): Promise<void> }).poll()

describe('剪贴板 poll 指纹先行（B53-2）', () => {
  it('内容不变：只有第一轮查前台应用，后续轮零 spawn', async () => {
    clipboardMock.readText.mockReturnValue('hello')
    await poll()
    expect(execFileMock).toHaveBeenCalledTimes(1) // 首轮入账需要 frontApp
    await poll()
    await poll()
    expect(execFileMock).toHaveBeenCalledTimes(1) // 内容没变：不 spawn
  })

  it('内容变化：spawn 查 frontApp 并作为来源入账', async () => {
    clipboardMock.readText.mockReturnValue('first')
    await poll()
    clipboardMock.readText.mockReturnValue('second')
    await poll()
    expect(execFileMock).toHaveBeenCalledTimes(2)
    expect(svc.list().some((i) => i.kind === 'text' && i.text === 'second')).toBe(true)
  })

  it('剪贴板全空：连第一轮都不 spawn', async () => {
    await poll()
    await poll()
    expect(execFileMock).not.toHaveBeenCalled()
  })
})

describe('剪贴板大图 readImage 节流（B41-1）', () => {
  it('大图驻留：formats 不变时 readImage 按 5s 节流（5 次轮询最多 2 次，此前 5 次）', async () => {
    vi.useFakeTimers()
    clipboardMock.availableFormats.mockReturnValue(['image/png', 'text/plain'])
    for (let i = 0; i < 5; i++) {
      await poll()
      vi.advanceTimersByTime(1000)
    }
    expect(clipboardMock.readImage.mock.calls.length).toBeLessThanOrEqual(2)
    vi.useRealTimers()
  })

  it('formats 签名变化（text→image）→ 立即 readImage 并入账', async () => {
    clipboardMock.readText.mockReturnValue('')
    clipboardMock.availableFormats.mockReturnValue([])
    await poll()
    clipboardMock.availableFormats.mockReturnValue(['image/png'])
    await poll()
    expect(clipboardMock.readImage).toHaveBeenCalledTimes(1)
    expect(svc.list().some((i) => i.kind === 'image')).toBe(true)
  })
})
