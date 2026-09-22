import { describe, it, expect } from 'vitest'
import {
  quicklinkArgNames,
  quicklinkFieldNames,
  buildQuicklinkUrlMulti,
  buildQuicklinkUrl,
  isValidQuicklinkUrl
} from '../commands'

/**
 * V4 P0-4：Quicklink 命名多参数。
 * - {query} / {encodedQuery} 是旧单参语法，不进 quicklinkArgNames
 * - {name} 按出现顺序去重收集；值 URL 编码；空值保留占位符
 */
describe('quicklinkArgNames', () => {
  it('收集命名占位符并按出现顺序去重', () => {
    expect(quicklinkArgNames('https://github.com/{org}/{repo}')).toEqual(['org', 'repo'])
    expect(quicklinkArgNames('https://x.com/?a={q}&b={q}&c={r}')).toEqual(['q', 'r'])
  })

  it('{query} / {encodedQuery} 不算命名参数（旧单参流程不受影响）', () => {
    expect(quicklinkArgNames('https://www.google.com/search?q={query}')).toEqual([])
    expect(quicklinkArgNames('https://x.com/?q={encodedQuery}')).toEqual([])
  })

  it('无占位符返回空数组', () => {
    expect(quicklinkArgNames('https://example.com')).toEqual([])
  })
})

describe('quicklinkFieldNames（表单 / 内联槽收哪几格）', () => {
  it('混合形态把 {query} 也算一格：只收命名参数会拼出带字面量的坏地址', () => {
    // 旧实现（quicklinkArgNames）这里返回 ['id']，提交的 URL 里留着 `{query}`
    expect(quicklinkFieldNames('https://a.com/{query}?x={id}')).toEqual(['query', 'id'])
    expect(quicklinkFieldNames('https://a.com/search?q={query}')).toEqual(['query'])
    expect(quicklinkFieldNames('https://github.com/{org}/{repo}')).toEqual(['org', 'repo'])
  })

  it('无占位符 / 只有 {encodedQuery} 不成槽（后者无人替换，成槽就是假装能填）', () => {
    expect(quicklinkFieldNames('https://example.com')).toEqual([])
    expect(quicklinkFieldNames('https://x.com/?q={encodedQuery}')).toEqual([])
  })

  it('多参构建能替换 {query}（表单与内联槽共用这一条构建）', () => {
    expect(
      buildQuicklinkUrlMulti('https://a.com/{query}?x={id}', { query: 'a b', id: 'c' }).replace(
        /%20/g,
        '+'
      )
    ).toMatch(/^https:\/\/a\.com\/(a%20b|a\+b)\?x=c$/)
  })

  it('{query} 与单参构建结果一致', () => {
    const url = 'https://www.google.com/search?q={query}'
    expect(buildQuicklinkUrlMulti(url, { query: 'hello world' })).toBe(
      buildQuicklinkUrl(url, 'hello world')
    )
  })
})

describe('buildQuicklinkUrlMulti', () => {
  it('替换命名占位符并 URL 编码值', () => {
    expect(
      buildQuicklinkUrlMulti('https://github.com/{org}/{repo}', { org: 'a b', repo: 'cd' })
    ).toBe('https://github.com/a%20b/cd')
  })

  it('未提供或空值的占位符原样保留', () => {
    expect(buildQuicklinkUrlMulti('https://github.com/{org}/{repo}', { org: 'foo' })).toBe(
      'https://github.com/foo/{repo}'
    )
  })

  it('{encodedQuery} 不被多参构建触碰', () => {
    expect(buildQuicklinkUrlMulti('https://x.com/?q={encodedQuery}&l={lang}', { lang: 'zh' })).toBe(
      'https://x.com/?q={encodedQuery}&l=zh'
    )
  })
})

describe('旧单参语法回归（不改行为）', () => {
  it('buildQuicklinkUrl 仍按 {query} 单参替换', () => {
    expect(buildQuicklinkUrl('https://www.google.com/search?q={query}', 'hello world')).toBe(
      'https://www.google.com/search?q=hello%20world'
    )
  })

  it('合法多参链接仍然通过 URL 白名单', () => {
    expect(isValidQuicklinkUrl('https://github.com/{org}/{repo}')).toBe(true)
  })
})
