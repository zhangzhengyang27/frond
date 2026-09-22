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
