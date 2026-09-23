/**
 * Frond · Notes IPC 处理器
 *
 * 轻量笔记的渲染端 ↔ 主进程通信层。
 */
import { notesRepository } from '../db/repos/NotesRepository'
import { typedHandle } from './typedIpc'

export function registerNotesIpc(): void {
  // 笔记列表
  typedHandle('notes:list', (_e, { filter }) => notesRepository.getNotes(filter))

  // 单条笔记
  typedHandle('notes:get', (_e, { id }) => notesRepository.getNoteById(id) ?? null)

  // 新建笔记
  typedHandle('notes:create', (_e, data) => notesRepository.addNote(data))

  // 更新笔记：白名单逐字段收窄，未登记的键（含渲染端误传）一律不进 SQL
  typedHandle('notes:update', (_e, { id, updates }) =>
    notesRepository.updateNote(id, {
      title: typeof updates.title === 'string' ? updates.title : undefined,
      content: typeof updates.content === 'string' ? updates.content : undefined,
      folderId: updates.folderId !== undefined ? (updates.folderId as string | null) : undefined,
      isPinned: typeof updates.isPinned === 'boolean' ? updates.isPinned : undefined
    })
  )

  // 软删除（回收站）
  typedHandle('notes:trash', (_e, { id }) => notesRepository.trashNote(id))

  // 恢复
  typedHandle('notes:restore', (_e, { id }) => notesRepository.restoreNote(id))

  // 永久删除
  typedHandle('notes:delete', (_e, { id }) => notesRepository.permanentlyDeleteNote(id))

  // 清空回收站
  typedHandle('notes:emptyTrash', () => notesRepository.emptyTrash())

  // 切换置顶
  typedHandle('notes:togglePin', (_e, { id }) => notesRepository.togglePin(id))

  // 统计
  typedHandle('notes:stats', () => notesRepository.getStatistics())

  // 文件夹列表
  typedHandle('notes:folders', () => notesRepository.getFolders())

  // 新建文件夹
  typedHandle('notes:createFolder', (_e, { name }) => notesRepository.addFolder(name))

  // 重命名文件夹
  typedHandle('notes:renameFolder', (_e, { id, name }) => notesRepository.updateFolder(id, name))

  // 删除文件夹
  typedHandle('notes:deleteFolder', (_e, { id }) => notesRepository.deleteFolder(id))
}
