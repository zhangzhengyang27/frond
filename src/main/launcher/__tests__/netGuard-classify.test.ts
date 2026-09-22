import { describe, it, expect } from 'vitest'
import { classifyIpRisk, isLocalAddressLiteral } from '../netGuard'

/**
 * classifyIpRisk：把地址分为 loopback / lan / blocked / public 四档。
 * AI 端点守卫的策略基础——loopback 与局域网是用户自建模型（Ollama 等）
 * 的合法场景，放行；元数据 / 链路本地 / 保留段等高危段硬阻断。
 */
describe('classifyIpRisk', () => {
  it('回环地址 → loopback', () => {
    expect(classifyIpRisk('127.0.0.1')).toBe('loopback')
    expect(classifyIpRisk('127.8.8.8')).toBe('loopback')
    expect(classifyIpRisk('::1')).toBe('loopback')
  })

  it('私有网段 → lan', () => {
    expect(classifyIpRisk('10.1.2.3')).toBe('lan')
    expect(classifyIpRisk('172.16.0.1')).toBe('lan')
    expect(classifyIpRisk('172.31.255.255')).toBe('lan')
    expect(classifyIpRisk('192.168.1.1')).toBe('lan')
    expect(classifyIpRisk('fd00::1')).toBe('lan')
  })

  it('高危段 → blocked（元数据 / 链路本地 / 保留 / 组播 / 文档段）', () => {
    expect(classifyIpRisk('169.254.169.254')).toBe('blocked') // 云元数据
    expect(classifyIpRisk('0.0.0.0')).toBe('blocked')
    expect(classifyIpRisk('100.64.0.1')).toBe('blocked') // CGNAT
    expect(classifyIpRisk('198.18.0.1')).toBe('blocked') // benchmark
    expect(classifyIpRisk('192.0.2.1')).toBe('blocked') // TEST-NET-1
    expect(classifyIpRisk('198.51.100.7')).toBe('blocked') // TEST-NET-2
    expect(classifyIpRisk('203.0.113.9')).toBe('blocked') // TEST-NET-3
    expect(classifyIpRisk('224.0.0.1')).toBe('blocked') // 组播
    expect(classifyIpRisk('243.1.2.3')).toBe('blocked') // 保留
    expect(classifyIpRisk('fe80::1')).toBe('blocked') // IPv6 link-local
    expect(classifyIpRisk('2001:db8::1')).toBe('blocked') // 文档段
    expect(classifyIpRisk('ff02::1')).toBe('blocked') // IPv6 组播
    expect(classifyIpRisk('::')).toBe('blocked') // 未指定地址
  })

  it('公网地址 → public', () => {
    expect(classifyIpRisk('8.8.8.8')).toBe('public')
    expect(classifyIpRisk('143.0.0.1')).toBe('public')
    expect(classifyIpRisk('2606:4700::1111')).toBe('public')
  })

  it('无法解析的输入 fail closed → blocked', () => {
    expect(classifyIpRisk('not-an-ip')).toBe('blocked')
    expect(classifyIpRisk('')).toBe('blocked')
  })

  it('与 isLocalAddressLiteral 保持一致（loopback/lan/blocked 均属本地侧）', () => {
    const samples = [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.1.1',
      '169.254.169.254',
      '0.0.0.0',
      '8.8.8.8',
      '::1',
      'fe80::1',
      'fd00::1'
    ]
    for (const ip of samples) {
      expect(classifyIpRisk(ip) === 'public').toBe(!isLocalAddressLiteral(ip))
    }
  })
})
