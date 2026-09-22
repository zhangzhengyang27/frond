/**
 * 文件夹树的数据层（代码片段侧边栏用）。
 *
 * 2026-09-22 恢复事故里这个文件的**头没了**（盘上只剩 updateFolder 那一截，逐字保留在下面）。
 * 其余按 `window.api.folder.*` 的既有通道重建——渲染端只有这里碰这组 IPC，
 * 所以通道清单本身就是行为规格：getFolders / getFolderTree / addFolder / updateFolder /
 * deleteFolder / updateFolderOrder(+canMoveFolder)。
 *
 * 状态放在模块级：多处 useFolders() 要看到同一份树，各自 ref 会出现「这边建了文件夹、
 * 那边列表不刷新」。
 */
import { ref } from 'vue'
import type { Folder } from '../../../preload/index.d'

/** 与主进程 FolderRepository 里的同形；不跨界 import——tsconfig.web 的 file list 不含 src/main */
type FolderWithChildren = Folder & { children: FolderWithChildren[] }

const folders = ref<Folder[]>([])
const folderTree = ref<FolderWithChildren[]>([])

export function useFolders() {
  async function loadFolders(): Promise<void> {
    folders.value = await window.api.folder.getFolders()
  }

  async function loadFolderTree(): Promise<void> {
    folderTree.value = await window.api.folder.getFolderTree()
  }

  /** 首次用到时拉一次；已有数据就复用（多个入口同时 setup 时不重复打 IPC） */
  let loaded = false
  async function ensureLoaded(): Promise<void> {
    if (loaded) return
    loaded = true
    await Promise.all([loadFolders(), loadFolderTree()])
  }
  void ensureLoaded()

  function findFolderById(id: string | null | undefined): Folder | undefined {
    if (!id) return undefined
    return folders.value.find((f) => f.id === id)
  }

  async function addFolder(input: {
    name: string
    parentId?: string | null
    icon?: string | null
    defaultLanguage?: string
  }): Promise<Folder | null> {
    try {
      const created = await window.api.folder.addFolder(input)
      await Promise.all([loadFolders(), loadFolderTree()])
      return created
    } catch (error) {
      console.error('新建文件夹失败:', error)
      return null
    }
  }

  /**
   * 更新文件夹
   */
  async function updateFolder(
    id: string,
    updates: Partial<{
      name: string
      parentId: string | null
      icon: string | null
      defaultLanguage: string
      isOpen: boolean
    }>
  ): Promise<boolean> {
    try {
      await window.api.folder.updateFolder(id, updates)
      await loadFolderTree()
      await loadFolders()
      return true
    } catch (error) {
      console.error('更新文件夹失败:', error)
      return false
    }
  }

  async function deleteFolder(id: string): Promise<boolean> {
    try {
      const ok = await window.api.folder.deleteFolder(id)
      if (ok) await Promise.all([loadFolders(), loadFolderTree()])
      return ok
    } catch (error) {
      console.error('删除文件夹失败:', error)
      return false
    }
  }

  /**
   * 移动到某个父级并重排。能不能移由主进程判（防环：不能把父目录挪进自己的子树），
   * 这里只把它的答案原样传出去，不在渲染端另算一套规则。
   */
  async function moveFolder(
    folderId: string,
    newParentId: string | null,
    newOrderIndex: number
  ): Promise<boolean> {
    try {
      if (!(await window.api.folder.canMoveFolder(folderId, newParentId))) return false
      await window.api.folder.updateFolderOrder(folderId, newParentId, newOrderIndex)
      await Promise.all([loadFolders(), loadFolderTree()])
      return true
    } catch (error) {
      console.error('移动文件夹失败:', error)
      return false
    }
  }

  return {
    folders,
    folderTree,
    loadFolders,
    loadFolderTree,
    findFolderById,
    addFolder,
    updateFolder,
    deleteFolder,
    moveFolder
  }
}
