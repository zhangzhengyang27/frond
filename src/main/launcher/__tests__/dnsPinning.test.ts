import { describe, it, expect } from 'vitest'
import { createPinningLookup, type DnsResolver, type LookupAddress } from '../dnsPinning'

/**
 * V4 审查 I3：DNS 钉住 lookup（重绑定防御核心，注入 resolver 纯测）。
 */
function makeCallback(): {
  result: { err: NodeJS.ErrnoException | null; address?: string | LookupAddress[]; family?: number }
  fn: (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number
  ) => void
} {
  const result: {
    err: NodeJS.ErrnoException | null
    address?: string | LookupAddress[]
    family?: number
  } = {
    err: null
  }
  return {
    result,
    fn: (err, address, family) => {
      result.err = err
      result.address = address
      result.family = family
    }
  }
}

const rec = (address: string, family = 4): { address: string; family: number } => ({
  address,
  family
})

describe('createPinningLookup', () => {
  it('公网解析 → 返回该地址', async () => {
    const resolver: DnsResolver = async () => [rec('93.184.216.34')]
    const lookup = createPinningLookup(resolver)
    const { result, fn } = makeCallback()
    lookup('example.com', {}, fn)
    await new Promise((r) => setTimeout(r, 0))
    expect(result.err).toBeNull()
    const rows = result.address as LookupAddress[]
    expect(rows.map((r) => r.address)).toEqual(['93.184.216.34'])
  })

  it('全部命中内网 → ELEAF_BLOCKED_LOCAL（重绑定在此被拦下）', async () => {
    const resolver: DnsResolver = async () => [rec('127.0.0.1'), rec('10.0.0.5')]
    const lookup = createPinningLookup(resolver)
    const { result, fn } = makeCallback()
    lookup('evil.com', {}, fn)
    await new Promise((r) => setTimeout(r, 0))
    expect(result.err?.code).toBe('ELEAF_BLOCKED_LOCAL')
    // 阻断时交给连接层的是空列表（无地址可连）
    expect(result.address).toEqual([])
  })

  it('混合记录 → 剔除内网项，只把公网记录交给连接层', async () => {
    const resolver: DnsResolver = async () => [rec('10.0.0.5'), rec('93.184.216.34')]
    const lookup = createPinningLookup(resolver)
    const { result, fn } = makeCallback()
    lookup('mixed.com', {}, fn)
    await new Promise((r) => setTimeout(r, 0))
    expect(result.err).toBeNull()
    const rows = result.address as LookupAddress[]
    expect(rows.map((r) => r.address)).toEqual(['93.184.216.34'])
  })

  it('IPv6 内网（::1 / fe80）同样拒绝', async () => {
    const resolver: DnsResolver = async () => [rec('::1', 6)]
    const lookup = createPinningLookup(resolver)
    const { result, fn } = makeCallback()
    lookup('v6.evil.com', {}, fn)
    await new Promise((r) => setTimeout(r, 0))
    expect(result.err?.code).toBe('ELEAF_BLOCKED_LOCAL')
  })

  it('family 过滤：请求 v4 而解析只有 v6 → 阻断', async () => {
    const resolver: DnsResolver = async () => [rec('fd00::1', 6)]
    const lookup = createPinningLookup(resolver)
    const { result, fn } = makeCallback()
    lookup('example.com', { family: 4 }, fn)
    await new Promise((r) => setTimeout(r, 0))
    expect(result.err?.code).toBe('ELEAF_BLOCKED_LOCAL')
  })

  it('解析失败 → 原样回调错误（fail closed）', async () => {
    const resolver: DnsResolver = async () => {
      throw new Error('ENOTFOUND')
    }
    const lookup = createPinningLookup(resolver)
    const { result, fn } = makeCallback()
    lookup('nope.com', {}, fn)
    await new Promise((r) => setTimeout(r, 0))
    expect(result.err?.message).toBe('ENOTFOUND')
  })
})

