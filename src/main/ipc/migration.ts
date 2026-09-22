/**
 * Leaf · 数据迁移中心 IPC
 *
 * 暴露给「迁移中心」页面的操作：
 * - migration:listArchives    列出所有 legacy-backup 时间戳目录
 * - migration:restoreArchive 把某个 archive 还原回 userData 根
 * - migration:deleteArchive  删除某个 archive（不可恢复）
 * - migration:exportDb       showSaveDialog + 复制当前 leaf.db
 * - migration:importDb       showOpenDialog + 覆盖 leaf.db + 重启
 * - migration:factoryReset   删 leaf.db + 重启
 *
 * 安全策略：所有破坏性操作（restore / import / reset）内部用 dialog
 * 二次确认；这里只暴露 IPC 入口。
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { listArchives, deleteArchive, restoreArchive, type ArchiveInfo } from '../db/legacyArchive'
import { exportDb, importDb, factoryReset } from '../db/dbBackup'
import { log } from '../services/LogService'

export function registerMigrationIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('migration:listArchives', (): ArchiveInfo[] => {
    try {
      return listArchives(app.getPath('userData'))
    } catch (e) {
      log.warn('migration', `listArchives failed: ${(e as Error).message}`)
      return []
    }
  })

  ipcMain.handle(
    'migration:deleteArchive',
    (_e, archivePath: string): { ok: boolean; error?: string } => {
      return deleteArchive(app.getPath('userData'), archivePath)
    }
  )

  ipcMain.handle(
    'migration:restoreArchive',
    (_e, archivePath: string): { ok: boolean; restored: string[]; errors: string[] } => {
      return restoreArchive(app.getPath('userData'), archivePath)
    }
  )

  ipcMain.handle('migration:exportDb', async (): Promise<string | null> => {
    return exportDb(getMainWindow)
  })

  ipcMain.handle(
    'migration:importDb',
    async (): Promise<{ imported: boolean; filePath: string | null }> => {
      return importDb(getMainWindow)
    }
  )

  ipcMain.handle('migration:factoryReset', async (): Promise<boolean> => {
    return factoryReset(getMainWindow)
  })
}
