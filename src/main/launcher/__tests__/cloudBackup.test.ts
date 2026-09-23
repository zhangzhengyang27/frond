import { describe, it, expect } from 'vitest'
import { pickPruneCandidates, tsFromFileName } from '../cloudBackup'

/**
 * 云备份保留策略纯函数：按文件名内时间戳新→旧排序，超出保留数的进删除名单。
 */
describe('pickPruneCandidates', () => {
  const names = (ts: number[]): string[] => ts.map((t) => `frond-full-${t}.db.enc`)

  it('保留最新 N 份，其余进删除名单', () => {
    const prune = pickPruneCandidates(names([100, 300, 200, 400]), 3)
    expect(prune).toEqual(names([100]))
  })

  it('不足 keep 份时不删任何文件', () => {
    expect(pickPruneCandidates(names([200, 100]), 3)).toEqual([])
    expect(pickPruneCandidates([], 3)).toEqual([])
  })

  it('重复文件名去重', () => {
    expect(pickPruneCandidates([...names([1, 1, 2, 3, 4])], 3)).toEqual(names([1]))
  })

  it('非法文件名（无时间戳）视为最旧优先删除', () => {
    const prune = pickPruneCandidates(['frond-full-x.db.enc', ...names([100, 200, 300])], 3)
    expect(prune).toEqual(['frond-full-x.db.enc'])
  })

  it('tsFromFileName 解析', () => {
    expect(tsFromFileName('frond-full-1726000000000.db.enc')).toBe(1726000000000)
    expect(tsFromFileName('other.txt')).toBe(0)
  })
})
