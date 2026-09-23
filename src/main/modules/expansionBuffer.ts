/**
 * Frond · 文本扩展按键缓冲（M5.1，纯逻辑可单测）
 *
 * 维护最近键入的字符流（带退格回滚）。触发词必须后跟分隔符（空格 / 回车 /
 * Tab）才命中——避免词中误触发（如触发词 "sig" 不应让 "design" 展开）。
 * 命中返回触发词 + 尾随分隔符（粘贴时保留），并把分隔符之前的文本清空。
 * 任何不可打印按键（方向键 / 切窗 / 中文 IME 提交等）视为上下文切换，清空缓冲。
 */

import { keycodeToChar, VC_BACKSPACE, VC_MODIFIERS } from './keycodes'

export interface ExpansionTrigger {
  /** 触发词，如 ";brb"（统一小写比较） */
  trigger: string
  /** 扩展后要粘贴的文本；contentType='rich' 时为 HTML 源 */
  text: string
  /** 内容类型：'text'（缺省）纯文本；'rich' 走剪贴板 text/html 双格式粘贴 */
  contentType?: 'text' | 'rich'
}

export interface ExpansionHit extends ExpansionTrigger {
  /** 触发热键的分隔符字符（粘贴时附加在文本后） */
  trailing: string
}

const MAX_BUFFER = 64
/** 输入停顿超过该时间重置缓冲（跨窗口的零散按键不应拼成触发词） */
export const BUFFER_IDLE_RESET_MS = 3000

/** VC keycode → 分隔符字符（触发词边界） */
const DELIMITERS = new Map<number, string>([
  [0x1c, '\n'], // Return
  [0x0f, '\t'], // Tab
  [0x39, ' '] // Space
])

export class ExpansionBuffer {
  private chars: string[] = []
  private lastInputAt = 0

  constructor(private triggers: ExpansionTrigger[] = []) {}

  setTriggers(triggers: ExpansionTrigger[]): void {
    this.triggers = triggers
  }

  getText(): string {
    return this.chars.join('')
  }

  /** 处理一次 keydown；返回命中（触发词后跟分隔符时），否则 null */
  feed(keycode: number, shift: boolean, now = Date.now()): ExpansionHit | null {
    if (VC_MODIFIERS.has(keycode)) return null // 修饰键不重置不进缓冲
    if (now - this.lastInputAt > BUFFER_IDLE_RESET_MS) this.chars = []
    this.lastInputAt = now

    if (keycode === VC_BACKSPACE) {
      this.chars.pop()
      return null
    }

    // 分隔键（Return/Tab 不在字符映射内，须先查）：看「分隔符之前的文本」
    // 是否以触发词结尾（取最长触发词）
    const delimiter = DELIMITERS.get(keycode)
    if (delimiter !== undefined && this.chars.length > 0) {
      const hit = this.match(this.chars.join(''))
      if (hit) {
        this.reset()
        return { ...hit, trailing: delimiter }
      }
    }

    const ch = keycodeToChar(keycode, shift)
    if (ch === null) {
      // 不可打印键（方向键 / 功能键 / IME 提交…）：上下文已变，清空重来
      this.chars = []
      return null
    }

    this.chars.push(ch)
    if (this.chars.length > MAX_BUFFER) this.chars.splice(0, this.chars.length - MAX_BUFFER)
    return null
  }

  reset(): void {
    this.chars = []
    this.lastInputAt = 0
  }

  /** 结尾匹配：多触发词命中同一缓冲时取最长触发词 */
  private match(text: string): ExpansionTrigger | null {
    if (this.triggers.length === 0) return null
    const lower = text.toLowerCase()
    let best: ExpansionTrigger | null = null
    for (const t of this.triggers) {
      const key = t.trigger.toLowerCase()
      if (key.length === 0 || key.length > lower.length) continue
      if (lower.endsWith(key) && (best === null || key.length > best.trigger.length)) {
        best = t
      }
    }
    return best
  }
}
