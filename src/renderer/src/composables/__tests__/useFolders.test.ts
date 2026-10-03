import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * useFolders「只拉一次」守卫（B50a）：
 * `let loaded = false` 曾写在 useFolders() 函数体内——每次调用都重置，
 * 与注释意图相反，每个组件 setup 都重拉 getFolders + getFolderTree。
 * 修复后 loaded 提升到模块级，与模块级 folders/folderTree 状态同寿命。
 */

const getFolders = vi.fn(async () => [])
const getFolderTree = vi.fn(async () => [])

beforeEach(() => {
  getFolders.mockClear()
  getFolderTree.mockClear()
  ;(globalThis as unknown as { window: unknown }).window = {
    api: { folder: { getFolders, getFolderTree } }
  }
})

describe('useFolders 数据只拉一次', () => {
  it('多个入口先后 setup，IPC 只打一次', async () => {
    const { useFolders } = await import('../useFolders')
    useFolders()
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 5; i++) await Promise.resolve()
    }
    await flush()
    useFolders()
    await flush()
    expect(getFolders).toHaveBeenCalledTimes(1)
    expect(getFolderTree).toHaveBeenCalledTimes(1)
  })
})
