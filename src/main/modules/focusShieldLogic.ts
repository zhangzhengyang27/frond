/**
 * Frond · 专注护盾「真拦截」决策面（2026-09-28，用户拍板升级为真拦截）
 *
 * 纯逻辑：模式归一化 + 「哪种命中配哪种执行动作」的门控。
 * Service 侧（focusShield.ts）负责 osascript 执行与恢复名单——那部分不可单测。
 *
 * 边界（写进产品口径）：执行动作（hide/quit）只对**应用命中**生效；
 * 网站命中维持遮罩提醒——替用户关网页/整只浏览器过界，不 pretend 能拦。
 */

export type ShieldMode = 'remind' | 'hide' | 'quit'

/** 存量配置无 mode 字段或非法值一律退回 remind（旧行为），不炸不猜 */
export function normalizeShieldMode(value: unknown): ShieldMode {
  return value === 'hide' || value === 'quit' ? value : 'remind'
}

export type Enforcement = 'none' | 'hide' | 'quit'

/** 模式 × 命中类型 → 执行动作；website 命中恒为 none（遮罩层负责） */
export function enforcementFor(mode: ShieldMode, kind: 'app' | 'website'): Enforcement {
  if (kind !== 'app') return 'none'
  return mode === 'hide' ? 'hide' : mode === 'quit' ? 'quit' : 'none'
}
