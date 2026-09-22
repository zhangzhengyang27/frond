/**
 * clipboardLogic 单测（B2 List-Detail 重构）
 *
 * 覆盖：
 *  - dateGroupOf: 今天/昨天/更早（本地日界）+ 未来时间戳 + 跨月
 *  - groupItems: 置顶组固定最前、组内保持传入顺序、空组不输出
 *  - filterByKind: 全部/单类型
 *  - relativeTime / listTimeLabel / formatAbsTime / detailTime
 *  - kindLabelOf / sizeSummaryOf / titleOf
 */
import { describe, it, expect } from 'vitest'
import {
  dateGroupOf,
  groupItems,
  filterByKind,
  relativeTime,
  listTimeLabel,
  formatAbsTime,
  detailTime,
  kindLabelOf,
  sizeSummaryOf,
  titleOf,
  type ClipItemLike
} from '../clipboardLogic'

/** 固定「现在」：2026-09-07 15:00 本地时间 */
const NOW = new Date(2026, 8, 7, 15, 0, 0).getTime()

const at = (y: number, m: number, d: number, hh = 12, mm = 30): number =>
  new Date(y, m - 1, d, hh, mm).getTime()

const mk = (over: Partial<ClipItemLike> & { id: string }): ClipItemLike => ({
  kind: 'text',
  text: 'hello',
  createdAt: NOW,
  ...over
})

describe('dateGroupOf', () => {
  it('今天零点与当天任意时刻都算今天', () => {
    expect(dateGroupOf(at(2026, 9, 7, 0, 0), NOW)).toBe('today')
    expect(dateGroupOf(at(2026, 9, 7, 14, 59), NOW)).toBe('today')
  })

  it('昨天 23:59 算昨天（即使不足 24 小时）', () => {
    expect(dateGroupOf(at(2026, 9, 6, 23, 59), NOW)).toBe('yesterday')
  })

  it('前天及更早算 earlier', () => {
    expect(dateGroupOf(at(2026, 9, 5, 16, 0), NOW)).toBe('earlier')
    expect(dateGroupOf(at(2025, 1, 1), NOW)).toBe('earlier')
  })

  it('未来时间戳按今天处理', () => {
    expect(dateGroupOf(at(2026, 9, 8, 10, 0), NOW)).toBe('today')
  })
})

describe('groupItems', () => {
  it('置顶组固定在最前，其余按 今天/昨天/更早', () => {
    const items = [
      mk({ id: 't1', createdAt: at(2026, 9, 7, 14, 0) }),
      mk({ id: 'y1', createdAt: at(2026, 9, 6, 10, 0) }),
      mk({ id: 'p1', pinned: true, createdAt: at(2026, 9, 5, 9, 0) }),
      mk({ id: 'o1', createdAt: at(2025, 1, 2, 9, 0) }),
      mk({ id: 'p2', pinned: true, createdAt: at(2026, 9, 7, 8, 0) })
    ]
    const groups = groupItems(items, NOW)
    expect(groups.map((g) => g.key)).toEqual(['pinned', 'today', 'yesterday', 'earlier'])
    expect(groups[0].label).toBe('置顶')
    expect(groups[0].items.map((i) => i.id)).toEqual(['p1', 'p2']) // 组内保持传入顺序
    expect(groups[1].items.map((i) => i.id)).toEqual(['t1'])
    expect(groups[2].label).toBe('昨天')
    expect(groups[3].label).toBe('更早')
  })

  it('空组不输出；无置顶时今天在最前', () => {
    const groups = groupItems(
      [mk({ id: 't1', createdAt: at(2026, 9, 7, 9, 0) })],
      NOW
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: 'today', label: '今天' })
  })
})

describe('filterByKind', () => {
  const items = [
    mk({ id: 'a', kind: 'text' }),
    mk({ id: 'b', kind: 'link', text: 'https://x.com' }),
    mk({ id: 'c', kind: 'image', filePath: '/tmp/a.png' }),
    mk({ id: 'd', kind: 'files', paths: ['/tmp/a'] })
  ]

  it('all 原样返回', () => {
    expect(filterByKind(items, 'all')).toEqual(items)
  })

  it('按类型过滤', () => {
    expect(filterByKind(items, 'link').map((i) => i.id)).toEqual(['b'])
    expect(filterByKind(items, 'files').map((i) => i.id)).toEqual(['d'])
    expect(filterByKind(items, 'image').map((i) => i.id)).toEqual(['c'])
    expect(filterByKind(items, 'text').map((i) => i.id)).toEqual(['a'])
  })
})

