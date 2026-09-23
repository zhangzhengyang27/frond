import { describe, it, expect } from 'vitest'
import {
  BUILTIN_THEMES,
  FROND_LIGHT_THEME,
  FROND_DARK_THEME,
  type ThemeDefinition
} from '../themeSchema'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 主题 Schema 不变量（#12）：
 * 1. 亮/暗两套定义的键结构完全一致（用户主题文件按此 schema 校验）
 * 2. 值与 tokens.css 运行时事实源 1:1 同步（防手改 CSS 后 schema 漂移）
 * 3. 语义子表齐全（core/accent/surface/border/text/glass）
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const tokensCss = readFileSync(
  join(__dirname, '..', '..', 'renderer', 'src', 'styles', 'tokens.css'),
  'utf-8'
)

function subtableKeys(theme: ThemeDefinition): string[] {
  return [
    ...Object.keys(theme.surface),
    ...Object.keys(theme.border),
    ...Object.keys(theme.text),
    ...Object.keys(theme.glass)
  ].sort()
}

describe('themeSchema 结构不变量', () => {
  it('亮/暗主题键结构完全一致（用户主题文件按此 schema 校验）', () => {
    expect(subtableKeys(FROND_DARK_THEME)).toEqual(subtableKeys(FROND_LIGHT_THEME))
    expect(Object.keys(FROND_DARK_THEME.core)).toEqual(Object.keys(FROND_LIGHT_THEME.core))
  })

  it('内置主题齐全且 appearance 正确', () => {
    expect(BUILTIN_THEMES).toHaveLength(2)
    expect(FROND_LIGHT_THEME.appearance).toBe('light')
    expect(FROND_DARK_THEME.appearance).toBe('dark')
  })

  it('core.bg 与 surface-0 一致（画布底色同源）', () => {
    expect(FROND_LIGHT_THEME.core.bg).toBe(FROND_LIGHT_THEME.surface['surface-0'])
    expect(FROND_DARK_THEME.core.bg).toBe(FROND_DARK_THEME.surface['surface-0'])
  })

  it('值与 tokens.css 同步（抽查语义层关键变量，防漂移）', () => {
    // 每条断言：CSS 变量的亮/暗值必须与 schema 一致——手改 CSS 忘改 schema 时此测试红
    const expectVarPair = (name: string, light: string, dark: string): void => {
      expect(FROND_LIGHT_THEME).toEqual(
        expect.objectContaining({})
      )
      expect(light).toBeTruthy()
      expect(dark).toBeTruthy()
      // schema 侧
      const find = (theme: ThemeDefinition): string | undefined => {
      const tables = [theme.surface, theme.text, theme.border, theme.glass] as unknown as Array<
        Record<string, string>
      >
        for (const t of tables) if (name in t) return t[name]
        return undefined
      }
      expect(find(FROND_LIGHT_THEME)).toBe(light)
      expect(find(FROND_DARK_THEME)).toBe(dark)
      // CSS 侧：变量在 tokens.css 中定义且值包含主题字面量
      expect(tokensCss).toContain(`--${name}: ${light}`)
    }

    expectVarPair('surface-0', '#f5f5f7', '#191a1e')
    expectVarPair('surface-1', '#ffffff', '#222329')
    expectVarPair('border-default', 'rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.11)')
    expectVarPair('text-primary', '#1d1d1f', '#f5f5f7')
    expectVarPair('text-brand', '#0064d2', '#6fb2ff')
    expectVarPair('glass-bg', 'rgba(255, 255, 255, 0.68)', 'rgba(26, 27, 31, 0.72)')
  })

  it('core.accent 与品牌默认一致（launch 胶囊强调色为独立拍板，不在本 schema）', () => {
    // 浅色端 accent = brand-500；深色端 = systemBlue dark
    expect(FROND_LIGHT_THEME.core.accent).toBe('#007aff')
    expect(FROND_DARK_THEME.core.accent).toBe('#0a84ff')
    // 胶囊强调色（Raycast 红，Decision-010）独立于本 schema——确保未被误并
    expect(tokensCss).toContain('--launcher-accent: #ff6363')
    expect(FROND_LIGHT_THEME.core.accent).not.toBe('#ff6363')
  })
})
