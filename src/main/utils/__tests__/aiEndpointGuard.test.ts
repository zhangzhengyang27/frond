import { describe, it, expect } from 'vitest'
import { assertAiEndpointAllowed, type LookupFn } from '../aiEndpointGuard'

/**
 * AI 端点守卫：baseUrl 由用户/渲染端可写，主进程发请求时会带上
 * Authorization 头——必须防止把凭据请求打进元数据等高危地址。
 *
 * 信任模型与插件 fetch 不同：AI baseUrl 是用户自配（Ollama / LM Studio
 * 的 loopback、局域网端点是合法场景），因此放行 loopback / lan，
 * 只硬阻断元数据、链路本地、保留段，并拒绝非 http(s) 与内嵌凭据。
 */
const noopLookup: LookupFn = async () => []
// 公网域名的 stub 解析结果
const publicLookup: LookupFn = async (host) => [
  { address: host === 'api.deepseek.com' ? '104.18.22.31' : '93.184.216.34', family: 4 }
]

describe('assertAiEndpointAllowed', () => {
  it('合法的公网 https 端点放行', async () => {
    expect(await assertAiEndpointAllowed('https://api.openai.com/v1', publicLookup)).toEqual({
      ok: true
    })
    expect(await assertAiEndpointAllowed('https://api.deepseek.com', publicLookup)).toEqual({
      ok: true
    })
  })

  it('本地模型端点放行（Ollama / LM Studio）', async () => {
    expect(await assertAiEndpointAllowed('http://127.0.0.1:11434', noopLookup)).toEqual({
      ok: true
    })
    expect(await assertAiEndpointAllowed('http://localhost:1234/v1', noopLookup)).toEqual({
      ok: true
    })
    expect(await assertAiEndpointAllowed('http://192.168.1.10:1234/v1', noopLookup)).toEqual({
      ok: true
    })
  })

  it('非 http(s) 协议拒绝', async () => {
    for (const url of ['ftp://api.example.com', 'file:///etc/passwd', 'gopher://x.com']) {
      expect((await assertAiEndpointAllowed(url, noopLookup)).ok).toBe(false)
    }
  })

  it('元数据 / 高危地址字面量拒绝', async () => {
    for (const host of [
      '169.254.169.254',
      '0.0.0.0',
      '100.64.0.1',
      '224.0.0.1',
      '[fe80::1]',
      '[::]'
    ]) {
      expect(
        await assertAiEndpointAllowed(`http://${host}/v1`, noopLookup),
        `${host} 应被拒绝`
      ).toEqual({ ok: false, reason: expect.stringContaining('受限') })
    }
  })

  it('URL 内嵌凭据拒绝（Authorization 之外的泄露面）', async () => {
    expect((await assertAiEndpointAllowed('http://user:pass@api.example.com', noopLookup)).ok).toBe(
      false
    )
  })

  it('域名解析到受限地址拒绝（防 DNS rebinding）', async () => {
    const evilLookup: LookupFn = async () => [{ address: '169.254.169.254', family: 4 }]
    expect((await assertAiEndpointAllowed('https://evil.example', evilLookup)).ok).toBe(false)
  })

  it('域名解析到多个地址时任一命中即拒绝', async () => {
    const mixedLookup: LookupFn = async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '169.254.169.254', family: 4 }
    ]
    expect((await assertAiEndpointAllowed('https://mixed.example', mixedLookup)).ok).toBe(false)
  })

  it('正常域名解析到公网地址放行', async () => {
    const okLookup: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }]
    expect(await assertAiEndpointAllowed('https://example.com', okLookup)).toEqual({ ok: true })
  })

  it('DNS 解析失败 fail closed', async () => {
    const badLookup: LookupFn = async () => {
      throw new Error('ENOTFOUND')
    }
    expect((await assertAiEndpointAllowed('https://nope.example', badLookup)).ok).toBe(false)
  })

  it('无法解析的 URL 拒绝', async () => {
    expect((await assertAiEndpointAllowed('not a url', noopLookup)).ok).toBe(false)
  })

  it('域名端点默认使用真实 DNS（冒烟，公开域名应放行）', async () => {
    // 不注入 lookup，走默认 dns.lookup；example.com 是 IANA 保留的稳定公网域名
    const result = await assertAiEndpointAllowed('https://example.com')
    expect(result).toEqual({ ok: true })
  })
})
