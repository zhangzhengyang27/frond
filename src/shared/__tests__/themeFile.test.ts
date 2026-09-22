import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseThemeFile, themeToCssVars, builtinTheme, launcherThemeVars } from '../themeFile'
import { LEAF_DARK_THEME } from '../themeSchema'

/**
 * 用户主题文件数据层（#12 Phase 2）：fail-closed 校验、core 派生、
 * CSS 注入面的白名单，以及「不可派生项继承内置基座」。
 * 另一格是胶囊联动（P-6.3）：主题只进 `--launcher-*` 的表面/文本那一组。
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const VALID = {
  name: 'My Theme',
  appearance: 'dark',
  core: { bg: '#101014', fg: '#f2f2f5', accent: '#ff5fa2' }
}

describe('parseThemeFile', () => {
  it('最小合法文件（只有 core）解析成功并派生整套语义', () => {
    const r = parseThemeFile(VALID)
    if (!r.ok) throw new Error(r.error)
    expect(r.theme.id).toBe('my-theme')
    expect(r.theme.core.bg).toBe('#101014')
    // 派生：语义子表全部有值，且核心关系成立
    expect(r.theme.surface['surface-0']).toBe('#101014')
    expect(r.theme.text['text-primary']).toBe('#f2f2f5')
    expect(r.theme.text['text-inverse']).toBe('#101014')
    expect(r.theme.border['border-strong']).toMatch(/^rgba\(/)
    for (const table of ['surface', 'border', 'text', 'glass'] as const) {
      for (const [k, v] of Object.entries(r.theme[table])) {
        expect(v, `${table}.${k}`).toBeTruthy()
      }
    }
  })

  it('不可从 core 派生的令牌继承同 appearance 的内置主题', () => {
    const r = parseThemeFile(VALID)
    if (!r.ok) throw new Error(r.error)
    expect(r.theme.text['text-danger']).toBe(LEAF_DARK_THEME.text['text-danger'])
    expect(r.theme.text['text-success']).toBe(LEAF_DARK_THEME.text['text-success'])
  })

  it('显式覆盖优先于派生值', () => {
    const r = parseThemeFile({
      ...VALID,
      text: { 'text-secondary': '#112233' },
      surface: { 'surface-hover': 'rgba(1, 2, 3, 0.5)' }
    })
    if (!r.ok) throw new Error(r.error)
    expect(r.theme.text['text-secondary']).toBe('#112233')
    expect(r.theme.surface['surface-hover']).toBe('rgba(1, 2, 3, 0.5)')
    expect(r.theme.text['text-tertiary']).not.toBe('#112233') // 其余仍派生
  })

  it('CSS 注入面：带 ; } < url( 的值一律拒绝（白名单，不做转义）', () => {
    const evil = ['red; color: blue', 'url(evil.png)', '</style><script>', '#fff}', 'red}x']
    for (const value of evil) {
      const r = parseThemeFile({ ...VALID, core: { ...VALID.core, bg: value } })
      expect(r.ok, String(value)).toBe(false)
      if (!r.ok) expect(r.error).toContain('core.bg')
    }
    // 纯字母形态按 CSS 颜色名放行：写错名字只会让该条声明无效（浏览器回落
    // tokens.css 既有值），不构成注入面
    const nameLike = parseThemeFile({ ...VALID, core: { ...VALID.core, bg: 'rebeccapurple' } })
    expect(nameLike.ok).toBe(true)
  })

  /**
   * hex 只认 3/4/6/8 位。`{3,8}` 那种写法会把 5/7 位放进来：
   * CSS 不认它（那条声明静默失效），派生用的 parseColor 也不认它（整套语义色不派生），
   * 两头都不报错——所以必须在消毒那一步就拒。
   */
  it('hex 位数只收 3/4/6/8，5、7 位直接报错', () => {
    for (const bad of ['#abcde', '#abcdefg']) {
      const r = parseThemeFile({ ...VALID, core: { ...VALID.core, bg: bad } })
      expect(r.ok, bad).toBe(false)
      if (!r.ok) expect(r.error).toContain('core.bg')
    }
    for (const good of ['#abc', '#abcd', '#abcdef', '#abcdef12']) {
      const r = parseThemeFile({ ...VALID, core: { ...VALID.core, bg: good } })
      expect(r.ok, good).toBe(true)
    }
  })

  it('字段级失败原因：appearance 非法 / name 缺失 / core 缺项', () => {
    const cases: Array<[unknown, string]> = [
      [{ ...VALID, appearance: 'system' }, 'appearance'],
      [{ appearance: 'dark', core: VALID.core }, 'name'],
      [{ ...VALID, core: { bg: '#000', fg: '#fff' } }, 'core.accent']
    ]
    for (const [input, field] of cases) {
      const r = parseThemeFile(input)
      expect(r.ok, field).toBe(false)
      if (!r.ok) expect(r.error).toContain(field)
    }
  })

  it('未知键忽略、非对象根拒绝', () => {
    expect(parseThemeFile(null).ok).toBe(false)
    expect(parseThemeFile([1, 2]).ok).toBe(false)
    const r = parseThemeFile({ ...VALID, evil: { a: 'x' }, text: { 'not-a-token': 'red' } })
    if (!r.ok) throw new Error(r.error)
    expect(r.theme.text).not.toHaveProperty('not-a-token')
  })

  it('解析是确定性的（同一输入两次结果相同，供启动期比对）', () => {
    const a = parseThemeFile(VALID)
    const b = parseThemeFile(VALID)
    expect(a).toEqual(b)
  })

  it('非拉丁主题名的 id 也确定（id 会被持久化成激活主题，不稳定=重启即失效）', () => {
    const cjk = { name: '墨夜', appearance: 'dark', core: VALID.core }
    const a = parseThemeFile(cjk)
    const b = parseThemeFile(cjk)
    if (!a.ok || !b.ok) throw new Error('应解析成功')
    expect(a.theme.id).toMatch(/^theme-[a-z0-9]+$/)
    expect(a.theme.id).toBe(b.theme.id)
    // 不同名字不撞同一个 id
    const other = parseThemeFile({ ...cjk, name: '竹青' })
    if (!other.ok) throw new Error('应解析成功')
    expect(other.theme.id).not.toBe(a.theme.id)
  })

  it('hsl / 颜色名等不参与派生但可作显式值（不猜色彩）', () => {
    const r = parseThemeFile({ ...VALID, text: { 'text-muted': 'rebeccapurple' } })
    if (!r.ok) throw new Error(r.error)
    expect(r.theme.text['text-muted']).toBe('rebeccapurple')
    const hslOnly = parseThemeFile({
      name: 'hsl core',
      appearance: 'light',
      core: { bg: 'hsl(0 0% 100%)', fg: 'hsl(0 0% 10%)', accent: 'hsl(210 100% 50%)' }
    })
    if (!hslOnly.ok) throw new Error(hslOnly.error)
    // core 无法数值化 → 不派生，回落到内置浅色基座
    expect(hslOnly.theme.text['text-secondary']).toBeTruthy()
  })
})

