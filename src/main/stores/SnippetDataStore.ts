import {
  snippetRepository,
  type Snippet,
  type SnippetContent,
  type SnippetFilter
} from '../db/repos/SnippetRepository'

export type { Snippet, SnippetContent, SnippetFilter }

/**
 * SnippetDataStore — 5-7 纯转发层。
 *
 * 保留 `isDeleted: false` 默认行为（对齐旧 facade 的"默认隐藏已删除"语义）。
 */

export class SnippetDataStore {
  getSnippets(filters?: SnippetFilter): Snippet[] {
    const f: SnippetFilter = filters ? { isDeleted: false, ...filters } : { isDeleted: false }
    return snippetRepository.getSnippets(f)
  }

  /** 批3：分页列表（SnippetList 专用）。默认语义与 getSnippets 一致：排除回收站，显式 isDeleted 可覆盖 */
  listSnippets(
    filters: SnippetFilter | undefined,
    limit: number,
    offset: number
  ): { items: Snippet[]; total: number } {
    const f: SnippetFilter = filters ? { isDeleted: false, ...filters } : { isDeleted: false }
    return snippetRepository.listSnippets(f, limit, offset)
  }

  getSnippetById(id: string): Snippet | undefined {
    return snippetRepository.getSnippetById(id)
  }

  addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Snippet {
    return snippetRepository.addSnippet(snippet)
  }

  updateSnippet(id: string, updates: Partial<Snippet>): Snippet | undefined {
    return snippetRepository.updateSnippet(id, updates)
  }

  deleteSnippet(id: string): boolean {
    return snippetRepository.deleteSnippet(id)
  }

  permanentlyDeleteSnippet(id: string): boolean {
    return snippetRepository.permanentlyDeleteSnippet(id)
  }

  restoreSnippet(id: string): boolean {
    return snippetRepository.restoreSnippet(id)
  }

  getStatistics(): { total: number; trash: number } {
    return snippetRepository.getStatistics()
  }

  emptyTrash(): number {
    return snippetRepository.emptyTrash()
  }

  duplicateSnippet(id: string): Snippet | undefined {
    return snippetRepository.duplicateSnippet(id)
  }
}
