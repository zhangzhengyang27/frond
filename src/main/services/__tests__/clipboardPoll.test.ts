import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
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

const { clipboardMock, execFileMock } = vi.hoisted(() => ({
  clipboardMock: {
    readText: vi.fn((): string => ''),
    availableFormats: vi.fn((): string[] => []),
    readImage: vi.fn(() => ({ isEmpty: () => true, getSize: () => ({ width: 0, height: 0 }) }))
  },
  execFileMock: vi.fn(
    (_cmd: string, _args: string[], _opts: unknown, cb: (e: Error | null, out: string) => void) => {
      cb(null, 'Finder')
    }
  )
}))

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
  dir = mkdtempSync(join(tmpdir(), 'frond-clip-'))
  rmSync(dir, { recursive: true, force: true }) // 只借名字
  svc = new ClipboardHistoryService()
  ;(svc as unknown as { dir: string }).dir = dir
  execFileMock.mockClear()
  clipboardMock.readText.mockReturnValue('')
  clipboardMock.availableFormats.mockReturnValue([])
})

const poll = (): Promise<void> =>
  (svc as unknown as { poll(): Promise<void> }).poll()

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