describe('themeToCssVars', () => {
  it('输出 22 个语义变量（与 tokens.css 同名），值全部过消毒白名单', () => {
    const r = parseThemeFile(VALID)
    if (!r.ok) throw new Error(r.error)
    const vars = themeToCssVars(r.theme)
    const semanticCount = ['surface', 'border', 'text', 'glass'].reduce(
      (n, t) => n + Object.keys(r.theme[t as 'surface']).length,
      0
    )
    expect(semanticCount).toBe(22)
    // 胶囊联动键（launcherThemeVars）另加，固定 12 个：加一个键要在这里点名
    const launcherKeys = Object.keys(vars).filter((k) => k.startsWith('--launcher-'))
    expect(launcherKeys).toHaveLength(12)
    expect(Object.keys(vars)).toHaveLength(semanticCount + 12)
    for (const [name, value] of Object.entries(vars)) {
      expect(name.startsWith('--')).toBe(true)
      expect(value).toMatch(/^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d.,\s/-]+\)|[a-zA-Z]+)$/)
    }
    // bg/fg 的落点是 --surface-0 / --text-primary，不存在的 --bg 不得出现
    expect(vars['--surface-0']).toBe('#101014')
    expect(vars['--text-primary']).toBe('#f2f2f5')
    expect(vars).not.toHaveProperty('--bg')
  })

  it('内置主题可按 id 取用', () => {
    expect(builtinTheme('leaf-dark')?.appearance).toBe('dark')
    expect(builtinTheme('nope')).toBeNull()
  })
})

