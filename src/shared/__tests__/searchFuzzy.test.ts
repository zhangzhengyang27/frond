import { describe, it, expect } from 'vitest'
import { searchEntries, type SearchEntryBase, type FuzzyEngine } from '../search'
import { defaultFuzzyEngine } from '../fuzzyEngine'

/**
 * 拼写容错层（模糊引擎）：连续子串 / 按序子序列都未命中时，
 * 由可切换的 FuzzyEngine 做编辑距离容错（对标 Raycast fuzzy 档）。
 * 不变式：容错命中必须排在同字段的连续 / 子序列命中之后。
 */
interface Entry extends SearchEntryBase {
  id: string
}

function e(id: string, title: string, subtitle = '', aliases?: string[]): Entry {
  return { key: id, icon: 'x', title, subtitle, aliases, id }
}

describe('searchEntries 拼写容错层', () => {
  it('多打一个字母仍命中标题（默认引擎）', () => {
    const rows = searchEntries([e('a', 'Chrome', '')], 'chromee')
    expect(rows.map((r) => r.entry.id)).toContain('a')
  })

  it('打错一个字母仍命中标题（默认引擎）', () => {
    const rows = searchEntries([e('a', 'Chrome', '')], 'chromf')
    expect(rows.map((r) => r.entry.id)).toContain('a')
  })

  it('副标题可容错命中（标题未命中时）', () => {
    const rows = searchEntries([e('a', 'Hammer', 'tools')], 'toools')
    expect(rows.map((r) => r.entry.id)).toContain('a')
  })

  it('容错命中排在连续命中之后（分层不变量）', () => {
    const rows = searchEntries(
      [e('typo', 'Chrome', ''), e('exact', 'Chromee Browser', '')],
      'chromee'
    )
    expect(rows[0].entry.id).toBe('exact')
    expect(rows.some((r) => r.entry.id === 'typo')).toBe(true)
  })

  it('容错命中的分数低于子序列命中（同字段）', () => {
    // 'chrme' 是 'chrome' 的子序列（丢字母，旧引擎层即可命中，分数 96）；
    // 'chromee' 只能走容错层，必须低于子序列档
    const subseq = searchEntries([e('a', 'Chrome', '')], 'chrme')
    const typo = searchEntries([e('a', 'Chrome', '')], 'chromee')
    expect(subseq[0].score).toBeGreaterThan(typo[0].score)
  })

  it('容错命中携带标题高亮区间', () => {
    const rows = searchEntries([e('a', 'Chrome', '')], 'chromee')
    expect(rows[0].highlight).toMatchObject({ contiguous: false, start: 0, end: 5 })
  })

  it('可注入自定义引擎（引擎切换封装）', () => {
    const seen: string[] = []
    const engine: FuzzyEngine = {
      match: (_nq, text) => {
        seen.push(text)
        return { score: 0.1, start: 1, end: 2, errors: 1 }
      }
    }
    const rows = searchEntries([e('a', 'Abcd', '')], 'zzz', 8, undefined, engine)
    expect(rows).toHaveLength(1)
    // 引擎收到的是归一化后的标题文本
    expect(seen).toContain('abcd')
    expect(rows[0].highlight).toEqual({ contiguous: false, start: 1, end: 2 })
  })

  it('引擎抛异常不崩溃，降级为无命中', () => {
    const boom: FuzzyEngine = {
      match: () => {
        throw new Error('boom')
      }
    }
    expect(() => searchEntries([e('a', 'Chrome', '')], 'chromee', 8, undefined, boom)).not.toThrow()
    expect(searchEntries([e('a', 'Chrome', '')], 'chromee', 8, undefined, boom)).toHaveLength(0)
  })
})

describe('defaultFuzzyEngine（编辑距离容错）', () => {
  it('换序输入（相邻字母敲反）命中', () => {
    expect(defaultFuzzyEngine.match('chorme', 'chrome')).not.toBeNull()
  })

  it('短查询（<3 字符）不做容错，直接拒绝', () => {
    expect(defaultFuzzyEngine.match('cz', 'chrome')).toBeNull()
  })

  it('错误数超上限拒绝（≤5 字符只容错 1 错）', () => {
    // chrxy 对 chrome 有 2 个错误（x、y 替换），5 字符上限 1 错
    expect(defaultFuzzyEngine.match('chrxy', 'chrome')).toBeNull()
  })

  it('中文查询容错（1 错）', () => {
    expect(defaultFuzzyEngine.match('谷歌浏缆器', '谷歌浏览器')).not.toBeNull()
  })

  it('完全无关输入不命中', () => {
    expect(defaultFuzzyEngine.match('xyzab', 'chrome')).toBeNull()
  })

  it('返回区间落在归一化文本范围内', () => {
    const hit = defaultFuzzyEngine.match('chromee', 'chrome')
    expect(hit).not.toBeNull()
    expect(hit!.start).toBeGreaterThanOrEqual(0)
    expect(hit!.end).toBeLessThan('chrome'.length)
  })
})
