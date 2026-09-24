import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * migration IPC 的单对象入参回归（2026-09-24）。
 *
 * 背景：这 6 条通道此前用裸 ipcMain.handle + 位置参数注册，而 preload 早已按单对象
 * 约定发 `{ archivePath }`。于是 handler 里的 `archivePath` 其实是整个对象，
 * `resolveContainedArchive` 的 `typeof archivePath !== 'string'` 直接判非 ——
 * 「还原备份」「删除备份」两个按钮**永远**返回 refused，既不报错也不留日志。
 *
 * 本文件用「捕获注册函数 → 按 preload 的真实形状调用 → 断言业务函数收到的是字符串」
 * 这条链来钉住它。判别性：把 handler 改回 `(_e, archivePath: string) => deleteArchive(userData, archivePath)`，
 * 下面第一条断言立刻红（收到的是 `{ archivePath: '…' }` 对象）。
 */

const { handlers, legacyArchiveMocks } = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, req: unknown) => unknown>()
  return {
    handlers,
    legacyArchiveMocks: {
      listArchives: vi.fn(() => []),
      deleteArchive: vi.fn(() => ({ ok: true })),
      restoreArchive: vi.fn(() => ({ ok: true, restored: [], errors: [] }))
    }
  }
})

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/frond-migration-ipc-test' },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, req: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../../db/legacyArchive', () => legacyArchiveMocks)
vi.mock('../../db/dbBackup', () => ({
  exportDb: vi.fn(async () => null),
  importDb: vi.fn(async () => ({ imported: false, filePath: null })),
  factoryReset: vi.fn(async () => true)
}))
vi.mock('../../services/LogService', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { registerMigrationIpcHandlers } from '../migration'

const USER_DATA = '/tmp/frond-migration-ipc-test'
const ARCHIVE = `${USER_DATA}/legacy-backup/2026-01-02T03-04-05-000Z`

function invoke(channel: string, req: unknown): unknown {
  const h = handlers.get(channel)
  if (!h) throw new Error(`通道未注册：${channel}`)
  return h({}, req)
}

describe('migration IPC 单对象入参', () => {
  beforeEach(() => {
    handlers.clear()
    legacyArchiveMocks.listArchives.mockClear()
    legacyArchiveMocks.deleteArchive.mockClear()
    legacyArchiveMocks.restoreArchive.mockClear()
    registerMigrationIpcHandlers(() => null)
  })

  it('六条通道全部注册（体量哨兵：防止注册函数被掏空后下面的断言空转）', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'migration:deleteArchive',
      'migration:exportDb',
      'migration:factoryReset',
      'migration:importDb',
      'migration:listArchives',
      'migration:restoreArchive'
    ])
  })

  it('deleteArchive 把 req.archivePath 当字符串传下去（不是把整个 req 传下去）', () => {
    invoke('migration:deleteArchive', { archivePath: ARCHIVE })
    expect(legacyArchiveMocks.deleteArchive).toHaveBeenCalledTimes(1)
    expect(legacyArchiveMocks.deleteArchive).toHaveBeenCalledWith(USER_DATA, ARCHIVE)
  })

  it('restoreArchive 把 req.archivePath 当字符串传下去', () => {
    invoke('migration:restoreArchive', { archivePath: ARCHIVE })
    expect(legacyArchiveMocks.restoreArchive).toHaveBeenCalledTimes(1)
    expect(legacyArchiveMocks.restoreArchive).toHaveBeenCalledWith(USER_DATA, ARCHIVE)
  })

  it('listArchives 用 userData 路径，不需要入参', () => {
    invoke('migration:listArchives', undefined)
    expect(legacyArchiveMocks.listArchives).toHaveBeenCalledWith(USER_DATA)
  })

  it('listArchives 在底层抛错时降级为空数组而不是把异常透给渲染端', () => {
    legacyArchiveMocks.listArchives.mockImplementationOnce(() => {
      throw new Error('EACCES')
    })
    expect(invoke('migration:listArchives', undefined)).toEqual([])
  })
})
