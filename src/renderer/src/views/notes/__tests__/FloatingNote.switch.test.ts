// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FloatingNote from '../FloatingNote.vue'

/**
 * FloatingNote 切换笔记丢字（B50）：selectNote 直接覆盖 title/content，
 * 不 flush 800ms 防抖 saveTimer——旧笔记的最后一笔编辑被静默丢弃。
 * 修复后：切换前先把挂着的防抖保存同步落账。
 */

const notes = [
  {
    id: 'n1',
    title: 'one',
    content: 'c1',
    folderId: null,
    isPinned: false,
    isDeleted: false,
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 'n2',
    title: 'two',
    content: 'c2',
    folderId: null,
    isPinned: false,
    isDeleted: false,
    createdAt: 2,
    updatedAt: 2
  }
]

const update = vi.fn(async (_id: string, _patch: Record<string, unknown>) => undefined)

beforeEach(() => {
  update.mockClear()
  // happy-dom 的 window 只注入 api 字段（整体替换会丢 Event 构造器，trigger 全废）
  ;(window as unknown as { api: unknown }).api = {
    notes: {
      list: vi.fn(async () => notes),
      get: vi.fn(async (id: string) => notes.find((n) => n.id === id) ?? null),
      create: vi.fn(async (row: { title: string; content: string }) => ({
        id: 'n3',
        ...row,
        folderId: null,
        isPinned: false,
        isDeleted: false,
        createdAt: 3,
        updatedAt: 3
      })),
      update
    },
    floatingNote: { hide: vi.fn(async () => undefined) }
  }
})

afterEach(() => {
  vi.useRealTimers()
})

const findSecondItem = async (wrapper: ReturnType<typeof mount>): Promise<void> => {
  await wrapper.find('.fn-list-toggle').trigger('mousedown')
  const items = wrapper.findAll('.fn-list-item')
  expect(items.length).toBe(2)
  await items[1]!.trigger('mousedown')
}

describe('FloatingNote 切换笔记前 flush 防抖保存（B50）', () => {
  it('800ms 防抖窗口内切走，旧笔记的最后一笔编辑被保存', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FloatingNote)
    await vi.advanceTimersByTimeAsync(0) // onMounted：拉列表 + 自动选中最近笔记 n2

    // 在当前笔记（n2，列表按 updatedAt 倒序）上打字（挂起 800ms 防抖）
    await wrapper.find('.fn-title-input').setValue('edited-but-not-saved')
    expect(update).not.toHaveBeenCalled()

    // 防抖未到就切到另一条（items[1] = n1）
    await findSecondItem(wrapper)
    // 挂着的保存被 flush：编辑落账到「旧的当前笔记」n2
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![0]).toBe('n2')
    expect(update.mock.calls[0]![1]).toMatchObject({ title: 'edited-but-not-saved' })

    // 切换后没有悬挂定时器把内容误写（原 bug：800ms 后把 n1 的内容写回 n1、
    // 而被编辑的内容永久丢失）
    await vi.advanceTimersByTimeAsync(1200)
    expect(update).toHaveBeenCalledTimes(1)
  })
})
