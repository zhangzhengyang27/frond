/**
 * Frond · 数据迁移中心 IPC
 *
 * 暴露给「迁移中心」页面的操作：
 * - migration:listArchives    列出所有 legacy-backup 时间戳目录
 * - migration:restoreArchive 把某个 archive 还原回 userData 根
 * - migration:deleteArchive  删除某个 archive（不可恢复）
 * - migration:exportDb       showSaveDialog + 复制当前 frond.db
 * - migration:importDb       showOpenDialog + 覆盖 frond.db + 重启
 * - migration:factoryReset   删 frond.db + 重启
 *
 * 安全策略：所有破坏性操作（restore / import / reset）内部用 dialog
 * 二次确认；这里只暴露 IPC 入口。
 */

import { app, BrowserWindow } from 'electron'
import { listArchives, deleteArchive, restoreArchive, type ArchiveInfo } from '../db/legacyArchive'
import { exportDb, importDb, factoryReset } from '../db/dbBackup'
import { log } from '../services/LogService'
import { typedHandle } from './typedIpc'

export function registerMigrationIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  typedHandle('migration:listArchives', (): ArchiveInfo[] => {
    try {
      return listArchives(app.getPath('userData'))
    } catch (e) {
      log.warn('migration', `listArchives failed: ${(e as Error).message}`)
      return []
    }
  })

  // ⚠ 这里曾经是裸 ipcMain.handle + 位置参数 `(_e, archivePath: string)`。
  // preload 早已按单对象约定发 `{ archivePath }`，于是 handler 收到的其实是那个
  // 对象，`resolveContainedArchive` 的 `typeof archivePath !== 'string'` 直接判非，
  // 「还原备份」「删除备份」两个按钮永远返回 refused —— 静默失效，无报错。
  typedHandle('migration:deleteArchive', (_e, req): { ok: boolean; error?: string } => {
    return deleteArchive(app.getPath('userData'), req.archivePath)
  })

  typedHandle(
    'migration:restoreArchive',
    (_e, req): { ok: boolean; restored: string[]; errors: string[] } => {
      return restoreArchive(app.getPath('userData'), req.archivePath)
    }
  )

  typedHandle('migration:exportDb', async (): Promise<string | null> => {
    return exportDb(getMainWindow)
  })

  typedHandle(
    'migration:importDb',
    async (): Promise<{ imported: boolean; filePath: string | null }> => {
      return importDb(getMainWindow)
    }
  )

  typedHandle('migration:factoryReset', async (): Promise<boolean> => {
    return factoryReset(getMainWindow)
  })
}
