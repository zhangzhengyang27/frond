import { describe, it, expect } from 'vitest'
import { normalizeShieldMode, enforcementFor, type ShieldMode } from '../focusShieldLogic'

/**
 * 专注护盾「真拦截」的决策面（2026-09-28 用户拍板：升级为真拦截）。
 * 纯逻辑独立成模块：Service 侧（osascript/Electron）不可单测的部分之外，
 * 模式归一化与「哪种命中配哪种执行动作」的门控在这里钉死。
 */
describe('focusShieldLogic · 真拦截决策面', () => {
  describe('normalizeShieldMode（旧配置无 mode 字段 / 非法值一律退 remind）', () => {
    it('三种合法模式原样通过', () => {
      const modes: ShieldMode[] = ['remind', 'hide', 'quit']
      for (const m of modes) expect(normalizeShieldMode(m)).toBe(m)
    })

    it('undefined（存量配置）/乱值/非字符串 → remind', () => {
      expect(normalizeShieldMode(undefined)).toBe('remind')
      expect(normalizeShieldMode('kill')).toBe('remind')
      expect(normalizeShieldMode(42)).toBe('remind')
      expect(normalizeShieldMode(null)).toBe('remind')
    })
  })

  describe('enforcementFor（执行动作门控）', () => {
    it('remind 模式：app 与 website 命中都只弹遮罩', () => {
      expect(enforcementFor('remind', 'app')).toBe('none')
      expect(enforcementFor('remind', 'website')).toBe('none')
    })

    it('hide 模式：app 命中隐藏应用，website 命中只遮罩（诚实边界：不替用户关网页）', () => {
      expect(enforcementFor('hide', 'app')).toBe('hide')
      expect(enforcementFor('hide', 'website')).toBe('none')
    })

    it('quit 模式：app 命中优雅退出，website 命中只遮罩', () => {
      expect(enforcementFor('quit', 'app')).toBe('quit')
      expect(enforcementFor('quit', 'website')).toBe('none')
    })
  })
})
