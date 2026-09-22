import { describe, it, expect } from 'vitest'
import { shouldExcludeDir, shouldExcludeFile } from '../excludes'

/**
 * 内置排除规则（#9 文件索引）：目录名级剪枝（任意层级命中即整目录跳过）+
 * 隐藏文件开关。默认范围是 home 全量，~/Library 必须被剪掉。
 */
describe('shouldExcludeDir', () => {
  it('内置目录名任意层级命中即排除', () => {
    for (const name of ['node_modules', '.git', 'Library', 'Caches', '.Trash', 'dist', 'build']) {
      expect(shouldExcludeDir(name, { hidden: true })).toBe(true)
    }
  })

  it('普通目录不排除', () => {
    for (const name of ['projects', 'Documents', '我的文件', 'trae-work-kb-md']) {
      expect(shouldExcludeDir(name, { hidden: true })).toBe(false)
    }
  })

  it('隐藏目录开关：dot 开头目录按策略排除', () => {
    expect(shouldExcludeDir('.config', { hidden: true })).toBe(true)
    expect(shouldExcludeDir('.config', { hidden: false })).toBe(false)
    // .git / .Trash 无论开关都排除（内置名单）
    expect(shouldExcludeDir('.git', { hidden: false })).toBe(true)
  })

  it('用户追加排除目录名生效', () => {
    expect(shouldExcludeDir('scratch', { hidden: true, extraDirs: ['scratch'] })).toBe(true)
    expect(shouldExcludeDir('other', { hidden: true, extraDirs: ['scratch'] })).toBe(false)
  })

  it('.leafignore 标记目录跳过', () => {
    expect(shouldExcludeDir('anything', { hidden: true, leafIgnoreMarked: true })).toBe(true)
  })
})

describe('shouldExcludeFile', () => {
  it('隐藏文件按开关排除', () => {
    expect(shouldExcludeFile('.DS_Store', { hidden: true })).toBe(true)
    expect(shouldExcludeFile('.DS_Store', { hidden: false })).toBe(false)
    expect(shouldExcludeFile('报告.md', { hidden: true })).toBe(false)
  })
})
