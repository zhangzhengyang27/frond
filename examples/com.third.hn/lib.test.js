import { describe, expect, it } from 'vitest'
import lib from './lib.js'

const FIXTURE_STORY = {
  id: 1,
  type: 'story',
  title: 'Show HN: Frond',
  url: 'https://frond.example',
  score: 42,
  descendants: 7,
  by: 'frond'
}

describe('parseTopIds', () => {
  it('id 数组取前 n；坏 id / 非数组 / 坏 JSON → []', () => {
    expect(lib.parseTopIds([1, 'x', 3, -1, 0, 4], 3)).toEqual([1, 3, 4])
    expect(lib.parseTopIds('not json', 3)).toEqual([])
    expect(lib.parseTopIds({ foo: 1 }, 3)).toEqual([])
    expect(lib.parseTopIds('[11,12,13,14]', 2)).toEqual([11, 12])
  })
})

describe('toRow', () => {
  it('story → 行：标题/作者/分数评论徽章/三动作', () => {
    const row = lib.toRow(FIXTURE_STORY)
    expect(row.title).toBe('Show HN: Frond')
    expect(row.subtitle).toBe('by frond')
    expect(row.accessories.map((a) => a.tag)).toEqual(['▲ 42', '💬 7'])
    expect(row.actions.map((a) => a.type)).toEqual(['open', 'copy', 'open'])
    expect(row.actions[2].payload).toBe('https://news.ycombinator.com/item?id=1')
  })

  it('无 url 的纯文本帖：只给复制标题；job / 无标题 → null', () => {
    const textOnly = lib.toRow({ id: 2, type: 'story', title: 'Ask HN?', text: '…', by: 'a' })
    expect(textOnly.actions).toHaveLength(1)
    expect(textOnly.actions[0].type).toBe('copy')
    expect(lib.toRow({ id: 3, type: 'job', title: 'Hiring' })).toBeNull()
    expect(lib.toRow({ id: 4, type: 'story' })).toBeNull()
    expect(lib.toRow(null)).toBeNull()
  })
})

describe('filterRows', () => {
  const rows = [lib.toRow(FIXTURE_STORY), lib.toRow({ id: 9, type: 'story', title: 'Rust 1.0', by: 'bob', url: 'https://r' })]
  it('title/by 大小写不敏感子串；空查全量', () => {
    expect(lib.filterRows(rows, 'frond')).toHaveLength(1)
    expect(lib.filterRows(rows, 'BOB')).toHaveLength(1)
    expect(lib.filterRows(rows, '')).toHaveLength(2)
    expect(lib.filterRows(rows, 'zzz')).toHaveLength(0)
  })
})
