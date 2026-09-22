/**
 * Leaf · Screenshot History IPC Handlers
 *
 * 截图历史记录的 IPC 处理
 */

import { ipcMain, dialog, shell, app, clipboard, nativeImage } from 'electron'
import { join, dirname, extname } from 'path'
import { existsSync, mkdirSync, unlinkSync, statSync } from 'fs'
import {
  screenshotRepository,
  type ScreenshotFilter,
  type Screenshot
} from '../db/repos/ScreenshotRepository'
import { safeOpenablePath } from '../utils/openPathGuard'

// 截图存储目录
function getScreenshotsDirectory(): string {
  const userDataPath = app.getPath('userData')
  const screenshotsDir = join(userDataPath, 'screenshots')

  if (!existsSync(screenshotsDir)) {
    mkdirSync(screenshotsDir, { recursive: true })
  }

  return screenshotsDir
}

export function registerScreenshotHistoryHandlers(): void {
  // 启动时清理 30 天前的软删墓碑行：文件已随删除流程移除，
  // 墓碑（含 ocr_text）只剩 DB 体积，不清则表只增不减
  try {
    const purged = screenshotRepository.purgeDeletedBefore(Date.now() - 30 * 24 * 60 * 60 * 1000)
    if (purged > 0) console.log(`[ScreenshotHistory] purged ${purged} tombstone rows`)
  } catch (e) {
    console.warn('[ScreenshotHistory] tombstone purge failed:', (e as Error).message)
  }

  // 获取截图历史列表
  ipcMain.handle(
    'screenshot:history:list',
    async (_event, filter?: ScreenshotFilter, limit?: number, offset?: number) => {
      try {
        const items = screenshotRepository.list(filter, { limit, offset })
        const total = screenshotRepository.count(filter)
        return { success: true, items, total }
      } catch (error) {
        console.error('[ScreenshotHistory] list error:', error)
        return { success: false, error: (error as Error).message, items: [], total: 0 }
      }
    }
  )

  // 获取单个截图详情
  ipcMain.handle('screenshot:history:get', async (_event, id: string) => {
    try {
      const item = screenshotRepository.getById(id)
      if (item) {
        return { success: true, item }
      }
      return { success: false, error: 'Screenshot not found' }
    } catch (error) {
      console.error('[ScreenshotHistory] get error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取最近的截图
  ipcMain.handle('screenshot:history:recent', async (_event, limit: number = 10) => {
    try {
      const items = screenshotRepository.getRecent(limit)
      return { success: true, items }
    } catch (error) {
      console.error('[ScreenshotHistory] recent error:', error)
      return { success: false, error: (error as Error).message, items: [] }
    }
  })

  // 删除截图
  ipcMain.handle('screenshot:history:delete', async (_event, id: string) => {
    try {
      // 顺序与 deleteMany 对齐（DB-first）：先删文件后删行时半途失败会留下
      // 「文件已删、DB 行还在」的悬挂记录；反向失败只是孤儿文件，可兜底清理
      const item = screenshotRepository.getById(id)
      screenshotRepository.delete(id)
      if (item) {
        try {
          if (existsSync(item.filePath)) {
            unlinkSync(item.filePath)
    } catch (error) {
      console.error('[ScreenshotHistory] delete error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 批量删除截图
  ipcMain.handle('screenshot:history:deleteMany', async (_event, ids: string[]) => {
    try {
      // 先删数据库行（仓库层自带事务），再逐个删物理文件：
  })

  // 批量删除截图
  ipcMain.handle('screenshot:history:deleteMany', async (_event, ids: string[]) => {
    try {
      // 软删前先收集文件路径：getById 过滤已删行，软删后再查必为空
      const paths = ids
        .map((id) => screenshotRepository.getById(id)?.filePath)
        .filter((p): p is string => !!p)
      // 再删数据库行（仓库层自带事务），最后逐个删物理文件：
      // 反过来时半途失败会留下「文件已删、DB 行还在」的悬挂记录
      screenshotRepository.deleteMany(ids)
      let filesRemoved = 0
      for (const path of paths) {
        try {
          if (existsSync(path)) {
            unlinkSync(path)
          }
          filesRemoved += 1
        } catch (e) {
          // 单个文件删除失败不中断批量；残留文件由存储统计/手动清理兜底
          console.warn('[ScreenshotHistory] deleteMany file unlink failed:', path, e)
        }
      }
      return { success: true, count: ids.length, filesRemoved }
    } catch (error) {
      console.error('[ScreenshotHistory] deleteMany error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 打开截图所在文件夹
    } catch (error) {
      console.error('[ScreenshotHistory] showInFolder error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 复制截图到系统剪贴板（启动器「截图历史」内联页等入口）
  ipcMain.handle('screenshot:history:copyImage', async (_event, filePath: string) => {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: 'File not found' }
      }
      const image = nativeImage.createFromPath(filePath)
      if (image.isEmpty()) {
        return { success: false, error: 'Empty image' }
      }
      clipboard.writeImage(image)
      return { success: true }
    } catch (error) {
      console.error('[ScreenshotHistory] copyImage error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 用系统默认查看器打开截图
  ipcMain.handle('screenshot:history:openFile', async (_event, filePath: string) => {
    try {
      const target = safeOpenablePath(filePath)
      if (target) {
        await shell.openPath(target)
        return { success: true }
      }
      return { success: false, error: 'File not found' }
    } catch (error) {
      console.error('[ScreenshotHistory] openFile error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取存储使用情况
  ipcMain.handle('screenshot:history:storageUsage', async () => {
    try {
      const usage = screenshotRepository.getStorageUsage()
      return { success: true, ...usage }
    } catch (error) {
      console.error('[ScreenshotHistory] storageUsage error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 设置截图保存目录
  ipcMain.handle('screenshot:history:setSaveDirectory', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择截图保存目录'
      })
      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true }
      }
      return { success: true, directory: filePaths[0] }
    } catch (error) {
      console.error('[ScreenshotHistory] setSaveDirectory error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取截图保存目录
  ipcMain.handle('screenshot:history:getSaveDirectory', async () => {
    return { success: true, directory: getScreenshotsDirectory() }
  })
}

/**
 * 保存截图到历史记录
 * 返回保存后的截图信息
 */
export async function saveScreenshotToHistory(
  buffer: Buffer,
  options: {
    captureMode?: 'screen' | 'window' | 'region'
    sourceName?: string
  } = {}
): Promise<{ success: boolean; screenshot?: Screenshot; error?: string }> {
  try {
    const screenshotsDir = getScreenshotsDirectory()
    const timestamp = Date.now()
    const fileName = `screenshot_${timestamp}.png`
    const filePath = join(screenshotsDir, fileName)

    // 写入文件
    const fs = await import('fs')
    fs.writeFileSync(filePath, buffer)

    // 获取文件大小
    const stats = statSync(filePath)

    // 保存到数据库
    const screenshot = screenshotRepository.add({
      filePath,
      fileName,
      fileSize: stats.size,
      captureMode: options.captureMode ?? 'region'
    })

    return { success: true, screenshot }
  } catch (error) {
    console.error('[ScreenshotHistory] saveScreenshotToHistory error:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 复制截图到指定目录
 */
export async function copyScreenshotToDirectory(
  buffer: Buffer,
  targetPath: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // 检查目标是否是目录还是文件路径
    const ext = extname(targetPath).toLowerCase()
    let finalPath = targetPath
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
      // 是目录，确保目录存在
      if (!existsSync(targetPath)) {
        mkdirSync(targetPath, { recursive: true })
      }
      const timestamp = Date.now()
      finalPath = join(targetPath, `screenshot_${timestamp}.png`)
    } else {
      // 是文件路径，确保父目录存在
      const dir = dirname(targetPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }

    const fs = await import('fs')
    fs.writeFileSync(finalPath, buffer)

    return { success: true, filePath: finalPath }
  } catch (error) {
    console.error('[ScreenshotHistory] copyScreenshotToDirectory error:', error)
    return { success: false, error: (error as Error).message }
  }
}

