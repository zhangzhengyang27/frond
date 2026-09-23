// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { parseThemeFile, themeToCssVars } from '@shared/themeFile'
import { applyThemeVars } from '../useUserTheme'

/**
 * 用户主题注入器（#12 Phase 2）：覆盖样式挂/摘，以及 IPC 边界的第二道白名单。
 * 另一格是胶囊联动（P-6.3）：派生出的 `--launcher-*` 必须能走完这道白名单。
 */
afterEach(() => {
  applyThemeVars(null)
})

describe('applyThemeVars', () => {
  it('注入 :root 覆盖，再次传 null 即摘除（回到 tokens.css 现状）', () => {
    applyThemeVars({ '--surface-0': '#101014', '--text-primary': '#f2f2f5' })
    const el = document.getElementById('frond-user-theme-vars')
    expect(el?.tagName).toBe('STYLE')
    expect(el?.textContent).toContain('--surface-0:#101014;')
    // 选择器必须与 tokens.css 的 `:root.dark, html.dark` 同档，否则深色下压不过
    expect(el?.textContent).toContain(':root,:root.dark,html.dark{')
    applyThemeVars(null)
    expect(document.getElementById('frond-user-theme-vars')).toBeNull()
  })

  it('重复注入只保留一个 style 节点（不随激活次数堆积）', () => {
    applyThemeVars({ '--surface-0': '#111111' })
    applyThemeVars({ '--surface-0': '#222222' })
    expect(document.querySelectorAll('#frond-user-theme-vars')).toHaveLength(1)
    expect(document.getElementById('frond-user-theme-vars')?.textContent).toContain('#222222')
  })

  it('非白名单的变量名与值不进 CSS（这些串最终落在 DOM 里）', () => {
    applyThemeVars({
      '--ok': '#ffffff',
      'bad-name': 'red',
      '--evil': 'red; } body { display: none; }',
      '--html': '</style><img src=x>'
    })
    const css = document.getElementById('frond-user-theme-vars')?.textContent ?? ''
    expect(css).toContain('--ok:#ffffff;')
    expect(css).not.toContain('bad-name')
    expect(css).not.toContain('display:')
    expect(css).not.toContain('<img')
  })

  /**
   * 派生值必须**活着走完这道白名单**（P-6.3）。
   * 这里刻意不用手写的颜色字面量：喂的是 themeToCssVars 的真实输出，
   * 所以「派生出 rgba(...) 但渲染端正则只认 #hex」这类错配会直接判红——
   * 白名单丢弃是静默的，单看 shared 侧的派生测试发现不了。
   */
  it('真实派生表整体注入后，语义键与胶囊键都落在 CSS 里', () => {
    const parsed = parseThemeFile({
      name: 'Plum',
      appearance: 'dark',
      core: { bg: '#141018', fg: '#f4eefb', accent: '#b48ef5' }
    })
    if (!parsed.ok) throw new Error(parsed.error)
    applyThemeVars(themeToCssVars(parsed.theme))
    const css = document.getElementById('frond-user-theme-vars')?.textContent ?? ''
    expect(css).toContain('--surface-0:#141018;')
    expect(css).toContain('--launcher-bg:rgba(20, 16, 24, 0.74);')
    expect(css).toContain('--launcher-text:rgba(244, 238, 251, 0.96);')
  })
})
