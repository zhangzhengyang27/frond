import { describe, it, expect } from 'vitest'
import {
  DENSITY,
  DENSITY_CSS_VARS,
  DENSITY_VALUES,
  applyDensityVars,
  normalizeDensity
} from '../density'

/**
 * 列表密度（P-6 Compact Mode）。
 * 这里守的是两件事：档位只认两个值（存量的脏数据不能把胶囊搞成没样式），
 * 以及「紧凑」真的比「宽松」小——写成数字常量很容易被后改的人改反。
 */
describe('normalizeDensity', () => {
  it('两个合法值原样，其余一律回落 comfortable', () => {
    expect(normalizeDensity('compact')).toBe('compact')
    expect(normalizeDensity('comfortable')).toBe('comfortable')
    for (const bad of [undefined, null, '', 'COMPACT', 'dense', 0, {}, []]) {
      expect(normalizeDensity(bad), `应回落：${String(bad)}`).toBe('comfortable')
    }
  })
})

describe('DENSITY 档位', () => {
  it('目录里就两档，且紧凑档处处不大于宽松档、至少一项严格更小', () => {
    expect(new Set(DENSITY_VALUES)).toEqual(new Set(['comfortable', 'compact']))
    expect(DENSITY_VALUES).toHaveLength(2)
    const c = DENSITY.compact
    const f = DENSITY.comfortable
    for (const key of Object.keys(c) as Array<keyof typeof c>) {
      expect(parseFloat(c[key]), `${key} 紧凑档不应更大`).toBeLessThanOrEqual(parseFloat(f[key]))
    }
    expect(parseFloat(c.rowMinHeight)).toBeLessThan(parseFloat(f.rowMinHeight))
    expect(parseFloat(c.rowPadY)).toBeLessThan(parseFloat(f.rowPadY))
  })

  it('像素值都写成 px 且能解析（样式侧靠 var() 读，写成 rem/数字会让兜底失效）', () => {
    for (const v of Object.values(DENSITY.comfortable)) expect(v).toMatch(/^\d+(\.\d+)?px$/)
    expect(Object.values(DENSITY_CSS_VARS).every((n) => n.startsWith('--frond-'))).toBe(true)
  })
})

describe('applyDensityVars', () => {
  it('三个变量都落到元素上，值与档位一致', () => {
    const set: Record<string, string> = {}
    const fake = {
      style: {
        setProperty: (k: string, v: string): void => {
          set[k] = v
        }
      }
    }
    applyDensityVars(fake, 'compact')
    expect(set).toEqual({
      '--frond-row-pad-y': DENSITY.compact.rowPadY,
      '--frond-row-min-h': DENSITY.compact.rowMinHeight,
      '--frond-section-gap': DENSITY.compact.sectionGap
    })

    applyDensityVars(fake, '不认识的档' as never)
    expect(set['--frond-row-min-h']).toBe(DENSITY.comfortable.rowMinHeight)
  })
})
