import { describe, it, expect } from 'vitest'
import { argPrefixMatch, searchEntries, type SearchEntryBase } from '../search'
import type { FuzzyEngine } from '../fuzzyEngine'

/**
 * 参数化命令的「前缀命中」（对标 Raycast）。
 *
 * 为什么要这一格：整条查询必须作为子串/子序列命中标题的旧规则下，
 * 「正则测试 \d+」这种「命令 + 尾部参数」根本选不中命令条目，
 * 于是胶囊的参数表单永远只能空着打开——argPrefill 是走不到的死路。
 */

/** 第三层拼写容错会把这种查询模糊捞回来；隔离它才能看出命中是谁给的 */
const noTypo: FuzzyEngine = { match: () => null } as unknown as FuzzyEngine

const mk = (key: string, title: string, acceptsArgs = false): SearchEntryBase =>
  ({
    key,
    icon: 'link',
    title,
    subtitle: '',
    badge: '链接',
    action: { type: 'openUrl', url: 'https://example.com' },
    acceptsArgs
  }) as unknown as SearchEntryBase

describe('argPrefixMatch', () => {
  it('查询以标题开头且后面是空白 → 命中，区间就是标题', () => {
    expect(argPrefixMatch('正则测试 \\d+', '正则测试')).toEqual({
      contiguous: true,
      start: 0,
      end: 3
    })
    expect(argPrefixMatch('github react', 'GitHub')).not.toBeNull()
  })
  it('标题只是单词的开头不算命中（"Github x" 不得匹配命令 "Git"）', () => {
    expect(argPrefixMatch('Github x', 'Git')).toBeNull()
  })
  it('查询等于标题 / 短于标题都不算（那走的是普通命中）', () => {
    expect(argPrefixMatch('GitHub', 'GitHub')).toBeNull()
    expect(argPrefixMatch('GitH', 'GitHub')).toBeNull()
  })
})

describe('searchEntries 接入前缀命中', () => {
  it('只有声明了 acceptsArgs 的条目才吃前缀命中', () => {
    const q = '正则测试 \\d+'
    const hit = searchEntries([mk('quicklink:a', '正则测试', true)], q, 8, undefined, noTypo)
    const miss = searchEntries([mk('quicklink:b', '正则测试')], q, 8, undefined, noTypo)
    expect(hit.map((h) => h.entry.key)).toEqual(['quicklink:a'])
    expect(miss).toHaveLength(0)
  })

  it('完整命中的条目排在前面（前缀命中要扣分，不得盖过整条匹配）', () => {
    const q = '正则测试 数字 g'
    const entries = [mk('e:prefix', '正则测试', true), mk('e:full', '正则测试 数字 g', true)]
    const rows = searchEntries(entries, q, 8, undefined, noTypo)
    expect(rows.map((r) => r.entry.key)).toEqual(['e:full', 'e:prefix'])
  })
})
