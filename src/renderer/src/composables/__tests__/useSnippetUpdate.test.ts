/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return -- 测试域：mock 收型摩擦 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * B56-1 编辑器真相回流：防抖 flush 完成后必须把 DB 真相广播给订阅方
 * （Editor 据此 emit 给父级，消除「props 永远陈旧」的回滚/丢输入家族）。
 * 同时钉住 flush 语义：
 * - flushPendingContentWrites 立即排空该片段的待写队列（不等 500ms）
 * - 写失败保留队列条目（下轮重试），成功才出队
 * - 写入期间用户又键入（条目被替换）不误删新条目
 */

const updateSnippet = vi.fn(async (_id: string, _updates?: any) => undefined as any)
const getSnippetById = vi.fn(async (_id?: string) => null as any)

beforeEach(() => {
  updateSnippet.mockReset()
  getSnippetById.mockReset()
  ;(globalThis as unknown as { window: unknown }).window = {
    api: { snippet: { updateSnippet, getSnippetById } }
  }
})

import {
  addToUpdateContentQueue,
  flushPendingContentWrites,
  onSnippetSynced,
  enqueueContentsWrite
} from '../useSnippetUpdate'

const fullSnippet = (value: string) => ({
  id: 's1',
  contents: [{ id: 'c1', label: 'L', value, language: 'js' }]
})

describe('B56-1 flush 真相回流', () => {
  it('flushPendingContentWrites 立即排空队列（不等 500ms）并广播新对象', async () => {
    getSnippetById.mockResolvedValue(fullSnippet('typed') as any)
    updateSnippet.mockResolvedValue({ ...fullSnippet('typed'), updatedAt: 2 } as any)
    const seen: Array<{ id: string; updatedAt: number }> = []
    const off = onSnippetSynced((s) => seen.push({ id: s.id, updatedAt: s.updatedAt }))

    addToUpdateContentQueue('s1', 'c1', { value: 'typed' })
    await flushPendingContentWrites('s1')

    expect(updateSnippet).toHaveBeenCalledTimes(1)
    expect(seen).toEqual([{ id: 's1', updatedAt: 2 }])
    off()
  })

  it('写失败保留队列条目（flush 再次调用会重试），成功后才出队', async () => {
    getSnippetById.mockResolvedValue(fullSnippet('typed') as any)
    updateSnippet.mockRejectedValueOnce(new Error('db locked'))
    addToUpdateContentQueue('s1', 'c1', { value: 'typed' })
    await flushPendingContentWrites('s1')
    expect(updateSnippet).toHaveBeenCalledTimes(1)

    // 重试成功
    updateSnippet.mockResolvedValueOnce({ ...fullSnippet('typed') } as any)
    await flushPendingContentWrites('s1')
    expect(updateSnippet).toHaveBeenCalledTimes(2)
  })

  it('flush 执行期间键入替换条目：旧 flush 不误删新条目', async () => {
    // 在 flush 的 await 间隙模拟键入：条目被替换为 v2（latest-wins）
    getSnippetById.mockImplementation(async () => {
      addToUpdateContentQueue('s1', 'c1', { value: 'v2' })
      return fullSnippet('v1')
    })
    updateSnippet.mockResolvedValue(fullSnippet('v1') as any)

    addToUpdateContentQueue('s1', 'c1', { value: 'v1' })
    await flushPendingContentWrites('s1')
    // v1 flush 完成（写的是 flush 时读到的 v1），v2 条目存活不被误删
    expect(updateSnippet).toHaveBeenCalledTimes(1)

    await flushPendingContentWrites('s1')
    expect(updateSnippet).toHaveBeenCalledTimes(2)
    const last = updateSnippet.mock.calls.at(-1)![1] as { contents: Array<{ value: string }> }
    expect(last.contents[0]!.value).toBe('v2')
  })

  it('enqueueContentsWrite 结构写同样广播新对象（结构操作后 props 同步）', async () => {
    const fresh = {
      id: 's1',
      contents: [{ id: 'c2', label: '代码 2', value: '', language: 'plaintext' }]
    }
    updateSnippet.mockResolvedValue(fresh as any)
    const seen: string[] = []
    const off = onSnippetSynced((s) => seen.push(s.id))
    await enqueueContentsWrite('s1', [
      { id: 'c2', label: '代码 2', value: '', language: 'plaintext' }
    ])
    expect(seen).toEqual(['s1'])
    off()
  })

  it('片段已被删除（getSnippetById null）：安静出队，不写不广播', async () => {
    getSnippetById.mockResolvedValue(null as any)
    const seen: string[] = []
    const off = onSnippetSynced((s) => seen.push(s.id))
    addToUpdateContentQueue('s1', 'c1', { value: 'x' })
    await flushPendingContentWrites('s1')
    expect(updateSnippet).not.toHaveBeenCalled()
    expect(seen).toEqual([])
    off()
  })
})
