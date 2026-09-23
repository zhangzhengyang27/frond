import { describe, it, expect, afterAll } from 'vitest'
import {
  normPath,
  parentOf,
  isInScope,
  dirsForEvents,
  nativePath,
  partitionReadable
} from '../paths'

/**
 * 索引路径形态层（#9 M2 跨平台）：Windows 的 join 产出反斜杠，而索引内部靠
 * `lastIndexOf('/')` / `dir + '/'` 前缀删除 / scope 判定工作 —— 这一层不折算对，
 * 增量与删除就会静默错位（不是崩，是「索引悄悄不对」，最难查的那类）。
 */
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

afterAll(() => {
  if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
})

describe('normPath', () => {
  it('反斜杠折成正斜杠、去尾分隔符、盘符统一大写', () => {
    expect(normPath('C:\\Users\\xiaoye\\Desktop')).toBe('C:/Users/xiaoye/Desktop')
    expect(normPath('/a/b/')).toBe('/a/b')
    expect(normPath('c:/users')).toBe('C:/users')
    expect(normPath('C:/')).toBe('C:/') // 盘根不能被削成 'C:'
    expect(normPath('/')).toBe('/')
    expect(normPath('')).toBe('')
  })

  it('对 POSIX 路径是幂等的（macOS 行为零变化）', () => {
    expect(normPath(normPath('/Users/x/Documents'))).toBe('/Users/x/Documents')
  })
})

describe('parentOf', () => {
  it('逐层回到盘根 / 根为止', () => {
    expect(parentOf('C:/Users/x/a.txt')).toBe('C:/Users/x')
    expect(parentOf('C:/Users')).toBe('C:/')
    expect(parentOf('C:/')).toBe('C:/') // 盘根的父是自身（再往上没有可比的对象）
    expect(parentOf('C:')).toBe('C:')
    expect(parentOf('/a/b')).toBe('/a')
    expect(parentOf('/a')).toBe('/')
    expect(parentOf('/')).toBe('/')
  })
})

describe('isInScope', () => {
  it('scope 自身算在内，同级前缀不算', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const scopes = ['C:/Users/x']
    expect(isInScope(scopes, 'C:/Users/x')).toBe(true)
    expect(isInScope(scopes, 'C:/Users/x/Desktop/a.txt')).toBe(true)
    expect(isInScope(scopes, 'C:/Users/xx')).toBe(false) // 字符串前缀陷阱
    expect(isInScope(scopes, 'D:/Other')).toBe(false)
    expect(isInScope(scopes, 'c:/users/x/desktop')).toBe(true) // 大小写漂移不能判成范围外
    Object.defineProperty(process, 'platform', { value: 'darwin' })
  })
})

describe('dirsForEvents', () => {
  it('只收目录：文件事件归到其父目录，范围外逐级丢掉', () => {
    const scopes = ['/Users/x/Code']
    const isDir = (p: string): boolean => !p.includes('.')
    expect(
      dirsForEvents(
        scopes,
        ['/Users/x/Code/leaf', '/Users/x/Code/leaf/a.ts', '/Users/x', '/etc/hosts'],
        isDir
      )
    ).toEqual(['/Users/x/Code/leaf', '/Users/x/Code'])
  })

  it('Windows 事件形态（反斜杠、盘符大小写混用）归一到同一目录集', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' }) // 大小写无关比较只在 win32 生效
    const scopes = ['C:/Users/x/Code']
    const isDir = (p: string): boolean => !p.includes('.ts')
    expect(
      dirsForEvents(
        scopes,
        [
          'C:\\Users\\x\\Code\\frond\\a.ts', // 文件事件 → 归到所在目录
          'c:\\users\\x\\code\\frond', // 目录事件（大小写混用也要归一）
          'C:\\Windows\\System32' // 范围外
        ],
        isDir
      )
    ).toEqual(['C:/Users/x/Code/frond', 'C:/Users/x/Code'])
    Object.defineProperty(process, 'platform', { value: 'darwin' })
  })
})

describe('partitionReadable（断连卷补扫的判定）', () => {
  it('已恢复的与仍不可读的分到两边，顺序保持', () => {
    const readable = new Set(['C:/Volumes/backup'])
    expect(
      partitionReadable(['C:/Volumes/backup', 'C:/Volumes/gone', 'D:/data'], (p) => readable.has(p))
    ).toEqual({ ready: ['C:/Volumes/backup'], still: ['C:/Volumes/gone', 'D:/data'] })
  })

  it('空输入不抛（没有被跳过的范围时根本不该走到这里）', () => {
    expect(partitionReadable([])).toEqual({ ready: [], still: [] })
  })
})

describe('nativePath', () => {
  it('win32 折回反斜杠，其他平台原样（索引内部只用正斜杠，边界才转）', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(nativePath('C:/Users/x/a.txt')).toBe('C:\\Users\\x\\a.txt')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    expect(nativePath('C:/Users/x/a.txt')).toBe('C:/Users/x/a.txt')
  })
})
