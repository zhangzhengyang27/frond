/**
 * 修饰键动作键位（P-1.1）
 *
 * 动作声明键 → 与键盘事件比对的纯函数。独立成模块而不是写进 keydown：
 * 「哪些键算命中」必须可单测，否则面板键帽标注与实际绑定会再次分叉
 * （见 useActionPanel.ts:15 的历史教训——曾按标签猜 ⌘C/⌘R 但并未绑定）。
 */

/** 键盘事件的修饰键 + 键位最小面（不引第三方库：只需比对四个布尔） */
export interface KeyEventLike {
  /** KeyboardEvent.key 原值（字母可能因 ⇧ 而大写） */
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

/** 动作声明的键，形如 `cmd+backspace` / `cmd+shift+c`（全小写、修饰键在前、`+` 分隔） */
export type ActionKey = string

/** 修饰键字形（顺序按声明原样输出，与 Apple 的 ⌘⌥⇧⌃ 展示习惯一致） */
const MODIFIER_GLYPHS: Record<string, string> = {
  cmd: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧'
}

/** 特殊键字形；表外的键（字母）走 toUpperCase */
const KEY_GLYPHS: Record<string, string> = {
  backspace: '⌫',
  delete: '⌦',
  enter: '↵',
  escape: '⎋',
  tab: '⇥',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→'
}

/** 比对单个键位声明：修饰键要求逐个相等，少按多按都不算命中 */
export function matchActionKey(ev: KeyEventLike, spec: ActionKey): boolean {
  const parts = spec.toLowerCase().split('+')
  const key = parts.pop()
  if (!key) return false
  if (!!ev.metaKey !== parts.includes('cmd')) return false
  if (!!ev.ctrlKey !== parts.includes('ctrl')) return false
  if (!!ev.shiftKey !== parts.includes('shift')) return false
  if (!!ev.altKey !== parts.includes('alt')) return false
  // 键位两侧都归一到小写：字母因 ⇧ 给出大写，特殊键 KeyboardEvent.key 是 'Backspace' 这种首字母大写形态
  const actual = ev.key.toLowerCase()
  return actual === key
}

/** 键位声明 → mac 字形（⌘⌫ / ⌘⇧C）：面板键帽由真实绑定生成，不按标签猜 */
export function prettyKey(spec: ActionKey): string {
  const parts = spec.toLowerCase().split('+')
  const key = parts.pop() ?? ''
  const modifiers = parts.map((p) => MODIFIER_GLYPHS[p] ?? '').join('')
  return `${modifiers}${KEY_GLYPHS[key] ?? key.toUpperCase()}`
}

/** 从动作集中找出该按键命中的第一条；未声明 key 的动作永不参与匹配 */
export function resolveModifierAction<T extends { key?: ActionKey }>(
  actions: T[],
  ev: KeyEventLike
): T | null {
  return actions.find((a) => a.key !== undefined && matchActionKey(ev, a.key)) ?? null
}

/**
 * 被二级动作占用的组合。即使当前高亮行没有对应动作也要吃掉这些键：
 * 否则 ⌘⌫ 会穿透成输入框的「删到行首」，把用户辛苦敲的查询词整个清掉。
 */
export const RESERVED_COMBOS: ActionKey[] = [
  'cmd+backspace',
  'cmd+shift+c',
  'cmd+shift+v',
  'cmd+shift+f',
  'cmd+shift+k'
]

export function isReservedCombo(ev: KeyEventLike): boolean {
  return RESERVED_COMBOS.some((spec) => matchActionKey(ev, spec))
}
