import { showSaveDialogFor } from '../modules/dialogs'
import { grantRecordingSavePath } from './recordingSavePathGrants'
import { typedHandle, typedHandleLogged } from './typedIpc'
import type { FolderDataStore } from '../stores/FolderDataStore'
import type { BrowserWindow } from 'electron'

export function registerFoldersIpcHandlers(
  folderStore: FolderDataStore,
  getMainWindow?: () => BrowserWindow | null
): void {
  // 通用「另存为」对话框：导出类写盘通道（如录制导出）的路径由此签发，
  // 渲染端回传后再经 resolveGrantedRecordingPath 校验（写盘路径必须主进程签发）
  typedHandle('folder:selectSavePath', async (_event, req) => {
    const options = req ?? {}
    const result = await showSaveDialogFor(getMainWindow?.() ?? null, {
      title: '选择保存位置',
      defaultPath: typeof options.defaultName === 'string' ? options.defaultName : undefined,
      filters:
        Array.isArray(options.filters) && options.filters.length > 0
          ? (options.filters as { name: string; extensions: string[] }[])
          : undefined
    })
    if (result.canceled || !result.filePath) return null
    grantRecordingSavePath(result.filePath)
    return result.filePath
  })

  // 获取所有文件夹
  typedHandleLogged('folder:getFolders', () => folderStore.getAllFolders())

  // 获取文件夹树结构
  typedHandleLogged('folder:getFolderTree', () => folderStore.getFolderTree())

  // 根据 ID 获取文件夹
  typedHandleLogged('folder:getFolderById', (_event, { id }) => {
    if (!id || typeof id !== 'string') {
      throw new Error('无效的文件夹 ID')
    }
    return folderStore.getFolderById(id)
  })

  // 根据父文件夹 ID 获取子文件夹
  typedHandleLogged('folder:getFoldersByParentId', (_event, { parentId }) =>
    folderStore.getFoldersByParentId(parentId)
  )

  // 创建文件夹
  typedHandleLogged('folder:addFolder', (_event, folder) => {
    if (!folder.name || !folder.name.trim()) {
      throw new Error('文件夹名称不能为空')
    }
    return folderStore.addFolder({
      name: folder.name.trim(),
      parentId: folder.parentId ?? null,
      icon: folder.icon ?? null,
      defaultLanguage: folder.defaultLanguage ?? 'plaintext',
      isOpen: folder.isOpen ?? false,
      orderIndex: 0 // 会被自动计算
    })
  })

  // 更新文件夹
  typedHandleLogged('folder:updateFolder', (_event, { id, updates }) => {
    if (!id || typeof id !== 'string') {
      throw new Error('无效的文件夹 ID')
    }
    return folderStore.updateFolder(id, updates)
  })

  // 删除文件夹
  typedHandleLogged('folder:deleteFolder', (_event, { id }) => {
    if (!id || typeof id !== 'string') {
      throw new Error('无效的文件夹 ID')
    }
    return folderStore.deleteFolder(id)
  })

  // 更新文件夹顺序
  typedHandleLogged(
    'folder:updateFolderOrder',
    (_event, { folderId, newParentId, newOrderIndex }) => {
      if (!folderId || typeof folderId !== 'string') {
        throw new Error('无效的文件夹 ID')
      }
      folderStore.updateFolderOrder(folderId, newParentId, newOrderIndex)
      return true
    }
  )

  // 检查是否可以移动文件夹
  typedHandleLogged('folder:canMoveFolder', (_event, { folderId, targetParentId }) =>
    folderStore.canMoveFolder(folderId, targetParentId)
  )
}
