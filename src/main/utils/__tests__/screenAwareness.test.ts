import { describe, it, expect } from 'vitest'
import {
  classifyContextError,
  formatFrontmostContext,
  frontmostContextScript,
  parseFrontmostContext,
  readFrontmostContext
} from '../screenAwareness'

/**
 * 前台窗口上下文（P-4⑤）。exec 与 platform 都是注入点，
 * 所以「未授权要说得清、不能给界面一个空上下文」这两条判据不必真去动本机 TCC。
 */
describe('parseFrontmostContext', () => {
  it('第一行是应用名，剩下是窗口标题', () => {
    expect(parseFrontmostContext('Safari\nLeaf × Raycast — Safari')).toEqual({
      appName: 'Safari',
      windowTitle: 'Leaf × Raycast — Safari'
    })
  })

  it('没有窗口（桌面/Finder 无窗）时标题为 null，不编一个', () => {
    expect(parseFrontmostContext('Finder\n')).toEqual({ appName: 'Finder', windowTitle: null })
    expect(parseFrontmostContext('Finder')).toEqual({ appName: 'Finder', windowTitle: null })
  })

  it('空白输出不产生空字符串字段', () => {
    expect(parseFrontmostContext('  \n  ')).toEqual({ appName: null, windowTitle: null })
  })
})

describe('classifyContextError', () => {
  it('几种「没授权」的文案都归到同一档', () => {
    for (const msg of [
      'osascript: *** Error: 1719: 1719: Not authorized to send Apple events to System Events.',
      'A privilege failure occurred (-1719)',
      'System Events is not allowed assistive access.',
      'An error of type -25211 has occurred.'
    ]) {
      expect(classifyContextError(msg), msg).toBe('accessibility-denied')
    }
  })

  it('取不到前台进程与别的失败要分开', () => {
    expect(classifyContextError('System Events got an error: Can’t get application process 1.')).toBe(
      'no-frontmost'
    )
    expect(classifyContextError('spawn ENOENT')).toBe('failed')
    expect(classifyContextError('')).toBe('failed')
  })
})

describe('readFrontmostContext', () => {
  it('非 darwin 直接 unsupported，不去跑 osascript', async () => {
    let called = false
    const r = await readFrontmostContext({
      platform: 'win32',
      exec: async () => {
        called = true
        return { stdout: '', stderr: '' }
      }
    })
    expect(r).toMatchObject({ ok: false, error: 'unsupported' })
    expect(called).toBe(false)
  })

  it('成功时带出应用名与窗口标题', async () => {
    const r = await readFrontmostContext({
      platform: 'darwin',
      exec: async () => ({ stdout: 'Xcode\nAppDelegate.swift\n', stderr: '' })
    })
    expect(r).toMatchObject({ ok: true, appName: 'Xcode', windowTitle: 'AppDelegate.swift' })
    expect(formatFrontmostContext(r)).toBe('【当前前台】Xcode · AppDelegate.swift')
  })

  it('未授权：needsAccessibility=true，界面据此给「打开设置」', async () => {
    const r = await readFrontmostContext({
      platform: 'darwin',
      exec: async () => {
        throw new Error('1719: Not authorized to send Apple events to System Events.')
      }
    })
    expect(r).toMatchObject({ ok: false, error: 'accessibility-denied', needsAccessibility: true })
    expect(formatFrontmostContext(r)).toBe('')
  })

  it('脚本没报错但也没给出应用名 → 算失败，不给空上下文', async () => {
    const r = await readFrontmostContext({
      platform: 'darwin',
      exec: async () => ({ stdout: '\n', stderr: '' })
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('no-frontmost')
  })

  it('脚本内容里不出现 shell 元字符依赖（走 execFile 参数数组）', () => {
    const script = frontmostContextScript()
    expect(script).toContain('System Events')
    expect(script).toContain('front window')
    expect(script).not.toContain(';')
  })
})
