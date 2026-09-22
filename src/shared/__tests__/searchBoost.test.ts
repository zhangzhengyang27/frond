import { describe, it, expect } from 'vitest'
import { searchEntries, type SearchEntryBase } from '../search'

/** 使用频率自学习（维度 1 剩余差距）：boost 在排序前叠加，影响截断与次序 */
interface Entry extends SearchEntryBase {
  id: string
}

function e(id: string, title: string, subtitle: string): Entry {
  return { key: id, icon: 'x', title, subtitle, id }
}

describe('searchEntries boost', () => {
  it('无 boost 时按原有打分排序', () => {
    const rows = searchEntries([e('a', 'Alpha', ''), e('b', 'Beta', 'alpha')], 'alpha')
    expect(rows[0].entry.id).toBe('a')
  })

  it('boost 可让副标题命中的常用条目反超（频率自学习）', () => {
    const entries = [e('fresh', 'Alpha', ''), e('hot', 'Beta', 'alpha tool')]
    const boosted = searchEntries(entries, 'alpha', 8, (entry) => (entry.id === 'hot' ? 100 : 0))
    expect(boosted[0].entry.id).toBe('hot')
  })

  it('boost 不影响无命中条目（不产生新结果）', () => {
    const rows = searchEntries([e('a', 'Alpha', '')], 'zzz', 8, () => 999)
    expect(rows).toHaveLength(0)
  })

  it('boost 参与截断：加分让低分条目挤进 limit', () => {
    const entries = Array.from({ length: 10 }, (_, i) => e(`m${i}`, `Item ${i} alpha`, ''))
    // 不加 boost：只有前 8 个出现
    expect(searchEntries(entries, 'alpha', 8)).toHaveLength(8)
    // 给最后一名 +100：它出现在结果里
    const rows = searchEntries(entries, 'alpha', 8, (entry) => (entry.id === 'm9' ? 100 : 0))
    expect(rows.some((r) => r.entry.id === 'm9')).toBe(true)
  })
})
