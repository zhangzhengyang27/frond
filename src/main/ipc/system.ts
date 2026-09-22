/**
 * Leaf · system info IPC（userData 路径 + legacy 归档目录）
 *
 * 暴露给 SettingsView「数据」区块，让用户看到：
 * - 数据目录在哪
 * - 旧 JSON 是否归档到 legacy-backup/
 *
 * 后续可以加：版本、平台、locale、磁盘占用等。
 */

import { app, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { database } from '../db/database'
import { log } from '../services/LogService'
import { safeOpenablePath } from '../utils/openPathGuard'
import { openQuicklinkUrl } from '../launcher/quicklinkOpen'
import { enableFrontmostCache, getCachedFrontmostApp } from '../launcher/frontmostCache'
import { enableFrontmostCache, getCachedFrontmostApp } from '../launcher/frontmostCache'

export interface SystemInfo {
  userDataPath: string
  dbPath: string
  legacyArchivePath: string | null
  /** 最近一次迁移是否成功（false = 没跑过或失败） */
  migrationDone: boolean
}

function readSystemInfo(): SystemInfo {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'leaf.db')

  let legacyArchivePath: string | null = null
  let migrationDone = false
  try {
    const db = database.handle
    db.exec(
      `CREATE TABLE IF NOT EXISTS leaf_meta (
         key TEXT PRIMARY KEY,
         value TEXT,
         updated_at INTEGER NOT NULL
       )`
    )
    const archiveRow = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('legacy_archive_dir') as { value: string } | undefined
    if (archiveRow?.value && existsSync(archiveRow.value)) {
      legacyArchivePath = archiveRow.value
    }
    const v2Row = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get('data_migration_v2') as { value: string } | undefined
    migrationDone = v2Row?.value === 'done'
  } catch (e) {
    log.warn('systemInfo', `read failed: ${(e as Error).message}`)
  }

  return { userDataPath, dbPath, legacyArchivePath, migrationDone }
}

export function registerSystemInfoIpcHandlers(): void {
  ipcMain.handle('system:info', (): SystemInfo => readSystemInfo())

  ipcMain.handle('system:openPath', (_e, p: string): boolean => {
    const target = safeOpenablePath(p)
    if (!target) {
      log.warn('systemInfo', `openPath refused: ${String(p).slice(0, 200)}`)
      return false
    }
    shell.openPath(target)
    return true
  })

  // 六期：书签打开原链接（仅放行 http/https，防恶意协议）
  // 走 quicklinkOpen：开关开启时优先复用浏览器已有标签页，未命中/关闭时严格等价 shell.openExternal
  ipcMain.handle('system:openExternal', (_e, url: string): boolean => {
    if (!/^https?:\/\//i.test(url ?? '')) return false
    void openQuicklinkUrl(url)
    return true
  })

  // UI 对标 I2：剪贴板「粘贴到 <应用名>」目标级文案（隐藏期轮询缓存，首次调用启用）
  ipcMain.handle('system:frontmostApp', (): string | null => {
    enableFrontmostCache()
    return getCachedFrontmostApp()
  })
}
