import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type { Tag } from '../../../preload/index.d'

/**
 * 标签数据层（片段编辑器/列表共用）。
 *
 * 2026-09-22 恢复事故里只剩签名与 return —— 那份签名就是规格，实现照
 * `window.api.tag.*` 的既有通道重建。状态放模块级：编辑器要按 id 解析标签、
 * 标签管理面板会新增/删除，各自一份 ref 就会出现「这边建了标签，那边还显示旧列表」。
 */
const tags: ShallowRef<Tag[]> = shallowRef([])
const isLoading: Ref<boolean> = ref(false)

export function useTags(): {
  tags: ShallowRef<Tag[]>
  isLoading: Ref<boolean>
  getTags: () => Promise<void>
  addTag: (name: string) => Promise<Tag | undefined>
  deleteTag: (id: string) => Promise<boolean>
  getTagsByIds: (ids: string[]) => Promise<Tag[]>
} {
  async function getTags(): Promise<void> {
    isLoading.value = true
    try {
      tags.value = await window.api.tag.getTags()
    } catch (error) {
      console.error('获取标签失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function addTag(name: string): Promise<Tag | undefined> {
    try {
      const created = await window.api.tag.addTag(name)
      await getTags()
      return created
    } catch (error) {
      console.error('新增标签失败:', error)
      return undefined
    }
  }

  async function deleteTag(id: string): Promise<boolean> {
    try {
      const ok = await window.api.tag.deleteTag(id)
      if (ok) tags.value = tags.value.filter((t) => t.id !== id)
      return ok
    } catch (error) {
      console.error('删除标签失败:', error)
      return false
    }
  }

  /**
   * 按 id 批量取标签：直接问主进程，不读这份缓存 ——
   * 编辑器打开的片段可能带着本会话刚建的标签，缓存没跟上就会少显示几个。
   */
  async function getTagsByIds(ids: string[]): Promise<Tag[]> {
    if (ids.length === 0) return []
    try {
      return await window.api.tag.getTagsByIds(ids)
    } catch (error) {
      console.error('按 id 获取标签失败:', error)
      return []
    }
  }

  return {
    tags,
    isLoading,
    getTags,
    addTag,
    deleteTag,
    getTagsByIds
  }
}
