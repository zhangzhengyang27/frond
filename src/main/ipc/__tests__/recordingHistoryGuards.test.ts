import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, truncateSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * B30 白名单收口回归钉（recordingHistory 域）：
 *
 * video:readFile 的白名单数据源是录制历史，而历史此前可经 addHistory 被渲染端
 * 注入任意路径 → 两次 IPC 读走任意文件。本文件钉住四条守卫：
 *  1. addHistory 只认主进程当前签发过的路径（污染源头封死）
 *  2. video:readFile 拒绝未知路径 + 兑现文件头承诺的 128MB 上限
 *  3. showInFolder 只认历史行（同文件 openFile 有守卫、它没有的漏改）
 *  4. generateThumbnail 只认历史行（ffmpeg -i 任意文件 = 解析探针）
 */

const { handlers, svc } = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, req: unknown) => unknown>()
  return {
    handlers,
    svc: {
      getHistory: vi.fn((): Array<{ filePath: string }> => []),
      addHistory: vi.fn((rec: { filePath: string }) => ({ id: 'h1', ...rec })),
      generateThumbnail: vi.fn(async () => '/tmp/thumb.jpg'),
      getHistoryByDateRange: vi.fn(() => []),
      deleteHistory: vi.fn(() => true),
      clearHistory: vi.fn(),
      updateThumbnail: vi.fn(async () => null),
      getStatistics: vi.fn(() => ({}))
    }
  }
})

const { resolveGrantedMock } = vi.hoisted(() => ({
  resolveGrantedMock: vi.fn<(p: unknown, ext?: string[]) => string | null>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, req: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  },
  shell: {
    showItemInFolder: vi.fn(),
    openPath: vi.fn(async () => '')
  }
}))

vi.mock('../../services/RecordingHistoryService', () => ({
  RecordingHistoryService: { getInstance: () => svc }
}))

vi.mock('../recordingSavePathGrants', () => ({
  resolveGrantedRecordingPath: (...args: unknown[]) =>
    resolveGrantedMock(...(args as [unknown, string[]?]))
}))

import { registerRecordingHistoryIpcHandlers } from '../recordingHistory'

function call(channel: string, req?: unknown): Promise<unknown> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`channel not registered: ${channel}`)
  return Promise.resolve(fn({}, req))
}

async function callAsync(channel: string, req?: unknown): Promise<unknown> {
  return await call(channel, req)
}

describe('recordingHistory 白名单守卫（B30）', () => {
  let dir: string
  let video: string

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerRecordingHistoryIpcHandlers()
    dir = mkdtempSync(join(tmpdir(), 'frond-recguard-'))
    video = join(dir, 'rec.webm')
    writeFileSync(video, 'x')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('addHistory 拒绝未经签发的路径（污染源头封死）——批 7a 起走异步 rejection+信封', async () => {
    resolveGrantedMock.mockReturnValue(null)
    await expect(call('recording-history:addHistory', { filePath: '/etc/passwd' })).rejects.toThrow(
      '未经主进程签发'
    )
    expect(svc.addHistory).not.toHaveBeenCalled()
  })

  it('addHistory 白名单跟随引擎：mp4/gif 已签发路径放行（P3·B57-14，webcodecs 引擎直出 mp4）', async () => {
    // 模拟真实 resolveGrantedRecordingPath 的扩展名过滤语义
    resolveGrantedMock.mockImplementation((p: unknown, ext?: string[]) =>
      ext?.some((e) => String(p).toLowerCase().endsWith(e)) ? String(p) : null
    )
    await expect(
      call('recording-history:addHistory', { filePath: '/downloads/rec.mp4' })
    ).resolves.toBeTruthy()
    await expect(
      call('recording-history:addHistory', { filePath: '/downloads/rec.gif' })
    ).resolves.toBeTruthy()
    expect(svc.addHistory).toHaveBeenCalledTimes(2)
  })

  it('addHistory 放行已签发路径', async () => {
    resolveGrantedMock.mockReturnValue(video)
    const res = (await call('recording-history:addHistory', { filePath: video })) as {
      id: string
    }
    expect(res.id).toBe('h1')
    expect(svc.addHistory).toHaveBeenCalled()
  })

  it('video:readFile 拒绝不在历史里的路径', async () => {
    svc.getHistory.mockReturnValue([{ filePath: video }])
    await expect(callAsync('video:readFile', '/etc/passwd')).rejects.toThrow('录制历史')
  })

  it('video:readFile 兑现 128MB 上限（稀疏文件，不占真实磁盘）', async () => {
    svc.getHistory.mockReturnValue([{ filePath: video }])
    truncateSync(video, 129 * 1024 * 1024)
    await expect(callAsync('video:readFile', video)).rejects.toThrow('128MB')
  })

  it('video:readFile 放行历史内的小文件', async () => {
    svc.getHistory.mockReturnValue([{ filePath: video }])
    const buf = (await callAsync('video:readFile', video)) as ArrayBuffer
    expect(buf.byteLength).toBe(1)
  })

  it('showInFolder 只认历史行', async () => {
    svc.getHistory.mockReturnValue([{ filePath: video }])
    const bad = (await callAsync('recording-history:showInFolder', {
      filePath: '/etc/passwd'
    })) as { success: boolean }
    expect(bad.success).toBe(false)
    const ok = (await callAsync('recording-history:showInFolder', {
      filePath: video
    })) as { success: boolean }
    expect(ok.success).toBe(true)
  })

  it('generateThumbnail 只认历史行', async () => {
    svc.getHistory.mockReturnValue([])
    await expect(
      callAsync('recording-history:generateThumbnail', { videoPath: '/etc/passwd' })
    ).rejects.toThrow('录制历史')
    svc.getHistory.mockReturnValue([{ filePath: video }])
    await callAsync('recording-history:generateThumbnail', { videoPath: video })
    expect(svc.generateThumbnail).toHaveBeenCalledWith(video)
  })
})
