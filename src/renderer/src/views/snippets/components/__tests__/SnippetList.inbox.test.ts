// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SnippetList from '../SnippetList.vue'

/**
 * B56-2 回归钉：收件箱视图必须显式传 folderId: null——此前 `?? undefined`
 * 把 null 抹成 undefined，主进程的 folder_id IS NULL 过滤永不生效，
 * 「收件箱」视图与「全部」完全相同（模块默认视图即错）。
 */

let lastReq: Record<string, unknown> | null = null

/* eslint-disable @typescript-eslint/no-explicit-any -- 测试域 mock 收型 */
const listSnippets = vi.fn((req: Record<string, unknown>): Promise<any> => {
  lastReq = req
  return Promise.resolve({ items: [], total: 0 })
})

beforeEach(() => {
  lastReq = null
  ;(window as unknown as { api: unknown }).api = {
    snippet: { listSnippets },
    folder: { getFolders: vi.fn(async () => []), getFolderTree: vi.fn(async () => []) }
  }
})

const mountList = (
  libraryFilter: 'inbox' | 'all' | 'favorites' | 'trash'
): ReturnType<typeof mount> =>
  mount(SnippetList, {
    props: {
      selectedSnippet: null,
      searchQuery: '',
      folderId: null,
      libraryFilter,
      folders: []
    }
  })

describe('收件箱过滤契约（B56-2）', () => {
  it('inbox 视图：folderId 显式为 null 且 isInbox=true', async () => {
    const w = mountList('inbox')
    await Promise.resolve()
    await Promise.resolve()
    expect(lastReq).toMatchObject({ folderId: null, isInbox: true, isDeleted: false })
    w.unmount()
  })

  it('all 视图：folderId/isInbox 均为 undefined（不参与过滤）', async () => {
    const w = mountList('all')
    await Promise.resolve()
    await Promise.resolve()
    expect(lastReq).toMatchObject({ isDeleted: false })
    expect(lastReq!.folderId).toBeUndefined()
    expect(lastReq!.isInbox).toBeUndefined()
    w.unmount()
  })

  it('favorites 视图：isFavorites=true 且 folderId undefined', async () => {
    const w = mountList('favorites')
    await Promise.resolve()
    await Promise.resolve()
    expect(lastReq).toMatchObject({ isFavorites: true, isDeleted: false })
    expect(lastReq!.folderId).toBeUndefined()
    w.unmount()
  })
})

describe('列表键盘导航（B56 键盘）', () => {
  const items = [
    {
      id: 'a',
      name: '第一',
      description: '',
      language: 'js',
      contents: [{ id: 'ca', label: 'l', value: 'A', language: 'js' }],
      folderId: null,
      isDeleted: false,
      isFavorites: false,
      createdAt: 1,
      updatedAt: 1
    },
    {
      id: 'b',
      name: '第二',
      description: '',
      language: 'js',
      contents: [{ id: 'cb', label: 'l', value: 'B', language: 'js' }],
      folderId: null,
      isDeleted: false,
      isFavorites: false,
      createdAt: 2,
      updatedAt: 2
    },
    {
      id: 'c',
      name: '第三',
      description: '',
      language: 'js',
      contents: [{ id: 'cc', label: 'l', value: 'C', language: 'js' }],
      folderId: null,
      isDeleted: false,
      isFavorites: false,
      createdAt: 3,
      updatedAt: 3
    }
  ]
  const press = (w: ReturnType<typeof mount>, key: string): Promise<void> =>
    w.find('.min-h-0.flex-1').trigger('keydown', { key })

  it('ArrowDown 依次选择下一项，ArrowUp 返回', async () => {
    listSnippets.mockResolvedValueOnce({ items, total: 3 })
    const w = mountList('all')
    await new Promise((r) => setTimeout(r, 0))
    // 镜像真实父级行为：emit 回写 props（否则每次按键都从无选中起算）
    const sync = async (): Promise<void> => {
      const last = w.emitted('update:selectedSnippet')!.at(-1)![0] as { id: string }
      await w.setProps({ selectedSnippet: last as never })
    }
    await press(w, 'ArrowDown')
    await sync()
    expect(w.emitted('update:selectedSnippet')!.at(-1)![0]).toMatchObject({ id: 'a' })
    await press(w, 'ArrowDown')
    await sync()
    expect(w.emitted('update:selectedSnippet')!.at(-1)![0]).toMatchObject({ id: 'b' })
    await press(w, 'ArrowUp')
    await sync()
    expect(w.emitted('update:selectedSnippet')!.at(-1)![0]).toMatchObject({ id: 'a' })
    w.unmount()
  })

  it('Enter 复制当前选中项的首个内容', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })
    listSnippets.mockResolvedValueOnce({ items, total: 3 })
    const w = mountList('all')
    await new Promise((r) => setTimeout(r, 0))
    await press(w, 'ArrowDown')
    const last = w.emitted('update:selectedSnippet')!.at(-1)![0] as never
    await w.setProps({ selectedSnippet: last })
    await press(w, 'Enter')
    expect(writeText).toHaveBeenCalledWith('A')
    w.unmount()
  })

  it('焦点在输入框时按键不抢（搜索框正常打字）', async () => {
    listSnippets.mockResolvedValueOnce({ items, total: 3 })
    const w = mountList('all')
    await new Promise((r) => setTimeout(r, 0))
    await w.find('input[type="text"]').trigger('keydown', { key: 'ArrowDown' })
    expect(w.emitted('update:selectedSnippet')).toBeUndefined()
    w.unmount()
  })
})
