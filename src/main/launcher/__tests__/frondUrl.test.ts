import { describe, it, expect } from 'vitest'
import { findMatchingTab, normalizeUrlForMatch, parseFrondUrl } from '../frondUrl'

/**
 * B4 纯函数测试：frond:// 路由表解析 + Quicklinks 标签页复用的
 * URL 规范化与匹配谓词。
 */

describe('parseFrondUrl（frond:// 路由表）', () => {
  it('frond://launcher → launcher 路由', () => {
    expect(parseFrondUrl('frond://launcher')).toEqual({ kind: 'launcher' })
  })

  it('大小写与尾随斜杠容错', () => {
    expect(parseFrondUrl('FROND://LAUNCHER/')).toEqual({ kind: 'launcher' })
    expect(parseFrondUrl('Frond://Settings/')).toEqual({ kind: 'settings' })
  })

  it('frond://settings → settings 路由（忽略 query/hash）', () => {
    expect(parseFrondUrl('frond://settings')).toEqual({ kind: 'settings' })
    expect(parseFrondUrl('frond://settings?from=deeplink')).toEqual({ kind: 'settings' })
  })

  it('frond://plugin/<id> → plugin 路由并解码 pluginId', () => {
    expect(parseFrondUrl('frond://plugin/quicklinks')).toEqual({ kind: 'plugin', pluginId: 'quicklinks' })
    expect(parseFrondUrl('frond://plugin/My%20Plugin')).toEqual({ kind: 'plugin', pluginId: 'My Plugin' })
    expect(parseFrondUrl('frond://plugin/%E4%B8%AD%E6%96%87/')).toEqual({
      kind: 'plugin',
      pluginId: '中文'
    })
  })

  it('frond://plugin 缺少 id → null', () => {
    expect(parseFrondUrl('frond://plugin')).toBeNull()
    expect(parseFrondUrl('frond://plugin/')).toBeNull()
  })

  it('未识别路由段 → null', () => {
    expect(parseFrondUrl('frond://unknown/route')).toBeNull()
    expect(parseFrondUrl('frond://')).toBeNull()
  })

  it('非 frond:// 输入 → null', () => {
    expect(parseFrondUrl('https://example.com/launcher')).toBeNull()
    expect(parseFrondUrl('plugin://abc/index.html')).toBeNull()
    expect(parseFrondUrl('')).toBeNull()
    expect(parseFrondUrl(undefined)).toBeNull()
    expect(parseFrondUrl(42)).toBeNull()
    expect(parseFrondUrl(null)).toBeNull()
  })

  it('缺 // 的 frond:launcher 形态容错', () => {
    expect(parseFrondUrl('frond:launcher')).toEqual({ kind: 'launcher' })
    expect(parseFrondUrl('frond:plugin/abc')).toEqual({ kind: 'plugin', pluginId: 'abc' })
  })

  it('畸形 percent 编码不抛异常（按原样作为 pluginId）', () => {
    expect(parseFrondUrl('frond://plugin/%ZZ')).toEqual({ kind: 'plugin', pluginId: '%ZZ' })
  })
})

describe('normalizeUrlForMatch（标签页匹配规范化）', () => {
  it('host 大小写归一（含端口默认值归一）', () => {
    expect(normalizeUrlForMatch('https://GitHub.com/')).toBe('https://github.com')
    expect(normalizeUrlForMatch('https://Example.com:443/x')).toBe('https://example.com/x')
  })

  it('去路径尾斜杠，根路径除外', () => {
    expect(normalizeUrlForMatch('https://a.com/x/')).toBe('https://a.com/x')
    expect(normalizeUrlForMatch('https://a.com/')).toBe('https://a.com')
    expect(normalizeUrlForMatch('https://a.com')).toBe('https://a.com')
  })

  it('忽略 hash（同一页面锚点不算新标签页）', () => {
    expect(normalizeUrlForMatch('https://a.com/x#section')).toBe('https://a.com/x')
  })

  it('query 精确保留（不同参数视为不同页面）', () => {
    expect(normalizeUrlForMatch('https://a.com/search?q=1')).toBe('https://a.com/search?q=1')
    expect(normalizeUrlForMatch('https://a.com/search?q=1')).not.toBe(
      normalizeUrlForMatch('https://a.com/search?q=2')
    )
  })

  it('非 http(s) 一律不参与匹配', () => {
    expect(normalizeUrlForMatch('file:///etc/passwd')).toBeNull()
    expect(normalizeUrlForMatch('frond://launcher')).toBeNull()
    expect(normalizeUrlForMatch('javascript:void(0)')).toBeNull()
  })

  it('非法输入 → null', () => {
    expect(normalizeUrlForMatch('not a url')).toBeNull()
    expect(normalizeUrlForMatch('')).toBeNull()
    expect(normalizeUrlForMatch(undefined)).toBeNull()
    expect(normalizeUrlForMatch(null)).toBeNull()
  })
})

describe('findMatchingTab（标签页匹配谓词）', () => {
  const tabs = [
    { id: 'chrome:1:1', url: 'https://github.com/frond-app/frond' },
    { id: 'chrome:1:2', url: 'https://github.com/other' },
    { id: 'safari:1:1', url: 'https://docs.example.com/guide/' }
  ]

  it('规范化后精确命中并返回原标签对象', () => {
    expect(findMatchingTab('https://GITHUB.com/frond-app/frond/', tabs)).toEqual(tabs[0])
    expect(findMatchingTab('https://docs.example.com/guide#top', tabs)).toEqual(tabs[2])
  })

  it('未命中 / 目标非法 / 列表为空 → null', () => {
    expect(findMatchingTab('https://github.com/frond-app/frond/issues', tabs)).toBeNull()
    expect(findMatchingTab('file:///tmp', tabs)).toBeNull()
    expect(findMatchingTab('https://a.com', [])).toBeNull()
    expect(findMatchingTab('https://a.com', null)).toBeNull()
    expect(findMatchingTab('https://a.com', undefined)).toBeNull()
  })

  it('列表中 URL 非法的条目被跳过而不抛错', () => {
    const dirty = [{ id: 't1', url: '::::' }, { id: 't2', url: 'https://a.com/x' }]
    expect(findMatchingTab('https://a.com/x', dirty)).toEqual(dirty[1])
  })
})