describe('relativeTime / listTimeLabel', () => {
  it('刚刚 / 分钟 / 小时', () => {
    expect(relativeTime(NOW - 10_000, NOW)).toBe('刚刚')
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 分钟前')
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3 小时前')
  })

  it('超过一天返回空串，listTimeLabel 回退 M月D日', () => {
    expect(relativeTime(NOW - 25 * 3_600_000, NOW)).toBe('')
    expect(listTimeLabel(NOW - 25 * 3_600_000, NOW)).toBe('9月6日')
    expect(listTimeLabel(NOW - 5 * 60_000, NOW)).toBe('5 分钟前')
  })
})

describe('formatAbsTime / detailTime', () => {
  it('今天/昨天 带 HH:MM（补零）', () => {
    expect(formatAbsTime(at(2026, 9, 7, 9, 5), NOW)).toBe('今天 09:05')
    expect(formatAbsTime(at(2026, 9, 6, 23, 8), NOW)).toBe('昨天 23:08')
  })

  it('更早：同年 M月D日 HH:MM，跨年补年份', () => {
    expect(formatAbsTime(at(2026, 3, 5, 14, 32), NOW)).toBe('3月5日 14:32')
    expect(formatAbsTime(at(2025, 12, 31, 23, 59), NOW)).toBe('2025年12月31日 23:59')
  })

  it('detailTime 组合相对时间；刚刚只显示绝对时间', () => {
    expect(detailTime(at(2026, 9, 7, 13, 0), NOW)).toBe('今天 13:00 · 2 小时前')
    expect(detailTime(NOW - 10_000, NOW)).toBe('今天 14:59')
    expect(detailTime(at(2026, 9, 6, 12, 0), NOW)).toBe('昨天 12:00')
  })
})

describe('kindLabelOf', () => {
  it('四种类型映射', () => {
    expect(kindLabelOf('text')).toBe('文本')
    expect(kindLabelOf('link')).toBe('链接')
    expect(kindLabelOf('image')).toBe('图片')
  })
})


describe('sizeSummaryOf', () => {
  it('text/link 统计字符数', () => {
    expect(sizeSummaryOf(mk({ id: '1', text: '你好 world' }))).toBe('8 字符')
    expect(sizeSummaryOf(mk({ id: '2', kind: 'link', text: 'https://a.b' }))).toBe('11 字符')
    expect(sizeSummaryOf(mk({ id: '3', kind: 'text', text: '' }))).toBe('0 字符')
  })

  it('image 显示宽 × 高，缺失回退未知尺寸', () => {
    expect(sizeSummaryOf(mk({ id: '4', kind: 'image', width: 1920, height: 1080 }))).toBe(
      '1920 × 1080'
    )
    expect(sizeSummaryOf(mk({ id: '5', kind: 'image', filePath: '/tmp/a.png' }))).toBe('未知尺寸')
  })

  it('files 显示 paths 数量', () => {
    expect(sizeSummaryOf(mk({ id: '6', kind: 'files', paths: ['/a'] }))).toBe('1 个文件')
    expect(sizeSummaryOf(mk({ id: '7', kind: 'files', paths: ['/a', '/b', '/c'] }))).toBe(
      '3 个文件'
    )
    expect(sizeSummaryOf(mk({ id: '8', kind: 'files' }))).toBe('0 个文件')
  })
})

describe('titleOf', () => {
  it('文本取首行前 60 字符，空文本兜底', () => {
    expect(titleOf(mk({ id: '1', text: '第一行\n第二行' }))).toBe('第一行')
    expect(titleOf(mk({ id: '2', text: '  ' }))).toBe('空文本')
    expect(titleOf(mk({ id: '3', text: 'a'.repeat(70) }))).toBe('a'.repeat(60))
  })

  it('图片显示尺寸占位', () => {
    expect(titleOf(mk({ id: '4', kind: 'image', width: 100, height: 50 }))).toBe('图片 100 × 50')
    expect(titleOf(mk({ id: '5', kind: 'image' }))).toBe('图片 ? × ?')
  })

  it('文件：单个取文件名，多个取「首路径 等 N 个文件」', () => {
    expect(titleOf(mk({ id: '6', kind: 'files', paths: ['/Users/a/b/c.txt'] }))).toBe('c.txt')
    expect(titleOf(mk({ id: '7', kind: 'files', paths: ['/x/a.txt', '/y/b.txt'] }))).toBe(
      '/x/a.txt 等 2 个文件'
    )
  })
})

