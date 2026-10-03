import { describe, it, expect } from 'vitest'
import { useAsyncGuard } from '../useAsyncGuard'

/**
 * useAsyncGuard（B50）：异步回写的竞态守卫原语。
 * 契约：begin() 领取本轮 token；期间再有 begin()，旧 token 立即过期；
 * isCurrent(旧token) = false → 过期请求的回写一律丢弃。
 */
describe('useAsyncGuard', () => {
  it('新 token 在无并发时是当前轮', () => {
    const guard = useAsyncGuard()
    const t = guard.begin()
    expect(guard.isCurrent(t)).toBe(true)
  })

  it('并发 begin 后旧 token 过期（慢响应不得覆盖新状态）', () => {
    const guard = useAsyncGuard()
    const old = guard.begin()
    const fresh = guard.begin()
    expect(guard.isCurrent(old)).toBe(false)
    expect(guard.isCurrent(fresh)).toBe(true)
  })

  it('多次 begin 后只有最后一个 token 是当前轮', () => {
    const guard = useAsyncGuard()
    guard.begin()
    guard.begin()
    const last = guard.begin()
    expect(guard.isCurrent(last)).toBe(true)
  })

  it('实例之间互不干扰（各自独立计数）', () => {
    const a = useAsyncGuard()
    const b = useAsyncGuard()
    const ta = a.begin()
    b.begin()
    expect(a.isCurrent(ta)).toBe(true)
  })
})
