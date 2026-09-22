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

  /**
   * 删除文件夹
