import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * B57-14 回归钉：recording.delete 兑现契约承诺的 deleteFile。
 * 旧实现完全忽略该参数 → 物理文件永不删除（历史删了、磁盘残留）。
 * 语义：先取行（softDelete 后 findById 因 deleted_at 过滤取不到）→ 删行 → 删文件。
 */

const handlers = new Map<string, (event: unknown, req: unknown) => unknown>()

const repoMock = vi.hoisted(() => ({
  findById: vi.fn(
    (): { id: string; file_path?: string; file_name?: string; duration_ms?: number } | null => null
  ),
  finalize: vi.fn(),
  softDelete: vi.fn(),
  hardDelete: vi.fn(),
  findByFilePath: vi.fn((_p?: string): { id: string } | null => null),
  findInProgress: vi.fn((): unknown[] => []),
  findOrphanCandidates: vi.fn((): unknown[] => []),
  insert: vi.fn(),
  markRecovered: vi.fn(),
  list: vi.fn(() => []),
  count: vi.fn(() => 0)
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, req: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../../db/repos/RecordingRepository', () => ({ recordingRepository: repoMock }))
const segMock = vi.hoisted(() => ({
  totalDurationMs: vi.fn((): number => 0),
  findOpen: vi.fn((): { id: number } | null => null),
  close: vi.fn()
}))
vi.mock('../../db/repos/RecordingSegmentRepository', () => ({
  recordingSegmentRepository: segMock
}))
vi.mock('../../services/recording/RecordingExportService', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/recording/RecordingExportService')>()
  return {
    RecordingExportService: function () {
      return { export: vi.fn(), probeDurationSec: vi.fn(async () => null) }
    },
    ensureExtension: actual.ensureExtension
  }
})
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
  getRecoveryManager: vi.fn(() => ({ scan: () => ({ orphans: [] }) }))
}))
vi.mock('../../services/recording/RegionOverlay', () => ({
  RegionOverlay: {
    open: vi.fn(),
    openForDisplay: vi.fn(),
    openCrossDisplay: vi.fn(),
    cancel: vi.fn()
  },
  listDisplays: vi.fn(() => [])
}))
vi.mock('../../services/recording/CursorTracker', () => ({
  CursorTracker: { start: vi.fn(), stop: vi.fn() }
}))
vi.mock('../../services/recording/systemAudioPatterns', () => ({
  probeSystemAudio: vi.fn(() => ({ available: false, matches: [] }))
}))
vi.mock('../recordingSavePathGrants', () => ({
  resolveGrantedRecordingPath: vi.fn(() => null)
}))

import { registerRecordingIpcHandlers } from '../recording'

const invoke = async (channel: string, req: unknown): Promise<unknown> => {
  const h = handlers.get(channel)
  if (!h) throw new Error(`handler 未注册: ${channel}`)
  return h({}, req)
}

beforeEach(() => {
  handlers.clear()
  vi.clearAllMocks()
  registerRecordingIpcHandlers()
})

describe('recording.delete 兑现 deleteFile（B57-14）', () => {
  it('deleteFile:true → 删行 + 删物理文件', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rec-delete-'))
    const file = join(dir, 'a.mp4')
    writeFileSync(file, 'x')
    repoMock.findById.mockReturnValueOnce({ id: 'r1', file_path: file, file_name: 'a.mp4' })

    const res = (await invoke('recording.delete', {
      id: 'r1',
      hard: true,
      deleteFile: true
    })) as { ok: boolean }

    expect(res.ok).toBe(true)
    expect(repoMock.hardDelete).toHaveBeenCalledWith('r1')
    expect(existsSync(file)).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('deleteFile 缺省/false → 只删行，文件保留（旧行为兼容）', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rec-delete-'))
    const file = join(dir, 'b.mp4')
    writeFileSync(file, 'x')

    const res = (await invoke('recording.delete', { id: 'r2' })) as { ok: boolean }

    expect(res.ok).toBe(true)
    expect(repoMock.softDelete).toHaveBeenCalledWith('r2')
    expect(existsSync(file)).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('文件已被外部删除：deleteFile:true 仍成功（幂等）', async () => {
    repoMock.findById.mockReturnValueOnce({
      id: 'r3',
      file_path: join(tmpdir(), 'definitely-missing.mp4'),
      file_name: 'x.mp4'
    })
    const res = (await invoke('recording.delete', {
      id: 'r3',
      hard: true,
      deleteFile: true
    })) as { ok: boolean }
    expect(res.ok).toBe(true)
  })
})

describe('recording.finalize 时长单一真相（B57-2 后半）', () => {
  beforeEach(() => {
    segMock.totalDurationMs.mockReset()
    segMock.totalDurationMs.mockReturnValue(0)
    segMock.findOpen.mockReturnValue(null)
  })

  it('有段：时长取 segments 聚合，渲染端自报 0 不得覆盖（互踩封死）', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rec-final-'))
    const file = join(dir, 'a.mp4')
    writeFileSync(file, 'file-bytes') // 10 字节：磁盘大小应优先于渲染端自报
    repoMock.findById.mockReturnValueOnce({
      id: 'rF1',
      file_path: file,
      file_name: 'a.mp4',
      duration_ms: 0
    })
    segMock.totalDurationMs.mockReturnValue(42_500)

    await invoke('recording.finalize', {
      recordingId: 'rF1',
      finalFilePath: file,
      fileSize: 0, // 渲染端 cleanup 路径自报 0（病灶形态）
      durationMs: 0
    })

    expect(repoMock.finalize).toHaveBeenCalledWith(
      'rF1',
      expect.objectContaining({ duration_ms: 42_500, file_size: 10 })
    )
    rmSync(dir, { recursive: true, force: true })
  })

  it('无段（历史遗留）：回退渲染端自报值，兼容旧路径', async () => {
    repoMock.findById.mockReturnValueOnce({
      id: 'rF2',
      file_path: '/downloads/x.webm',
      file_name: 'x.webm',
      duration_ms: 0
    })
    segMock.totalDurationMs.mockReturnValue(0)

    await invoke('recording.finalize', {
      recordingId: 'rF2',
      finalFilePath: '/downloads/x.webm',
      fileSize: 123,
      durationMs: 65_000
    })

    expect(repoMock.finalize).toHaveBeenCalledWith(
      'rF2',
      expect.objectContaining({ duration_ms: 65_000, file_size: 123 })
    )
  })
})
