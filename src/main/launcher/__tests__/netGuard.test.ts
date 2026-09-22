import { describe, it, expect } from 'vitest'
import { isLocalAddressLiteral, mappedIpv6ToIpv4 } from '../netGuard'

/**
 * SSRF 地址守卫的判定核心（纯函数）。
 * 重点回归：WHATWG URL 会把 [::ffff:127.0.0.1] 规范化为十六进制
 * ::ffff:7f00:1——这是历史上被绕过的形态。
 */
describe('mappedIpv6ToIpv4', () => {
  it('点分十进制尾段原样返回', () => {
    expect(mappedIpv6ToIpv4('::ffff:127.0.0.1')).toBe('127.0.0.1')
  })

  it('十六进制尾段还原为点分十进制', () => {
    expect(mappedIpv6ToIpv4('::ffff:7f00:1')).toBe('127.0.0.1')
    expect(mappedIpv6ToIpv4('::ffff:7f00:0001')).toBe('127.0.0.1')
    expect(mappedIpv6ToIpv4('::ffff:0a00:1')).toBe('10.0.0.1')
    expect(mappedIpv6ToIpv4('::ffff:c0a8:101')).toBe('192.168.1.1')
    expect(mappedIpv6ToIpv4('::ffff:8f00:1')).toBe('143.0.0.1')
  })

  it('非 mapped / 非法形态返回 null', () => {
    expect(mappedIpv6ToIpv4('::1')).toBeNull()
    expect(mappedIpv6ToIpv4('fe80::1')).toBeNull()
    expect(mappedIpv6ToIpv4('::ffff:7f00')).toBeNull() // 组数不对
    expect(mappedIpv6ToIpv4('::ffff:zzzz:1')).toBeNull()
  })
})

describe('isLocalAddressLiteral', () => {
  it('本地/内网 IPv4', () => {
    expect(isLocalAddressLiteral('127.0.0.1')).toBe(true)
    expect(isLocalAddressLiteral('10.1.2.3')).toBe(true)
    expect(isLocalAddressLiteral('0.0.0.0')).toBe(true)
    expect(isLocalAddressLiteral('192.168.1.1')).toBe(true)
    expect(isLocalAddressLiteral('169.254.1.1')).toBe(true)
    expect(isLocalAddressLiteral('172.16.0.1')).toBe(true)
    expect(isLocalAddressLiteral('172.31.255.255')).toBe(true)
    expect(isLocalAddressLiteral('100.64.0.1')).toBe(true) // CGNAT
    expect(isLocalAddressLiteral('localhost')).toBe(true)
    expect(isLocalAddressLiteral('api.localhost')).toBe(true)
  })

  it('公网 IPv4 放行', () => {
    expect(isLocalAddressLiteral('8.8.8.8')).toBe(false)
    expect(isLocalAddressLiteral('172.32.0.1')).toBe(false) // 恰好越过 172.16-31
    expect(isLocalAddressLiteral('100.128.0.1')).toBe(false)
    expect(isLocalAddressLiteral('143.0.0.1')).toBe(false)
  })

  it('本地 IPv6', () => {
    expect(isLocalAddressLiteral('::')).toBe(true)
    expect(isLocalAddressLiteral('::1')).toBe(true)
    expect(isLocalAddressLiteral('fe80::1')).toBe(true)
    expect(isLocalAddressLiteral('fc00::1')).toBe(true)
    expect(isLocalAddressLiteral('fd12:3456::1')).toBe(true)
  })

  it('IPv4-mapped IPv6（含十六进制规范化形态）判为本地', () => {
    expect(isLocalAddressLiteral('::ffff:127.0.0.1')).toBe(true)
    // 历史绕过形态：WHATWG URL 把 [::ffff:127.0.0.1] 规范化成这个
    expect(isLocalAddressLiteral('::ffff:7f00:1')).toBe(true)
    expect(isLocalAddressLiteral('::ffff:0a00:1')).toBe(true) // 10.0.0.1
    expect(isLocalAddressLiteral('::ffff:c0a8:101')).toBe(true) // 192.168.1.1
  })

  it('mapped 公网地址放行', () => {
    expect(isLocalAddressLiteral('::ffff:8f00:1')).toBe(false) // 143.0.0.1
  })

  it('识别不了的 mapped 形态 fail closed', () => {
    expect(isLocalAddressLiteral('::ffff:7f00')).toBe(true)
    expect(isLocalAddressLiteral('::ffff:zzzz:1')).toBe(true)
  })

  it('方括号包裹（URL.hostname 形态）剥除后判定', () => {
    expect(isLocalAddressLiteral('[::1]')).toBe(true)
    expect(isLocalAddressLiteral('[::ffff:7f00:1]')).toBe(true)
  })
})
