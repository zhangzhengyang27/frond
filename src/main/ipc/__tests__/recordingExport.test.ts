import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * B48 回归钉（recording.export 域）：
 *  1. recording.export.getInfo 只认录制历史中登记过的文件路径——此前对任意路径
 *     裸跑 ffmpeg probe（解析探针），兄弟通道 generateThumbnail/video:readFile
 *     都有白名单守卫，唯独这条漏网
 *  2. recording.export.start 成功后必须清掉 activeExports 条目——此前只有
 *     .catch 与 cancel 清理，常驻进程每次成功导出泄漏一条
 *     （可观察口径：完成后再 cancel 应返回 ok:false，无账可取消）
 */

const handlers = new Map<string, (event: unknown, req: unknown) => unknown>()

const exportServiceMock = vi.hoisted(() => ({
  export: vi.fn(),
  probeDurationSec: vi.fn(async () => 12.5)
}))

const repoMock = vi.hoisted(() => ({
  findById: vi.fn(() => null),
  findByFilePath: vi.fn(() => null),
  list: vi.fn(() => []),
  count: vi.fn(() => 0),
  softDelete: vi.fn(),
  hardDelete: vi.fn()
}))

const resolveGrantedMock = vi.hoisted(() => ({
  resolve: vi.fn<(p: unknown, ext?: string[]) => string | null>(() => null)
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, req: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../../db/repos/RecordingRepository', () => ({
  recordingRepository: repoMock
}))

// 类 mock 用普通函数形式（vi.fn 在本环境作构造器不稳定）：new X() 返回对象实例
vi.mock('../../services/recording/RecordingExportService', () => ({
  RecordingExportService: function () {
    return exportServiceMock
  }
}))

vi.mock('../../services/recording/GlobalShortcutService', () => ({
  GlobalShortcutService: function () {
    return { load: () => undefined, register: () => undefined, unregister: () => undefined }
  },
  SettingsRepoShortcutsStore: function () {
    return {}
  }
}))

vi.mock('../../services/recording/CountdownService', () => ({
  CountdownService: function () {
    return {}
  }
}))

vi.mock('../../services/recording/SegmentService', () => ({ segmentService: {} }))
vi.mock('../../services/recording/RecoveryManager', () => ({
  getRecoveryManager: vi.fn(() => ({}))
}))
vi.mock('../../services/recording/RegionOverlay', () => ({
  RegionOverlay: { start: vi.fn(), cancel: vi.fn() },
  listDisplays: vi.fn(() => [])
}))
vi.mock('../../services/recording/CursorTracker', () => ({
  CursorTracker: { start: vi.fn(), stop: vi.fn() }
}))
vi.mock('../../services/recording/systemAudioPatterns', () => ({
  probeSystemAudio: vi.fn(() => ({ available: false, matches: [] }))
}))
vi.mock('../recordingSavePathGrants', () => ({
  resolveGrantedRecordingPath: (...args: Array<unknown>) => resolveGrantedMock.resolve(...args)
}))

import { registerRecordingIpcHandlers } from '../recording'

const invoke = async (channel: string, req: unknown): Promise<unknown> => {
  const h = handlers.get(channel)
  if (!h) throw new Error(`handler 未注册: ${channel}`)
  return h({}, req)
}

/** 微任务冲刷：export.start 的 .then 收尾链（成功清理/事件推送）走完 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

beforeEach(() => {
  handlers.clear()
  vi.clearAllMocks()
  registerRecordingIpcHandlers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('recording.export.getInfo 白名单守卫（B48）', () => {
  it('未登记路径拒绝 probe（wrap 重抛 → invoke reject）', async () => {
    repoMock.findByFilePath.mockReturnValueOnce(null)
    await expect(invoke('recording.export.getInfo', { filePath: '/etc/passwd' })).rejects.toThrow(
      /录制/
    )
    expect(exportServiceMock.probeDurationSec).not.toHaveBeenCalled()
  })

  it('已登记路径放行并返回时长', async () => {
    repoMock.findByFilePath.mockReturnValueOnce({ id: 'r1', file_path: '/tmp/rec/a.mp4' })
    exportServiceMock.probeDurationSec.mockResolvedValueOnce(12.5)
    await expect(
      invoke('recording.export.getInfo', { filePath: '/tmp/rec/a.mp4' })
    ).resolves.toMatchObject({ ok: true, durationSec: 12.5 })
    expect(exportServiceMock.probeDurationSec).toHaveBeenCalledWith('/tmp/rec/a.mp4')
  })
})

describe('recording.export.start 完成后清理 activeExports（B48）', () => {
  it('导出成功后 cancel 返回 ok:false（条目已清，不再泄漏）', async () => {
    resolveGrantedMock.resolve.mockReturnValue('/tmp/granted/out.mp4')
    repoMock.findByFilePath.mockReturnValueOnce({ id: 'r1', file_path: '/tmp/rec/a.mp4' })
    exportServiceMock.export.mockResolvedValueOnce({ ok: true, outputPath: '/tmp/granted/out.mp4', fileSize: 1 })
    const res = (await invoke('recording.export.start', {
      recordingId: 'r1',
      sourcePath: '/tmp/rec/a.mp4',
      outputPath: '/tmp/granted/out.mp4',
      format: 'mp4',
      resolution: 1080,
      fps: 30
    })) as { jobId: string }
    expect(res.jobId).toBeTruthy()

    await flush() // .then 成功分支跑完（含本次要钉住的清理）

    // 完成后再取消：应无账可取（修复前条目泄漏，返回 ok:true）
    await expect(invoke('recording.export.cancel', { jobId: res.jobId })).resolves.toMatchObject({
      ok: false
    })
  })

  it('sourcePath 必须是已登记的录制文件（与 outputPath 签发同口径）', async () => {
    resolveGrantedMock.resolve.mockReturnValue('/tmp/granted/out.mp4')
    repoMock.findByFilePath.mockReturnValueOnce(null)
    await expect(
      invoke('recording.export.start', {
        recordingId: 'r1',
        sourcePath: '/etc/passwd',
        outputPath: '/tmp/granted/out.mp4',
        format: 'mp4',
        resolution: 1080,
        fps: 30
      })
    ).rejects.toThrow(/录制/)
    expect(exportServiceMock.export).not.toHaveBeenCalled()
  })
})
