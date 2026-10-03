// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SnippetList from '../SnippetList.vue'

/**
 * SnippetList 加载竞态（B50）：loadSnippets 无请求序号——切换文件夹/搜索词后，
 * 慢的旧 IPC 响应晚到会把旧过滤条件的结果覆盖/拼进新列表。
 * 修复后：过期响应一律丢弃（useAsyncGuard 轮次守卫）。
 */

let deferreds: Array<{ id: string; resolve: (v: unknown) => void }> = []

const listSnippets = vi.fn(
  (_req: unknown, _limit?: number, _offset?: number) =>
    new Promise<unknown>((resolve) => {
      deferreds.push({ id: JSON.stringify(_req), resolve })
    })
)

const snippet = (id: string) =>
  ({
    id,
    name: id,
    folderId: null,
    contents: [],
    tags: [],
    isDeleted: false,
    isFavorites: false,
    createdAt: 1,
    updatedAt: 1
  }) as never

beforeEach(() => {
  deferreds = []
  ;(window as unknown as { api: unknown }).api = {
    snippet: { listSnippets },
    folder: {
      getFolders: vi.fn(async () => []),
      getFolderTree: vi.fn(async () => [])
    }
  }
})

const mountList = (): ReturnType<typeof mount> =>
  mount(SnippetList, {
    props: {
      selectedSnippet: null,
      searchQuery: '',
      folderId: null,
      libraryFilter: 'all' as const,
      folders: []
    }
  })

describe('SnippetList 乱序响应防护（B50）', () => {
  it('慢的旧响应晚到，不覆盖新过滤条件的列表', async () => {
    const wrapper = mountList()
    await Promise.resolve() // onMounted 的首拉发出
    expect(listSnippets).toHaveBeenCalledTimes(1)

    // 切换文件夹 → 第二次拉取在飞
    await wrapper.setProps({ folderId: 'f2' })
    expect(listSnippets).toHaveBeenCalledTimes(2)

    // 新响应先回（f2 文件夹：b-new）
    deferreds[1]!.resolve({ items: [snippet('b-new')], total: 1 })
    await Promise.resolve()
    await Promise.resolve()
    expect(wrapper.html()).toContain('b-new')

    // 旧响应（无条件：a-stale）后到：必须整体丢弃，不得覆盖也不得拼尾
    deferreds[0]!.resolve({ items: [snippet('a-stale')], total: 1 })
    await Promise.resolve()
    await Promise.resolve()
    expect(wrapper.html()).not.toContain('a-stale')
    expect(wrapper.html()).toContain('b-new')
  })
})
