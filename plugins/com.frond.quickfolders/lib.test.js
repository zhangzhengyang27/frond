import { describe, it, expect } from 'vitest'
import { sortFolders, normalizeName, migrate, childrenOf } from './lib.js'

describe('quickfolders lib', () => {
  it('排序：置顶优先，再按打开计数', () => {
    const sorted = sortFolders([
      { path: '/a', openCount: 5 },
      { path: '/b', openCount: 1, pinned: true },
      { path: '/c', openCount: 3 }
    ])
    expect(sorted.map((f) => f.path)).toEqual(['/b', '/a', '/c'])
  })
  it('normalizeName 取尾段', () => {
    expect(normalizeName('/Users/x/Projects')).toBe('Projects')
    expect(normalizeName('/')).toBe('/')
  })
  it('migrate：旧 string 数组自动升级，脏数据剔除', () => {
    const m = migrate(['/a', { path: '/b', pinned: true }, 42, null])
    expect(m).toEqual([
      { path: '/a', pinned: false, openCount: 0 },
      { path: '/b', pinned: true, openCount: 0 }
    ])
  })
  it('childrenOf 取前缀子目录（不含自身）', () => {
    const folders = [
      { path: '~/Work/a', openCount: 0 },
      { path: '~/Work', openCount: 0 },
      { path: '~/Desktop', openCount: 0 }
    ]
    expect(childrenOf(folders, '~/Work').map((f) => f.path)).toEqual(['~/Work/a'])
  })
})
