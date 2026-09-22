import { describe, it, expect } from 'vitest'
import {
  CAPSULE_GLASS,
  CAPSULE_GLASS_VALUES,
  GLASS_CSS_VARS,
  applyGlassVars,
  normalizeGlass
} from '../capsuleGlass'

/**
 * 胶囊玻璃档（P-6）。
 *
 * 这里最容易被改坏的是「默认档必须什么都不覆盖」：
 * 只要 opaque 档往变量上写了值，默认观感就不再是 token 原值——所有用户第一眼就看到。
 * （实测过 setProperty(k, '') 在 Chromium 里等价于删除属性，所以「写空串」今天不会坏事；
 *  钉住 removeProperty 是要显式的「不覆盖」，不依赖那条规范细节。）
 */
function fakeEl(): { set: Record<string, string>; removed: string[]; style: never } {
  const set: Record<string, string> = {}
  const removed: string[] = []
  return {
    set,
    removed,
    style: {
      setProperty: (k: string, v: string): void => {
        set[k] = v
        removed.splice(removed.indexOf(k), 1)
      },
      removeProperty: (k: string): void => {
        removed.push(k)
        delete set[k]
      }
    } as never
  }
}

describe('normalizeGlass', () => {
  it('只认三档，其余回落 opaque（= 观感不变）', () => {
    expect(normalizeGlass('soft')).toBe('soft')
    expect(normalizeGlass('clear')).toBe('clear')
    expect(normalizeGlass('opaque')).toBe('opaque')
    for (const bad of [undefined, null, '', 'SOFT', 'glass', 1, {}]) {
      expect(normalizeGlass(bad), `应回落：${String(bad)}`).toBe('opaque')
    }
  })

  it('目录就三档且不重复', () => {
    expect(new Set(CAPSULE_GLASS_VALUES)).toEqual(new Set(['opaque', 'soft', 'clear']))
    expect(CAPSULE_GLASS_VALUES).toHaveLength(3)
  })
})

describe('applyGlassVars', () => {
  it('默认档：三个变量全部 removeProperty，一个都不 set', () => {
    const el = fakeEl()
    applyGlassVars(el, 'opaque')
    expect(el.set).toEqual({})
    expect(el.removed).toHaveLength(3)
  })

  it('先选通透再回默认：留下的不能还是覆盖值', () => {
    const el = fakeEl()
    applyGlassVars(el, 'clear')
    expect(Object.keys(el.set)).toHaveLength(3)
    applyGlassVars(el, 'opaque')
    expect(el.set).toEqual({})
    expect(el.removed).toHaveLength(3)
  })

  it('半透明与通透都要同时覆盖底色、悬浮层与模糊（少一个就是只改了一半）', () => {
    for (const glass of ['soft', 'clear'] as const) {
      const el = fakeEl()
      applyGlassVars(el, glass)
      expect(Object.keys(el.set).sort()).toEqual(
        [GLASS_CSS_VARS.bg, GLASS_CSS_VARS.elevated, GLASS_CSS_VARS.blur].sort()
      )
      expect(el.set[GLASS_CSS_VARS.bg]).toBe(CAPSULE_GLASS[glass].bg)
      expect(el.set[GLASS_CSS_VARS.elevated]).toBe(CAPSULE_GLASS[glass].elevated)
      /**
       * 「掺了透明」要能真的量出来。原来这句是 `toContain('var(--launcher-bg)')`：
       * 把值写成原封不动的 `var(--launcher-bg)`（= 这一档等于没开）它也绿。
       * 这里按 color-mix 的百分数判，两层还必须掺得一样多，否则面板与悬浮层会看出接缝。
       */

      const mixPct = (v: string): number =>
        Number(
          /^color-mix\(in srgb, var\(--launcher-bg(?:-elevated)?\) (\d{1,3})%, transparent\)$/.exec(
            v
          )?.[1] ?? NaN
        )
      const bgPct = mixPct(el.set[GLASS_CSS_VARS.bg])
      expect(bgPct, '底色不是掺透明的 color-mix 形态').toBeGreaterThan(0)
      expect(bgPct, '掺 100% 就是原值，等于这一档没生效').toBeLessThan(100)
      expect(mixPct(el.set[GLASS_CSS_VARS.elevated])).toBe(bgPct)
      expect(el.set[GLASS_CSS_VARS.blur]).toMatch(/^blur\(\d+px\)$/)
    }
  })

  const blurPx = (v: string): number => Number(/blur\((\d+)px\)/.exec(v)?.[1] ?? NaN)
  /** 只有默认档允许 null；其余档位漏覆盖任何一个变量就直接失败，不要静默比出个 NaN */
  const need = (v: string | null): string => {
    if (v === null) throw new Error('该档必须覆盖此变量')
    return v
  }

  it('通透比半透明更透（掺透明比例更大），模糊也更重', () => {
    const pct = (v: string): number => Number(/(\d+)%/.exec(v)?.[1] ?? 100)
    expect(pct(need(CAPSULE_GLASS.clear.bg))).toBeLessThan(pct(need(CAPSULE_GLASS.soft.bg)))
    expect(pct(need(CAPSULE_GLASS.clear.elevated))).toBeLessThan(
      pct(need(CAPSULE_GLASS.soft.elevated))
    )
    expect(blurPx(need(CAPSULE_GLASS.clear.blur))).toBeGreaterThan(
      blurPx(need(CAPSULE_GLASS.soft.blur))
    )
  })

  it('不写死任何颜色常量：底色一律从 token 派生（主题自动跟着走）', () => {
    for (const vars of Object.values(CAPSULE_GLASS)) {
      for (const v of [vars.bg, vars.elevated]) {
        if (v !== null) expect(v).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i)
      }
    }
  })
})
