import {
  folderRepository,
  type Folder,
  type FolderWithChildren
} from '../db/repos/FolderRepository'

export type { Folder, FolderWithChildren }

/**
 * FolderDataStore — 5-7 纯转发层。
 */

export class FolderDataStore {
  getAllFolders(): Folder[] {
    return folderRepository.getAllFolders()
  }

  getFolderById(id: string): Folder | undefined {
    return folderRepository.getFolderById(id)
  }

  getFoldersByParentId(parentId: string | null): Folder[] {
    return folderRepository.getFoldersByParentId(parentId)
  }

  getFolderTree(): FolderWithChildren[] {
    return folderRepository.getFolderTree()
  }

  getAllSubfolderIds(folderId: string): string[] {
    return folderRepository.getAllSubfolderIds(folderId)
  }

  addFolder(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Folder {
    return folderRepository.addFolder(folder)
  }

  updateFolder(id: string, updates: Partial<Folder>): Folder | undefined {
    return folderRepository.updateFolder(id, updates)
  }

  deleteFolder(id: string): boolean {
    return folderRepository.deleteFolder(id)
  }

  updateFolderOrder(folderId: string, newParentId: string | null, newOrderIndex: number): void {
    folderRepository.updateFolderOrder(folderId, newParentId, newOrderIndex)
  }

  canMoveFolder(folderId: string, targetParentId: string | null): boolean {
    if (targetParentId === null) return true
    if (folderId === targetParentId) return false
    const subs = folderRepository.getAllSubfolderIds(folderId)
    return !subs.includes(targetParentId)
  }
}
