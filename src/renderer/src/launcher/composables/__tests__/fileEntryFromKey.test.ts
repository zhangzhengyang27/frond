import { describe, it, expect } from 'vitest'
import { fileEntryFromKey } from '../launcherInteractions'

describe('fileEntryFromKey（P-3 frecency 全类型：usage key → 空态建议条目）', () => {
  it('file:<path> 合成可执行条目：标题取 basename、副标题取目录', () => {
    const e = fileEntryFromKey('file:/Users/me/docs/report.pdf')
    expect(e).not.toBeNull()
    expect(e?.key).toBe('file:/Users/me/docs/report.pdf')
    expect(e?.title).toBe('report.pdf')
    expect(e?.subtitle).toBe('/Users/me/docs')
    expect(e?.badge).toBe('文件')
    expect(e?.action).toEqual({ type: 'file', path: '/Users/me/docs/report.pdf', name: 'report.pdf' })
  })

  it('Windows 反斜杠路径同样可合成', () => {
    const e = fileEntryFromKey('file:C:\\work\\a.ts')
    expect(e?.title).toBe('a.ts')
    expect(e?.subtitle).toBe('C:\\work')
  })

  it('根目录裸文件名：副标题回落完整路径', () => {
    const e = fileEntryFromKey('file:README.md')
    expect(e?.title).toBe('README.md')
    expect(e?.subtitle).toBe('file:README.md'.slice(5))
  })

  it('非 file 前缀 / 空路径 → null（clip:/snip: 防悬空，宁可不上建议）', () => {
    expect(fileEntryFromKey('clip:abc')).toBeNull()
    expect(fileEntryFromKey('snip:1')).toBeNull()
    expect(fileEntryFromKey('module:pomodoro')).toBeNull()
    expect(fileEntryFromKey('file:')).toBeNull()
  })
})