/**
 * 胶囊联动（P-6.3，Decision-010 复审后的口径）：用户主题的表面/文本进 `--launcher-*`，
 * 强调色与几何维持独立拍板。这里钉的是「联动到哪为止」——多一个键就是替用户改了
 * 一件他没要求改的事。
 */
describe('launcherThemeVars', () => {
  const dark = launcherThemeVars({ bg: '#141018', fg: '#f4eefb' })
  const light = launcherThemeVars({ bg: '#ffffff', fg: '#1d1d1f' })

  it('键集合固定为这 12 个，且每个都在 tokens.css 里真存在（不发没人读的变量）', () => {
    expect(Object.keys(dark).sort()).toEqual(
      [
        '--launcher-bg',
        '--launcher-bg-elevated',
        '--launcher-popover-bg',
        '--launcher-border',
        '--launcher-hairline',
        '--launcher-text',
        '--launcher-text-dim',
        '--launcher-text-muted',
        '--launcher-text-faint',
        '--launcher-selected-bg',
        '--launcher-result-hover',
        '--launcher-input-bg'
      ].sort()
    )
    const css = readFileSync(
      join(__dirname, '..', '..', 'renderer', 'src', 'styles', 'tokens.css'),
      'utf-8'
    )
    for (const key of Object.keys(dark)) {
      expect(css, `tokens.css 里没有 ${key}`).toContain(`${key}:`)
    }
  })

  it('强调色与几何一个都不进（Decision-010：launcher 强调色是独立拍板）', () => {
    for (const key of Object.keys(dark)) {
      expect(key).not.toMatch(/accent|indicator|badge|danger|radius|height|width|shadow|blur/)
    }
  })

  it('深色主题的底色保留 alpha：主题一开不能把毛玻璃变成死色块', () => {
    expect(dark['--launcher-bg']).toMatch(/^rgba\(20, 16, 24, 0\.74\)$/)
    // 浅色档与 tokens.css 同形（实色 #ffffff），透明度交给胶囊玻璃档那一格
    expect(light['--launcher-bg']).toBe('#ffffff')
  })

  it('深浅看 core.bg 的实际亮度，不看 appearance 字符串', () => {
    // 同一套 bg/fg 无论走哪条分支都该得到同一张表——这里直接喂反过来的亮度
    const bright = launcherThemeVars({ bg: '#f5f5f7', fg: '#1d1d1f' })
    expect(bright['--launcher-bg']).toBe('#f5f5f7')
    expect(bright['--launcher-text']).toMatch(/^rgba\(/)
  })

  it('文本层级单调：primary > dim > muted > faint 的 alpha 依次严格递减', () => {
    const a = (v: string): number => Number(/,\s*([\d.]+)\)$/.exec(v)?.[1] ?? NaN)
    const keys = [
      '--launcher-text',
      '--launcher-text-dim',
      '--launcher-text-muted',
      '--launcher-text-faint'
    ]
    const seq = keys.map((k) => a(dark[k]))
    expect(seq.every(Number.isFinite)).toBe(true)
    // 四档必须互不相同，否则「递减」会被四个相等糊过去
    expect(new Set(seq).size).toBe(4)
    expect(seq).toEqual([...seq].sort((x, y) => y - x))
  })

  it('core 落不进数值形态（hsl / 颜色名）时一个键都不发：宁可整套保持 tokens.css', () => {
    expect(launcherThemeVars({ bg: 'hsl(0 0% 100%)', fg: 'hsl(0 0% 10%)' })).toEqual({})
    expect(launcherThemeVars({ bg: 'rebeccapurple', fg: 'white' })).toEqual({})
    const r = parseThemeFile({
      name: 'hsl core',
      appearance: 'light',
      core: { bg: 'hsl(0 0% 100%)', fg: 'hsl(0 0% 10%)', accent: 'hsl(210 100% 50%)' }
    })
    if (!r.ok) throw new Error(r.error)
    const vars = themeToCssVars(r.theme)
    expect(Object.keys(vars).filter((k) => k.startsWith('--launcher-'))).toEqual([])
  })
})
