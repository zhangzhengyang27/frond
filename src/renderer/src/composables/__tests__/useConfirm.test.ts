import { describe, it, expect } from 'vitest'
import { confirm, resolveConfirm, useConfirm } from '../useConfirm'

describe('useConfirm', () => {
  it('resolveConfirm(true) 兑现 promise 为 true', async () => {
    const p = confirm({ title: '删除？', danger: true })
    resolveConfirm(true)
    await expect(p).resolves.toBe(true)
  })

  it('resolveConfirm(false) 兑现为 false', async () => {
    const p = confirm({ title: '清空？' })
    resolveConfirm(false)
    await expect(p).resolves.toBe(false)
  })

  it('后到覆盖先到：先到的立即以 false 兑现', async () => {
    const first = confirm({ title: '第一个' })
    const second = confirm({ title: '第二个' })
    await expect(first).resolves.toBe(false)
    resolveConfirm(true)
    await expect(second).resolves.toBe(true)
  })

  it('useConfirm 暴露当前 pending（ComputedRef）供 Provider 渲染', async () => {
    const api = useConfirm()
    const p = confirm({ title: '标题', message: '正文', confirmText: '删除' })
    expect(api.pending.value?.title).toBe('标题')
    expect(api.pending.value?.message).toBe('正文')
    expect(api.pending.value?.confirmText).toBe('删除')
    resolveConfirm(false)
    await expect(p).resolves.toBe(false)
  })

  it('resolve 后 pending 变 undefined（Provider 可响应收起）', async () => {
    const api = useConfirm()
    const p = confirm({ title: 'x' })
    expect(api.pending.value).toBeDefined()
    resolveConfirm(true)
    await expect(p).resolves.toBe(true)
    expect(api.pending.value).toBeUndefined()
  })
})
