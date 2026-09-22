/**
 * Leaf · 回收站管理服务（阶段3.3c）
 *
 * macOS 下管理 ~/.Trash：列出内容、清空、恢复文件。
 * 删除/恢复的目标路径必须在回收站内（containment 校验），
 * 渲染端传入的任意路径一律拒绝——rm 是递归强删，不能放行。
 */
import * as fs from 'fs'
import * as path from 'path'
import { app, shell } from 'electron'

export interface TrashItem {
  /** 文件名 */
  name: string
  /** 完整路径 */
  path: string
  /** 文件大小（字节） */
  size: number
  /** 删除时间（如果可用） */
  deletedAt?: number
  /** 类型：file / folder */
  type: 'file' | 'folder'
}

/** 获取回收站路径 */
function getTrashPath(): string {
  return path.join(app.getPath('home'), '.Trash')
}

/**
 * containment 校验：路径必须真实存在于回收站内部（符号链接解析后判定）。
 * `rel !== ''` 排除回收站目录本身（rm 不得指向 trash 根）。
 */
function isInsideTrash(itemPath: unknown): boolean {
  if (typeof itemPath !== 'string' || itemPath.length === 0) return false
  try {
    const trashReal = fs.realpathSync(getTrashPath())
    const itemReal = fs.realpathSync(itemPath)
    const rel = path.relative(trashReal, itemReal)
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  } catch {
    return false
  }
}

/** 列出回收站内容 */
export async function listTrash(): Promise<TrashItem[]> {
  const trashPath = getTrashPath()
  try {
    if (!fs.existsSync(trashPath)) return []
    const files = fs.readdirSync(trashPath)
    const items: TrashItem[] = []
    for (const name of files) {
      // 跳过 .DS_Store 等隐藏文件
      if (name.startsWith('.')) continue
      const fullPath = path.join(trashPath, name)
      try {
        const stat = fs.statSync(fullPath)
        items.push({
          name,
          path: fullPath,
          size: stat.size,
          deletedAt: stat.birthtimeMs,
          type: stat.isDirectory() ? 'folder' : 'file'
        })
      } catch {
        /* 跳过无法访问的文件 */
      }
    }
    // 按删除时间倒序
    return items.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  } catch (err) {
    console.warn('[TrashService] listTrash failed:', err)
    return []
  }
}

/** 清空回收站 */
export async function emptyTrash(): Promise<boolean> {
  try {
    const trashPath = getTrashPath()
    const files = fs.readdirSync(trashPath)
    for (const name of files) {
      if (name.startsWith('.')) continue
      const fullPath = path.join(trashPath, name)
      try {
        fs.rmSync(fullPath, { recursive: true, force: true })
      } catch (err) {
        console.warn(`[TrashService] failed to delete ${name}:`, err)
      }
    }
    return true
  } catch (err) {
    console.warn('[TrashService] emptyTrash failed:', err)
    return false
  }
}

/** 恢复文件到原位置（macOS 没有简单的原位置记录，这里恢复到桌面） */
export async function restoreItem(itemPath: string): Promise<boolean> {
  if (!isInsideTrash(itemPath)) {
    console.warn('[TrashService] restoreItem rejected path outside trash:', itemPath)
    return false
  }
  try {
    const name = path.basename(itemPath)
    const desktopPath = path.join(app.getPath('home'), 'Desktop')
    const destPath = path.join(desktopPath, name)
    // 如果目标已存在，加后缀
    let finalDest = destPath
    let counter = 1
    while (fs.existsSync(finalDest)) {
      const ext = path.extname(name)
      const base = path.basename(name, ext)
      finalDest = path.join(desktopPath, `${base} (恢复 ${counter})${ext}`)
      counter++
    }
    fs.renameSync(itemPath, finalDest)
    return true
  } catch (err) {
    console.warn('[TrashService] restoreItem failed:', err)
    return false
  }
}

/** 永久删除单个文件 */
export async function deleteItem(itemPath: string): Promise<boolean> {
  if (!isInsideTrash(itemPath)) {
    console.warn('[TrashService] deleteItem rejected path outside trash:', itemPath)
    return false
  }
  try {
    fs.rmSync(itemPath, { recursive: true, force: true })
    return true
  } catch (err) {
    console.warn('[TrashService] deleteItem failed:', err)
    return false
  }
}

/** 在 Finder 中显示回收站 */
export async function openTrashInFinder(): Promise<void> {
  try {
    await shell.openPath(getTrashPath())
  } catch (err) {
    console.warn('[TrashService] openTrashInFinder failed:', err)
  }
}

/** 注册回收站 IPC */
export function registerTrashIpc(ipcMain: typeof import('electron').ipcMain): void {
  ipcMain.handle('trash:list', async () => listTrash())
  ipcMain.handle('trash:empty', async () => emptyTrash())
  ipcMain.handle('trash:restore', async (_e, itemPath: string) =>
    restoreItem(String(itemPath ?? ''))
  )
  ipcMain.handle('trash:delete', async (_e, itemPath: string) => deleteItem(String(itemPath ?? '')))
  ipcMain.handle('trash:open', async () => {
    await openTrashInFinder()
    return true
  })
}
