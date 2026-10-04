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

const listSnippets = vi.fn(
  (req: Record<string, unknown>) => {
    lastReq = req
    return Promise.resolve({ items: [], total: 0 })
  }
)

beforeEach(() => {
  lastReq = null
  ;(window as unknown as { api: unknown }).api = {
    snippet: { listSnippets },
    folder: { getFolders: vi.fn(async () => []), getFolderTree: vi.fn(async () => []) }
  }
})

const mountList = (libraryFilter: 'inbox' | 'all' | 'favorites' | 'trash'): ReturnType<typeof mount> =>
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
