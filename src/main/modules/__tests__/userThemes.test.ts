import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listThemesIn,
  installThemeFileInto,
  safeThemeFileName,
  MAX_THEME_FILE_BYTES
} from '../userThemes'

/**
 * 用户主题文件读写层（#12 Phase 2）。测的是 dir 参数化的纯函数版：
 * 喂真实临时目录，不依赖 electron 的 userData。
 */
let dir: string
let src: string

const THEME = {
  name: 'Plum Night',
  appearance: 'dark',
  core: { bg: '#141018', fg: '#f4eefb', accent: '#b48ef5' }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'leaf-themes-'))
  src = mkdtempSync(join(tmpdir(), 'leaf-theme-src-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  rmSync(src, { recursive: true, force: true })
})

describe('listThemesIn', () => {
  it('合法与非法混排：好的进列表，坏的带原因，互不拖累', () => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(THEME))
    writeFileSync(join(dir, 'broken.json'), '{ not json')
    writeFileSync(
      join(dir, 'evil.json'),
      JSON.stringify({ ...THEME, name: 'E', core: { bg: 'red; x', fg: '#fff', accent: '#fff' } })
    )
    writeFileSync(join(dir, 'notes.txt'), 'ignored')
    const { themes, rejected } = listThemesIn(dir)
    expect(themes.map((t) => t.theme.id)).toEqual(['plum-night'])
    expect(rejected.map((r) => r.file).sort()).toEqual(['broken.json', 'evil.json'])
    expect(rejected.find((r) => r.file === 'evil.json')?.error).toContain('core.bg')
  })

  it('id 重复只留先出现的', () => {
    writeFileSync(join(dir, '1.json'), JSON.stringify({ ...THEME, id: 'same' }))
    writeFileSync(join(dir, '2.json'), JSON.stringify({ ...THEME, id: 'same', name: '另一个' }))
    const { themes, rejected } = listThemesIn(dir)
    expect(themes).toHaveLength(1)
    expect(rejected[0]?.error).toContain('id 重复')
  })

  it('目录不存在时返回空而不是抛', () => {
    expect(listThemesIn(join(dir, 'nope'))).toEqual({ themes: [], rejected: [] })
  })

  it('超大文件直接拒绝（不进 JSON.parse）', () => {
    writeFileSync(join(dir, 'huge.json'), `"${'x'.repeat(MAX_THEME_FILE_BYTES + 10)}`)
    const { themes, rejected } = listThemesIn(dir)
    expect(themes).toEqual([])
    expect(rejected[0]?.error).toContain('上限')
  })
})

describe('installThemeFileInto', () => {
  it('校验通过才落盘；落盘内容是重新序列化的结果（未知键不留）', () => {
    writeFileSync(join(src, 'in.json'), JSON.stringify({ ...THEME, junk: 'x' }))
    const r = installThemeFileInto(join(src, 'in.json'), dir)
    if (!r.ok) throw new Error(r.error)
    expect(r.file).toBe('plum-night.json')
    expect(readdirSync(dir)).toEqual(['plum-night.json'])
    const written = JSON.parse(readFileSync(join(dir, r.file), 'utf8')) as Record<string, unknown>
    expect(written).not.toHaveProperty('junk')
    expect(listThemesIn(dir).themes[0]?.theme.name).toBe('Plum Night')
  })

  it('非法文件不落盘', () => {
    writeFileSync(join(src, 'bad.json'), JSON.stringify({ name: 'x', appearance: 'neon' }))
    const r = installThemeFileInto(join(src, 'bad.json'), dir)
    expect(r.ok).toBe(false)
    expect(readdirSync(dir)).toEqual([])
  })

  it('目标名只由 id 派生（穿越段与超长 id 都被归一）', () => {
    expect(safeThemeFileName('../../etc/passwd')).toBe('etc-passwd.json')
    expect(safeThemeFileName('')).toBe('theme.json')
    expect(safeThemeFileName('x'.repeat(200))).toHaveLength(48 + '.json'.length)
  })
})
