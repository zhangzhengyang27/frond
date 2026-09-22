/**
 * 计算器兜底（M1.3）：白名单表达式安全求值。
 *
 * 实现为递归下降解析器（零 eval）：胶囊 CSP 不含 unsafe-eval，
 * Function/eval 在渲染进程会被拦截，因此不用 Function/mathjs。
 * 语法：expr := term (('+'|'-') term)*; term := unary (('*'|'/'|'%') unary)*;
 * unary := ('-'|'+') unary | power; power := primary ('^' unary)?（右结合）;
 * primary := number | '(' expr ')'
 */

export interface CalcResult {
  /** 原始表达式（用户输入） */
  expr: string
  value: number
  /** 展示用结果（去除浮点尾差） */
  formatted: string
}

const MAX_LEN = 64
const MAX_INPUT_LEN = 80

class Parser {
  private pos = 0
  constructor(private readonly src: string) {}

  parse(): number {
    const value = this.expr()
    this.skipWs()
    if (this.pos < this.src.length) throw new Error('unexpected trailing input')
    return value
  }

  private skipWs(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++
  }

  private peek(): string {
    this.skipWs()
    return this.src[this.pos] ?? ''
  }

  private eat(ch: string): boolean {
    if (this.peek() === ch) {
      this.pos++
      return true
    }
    return false
  }

  private expr(): number {
    let left = this.term()
    for (;;) {
      if (this.eat('+')) left += this.term()
      else if (this.eat('-')) left -= this.term()
      else return left
    }
  }

  private term(): number {
    let left = this.unary()
    for (;;) {
      if (this.eat('*')) left *= this.unary()
      else if (this.eat('/')) left /= this.unary()
      else if (this.eat('%')) left %= this.unary()
      else return left
    }
  }

  private unary(): number {
    if (this.eat('-')) return -this.unary()
    if (this.eat('+')) return this.unary()
    return this.power()
  }

  private power(): number {
    const base = this.primary()
    if (this.eat('^')) return Math.pow(base, this.unary())
    return base
  }

  private primary(): number {
    if (this.eat('(')) {
      const value = this.expr()
      if (!this.eat(')')) throw new Error('missing )')
      return value
    }
    const start = this.pos
    while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) this.pos++
    if (start === this.pos) throw new Error('expected number')
    const num = Number(this.src.slice(start, this.pos))
    if (!Number.isFinite(num)) throw new Error('bad number')
    return num
  }
}

/**
 * 自然语言薄层（对标 Raycast 常用算式）：
 * - "20% of 150"  → "150 * 0.2"（150 的 20%）
 * - "20% off 150" → "150 - 150 * 0.2"（打 8 折）
 * 归一化后的表达式再进白名单解析器；输出 expr 保留归一化式子便于核对。
 */
function normalizeNaturalLanguage(q: string): string {
  return q
    .replace(
      /(-?\d+(?:\.\d+)?)\s*%\s*of\s*(-?\d+(?:\.\d+)?)/gi,
      (_m, pct: string, base: string) => `(${base} * ${pct} / 100)`
    )
    .replace(
      /(-?\d+(?:\.\d+)?)\s*%\s*off\s*(-?\d+(?:\.\d+)?)/gi,
      (_m, pct: string, base: string) => `(${base} - ${base} * ${pct} / 100)`
    )
}

export function evaluateExpression(query: string): CalcResult | null {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length > MAX_INPUT_LEN || !/\d/.test(trimmed)) return null

  // 自然语言归一化（20% of 150 / 20% off 150）
  let exprSource = trimmed
  if (/%\s*(of|off)\s*\d/i.test(trimmed)) {
    exprSource = normalizeNaturalLanguage(trimmed)
    if (exprSource.length > MAX_LEN) return null
  }

  // 必须含运算符（纯数字不算计算，让位给应用/文件搜索）
  if (!/[-+*/^%]/.test(exprSource)) return null
  // 白名单字符校验（防御性：解析器本身也只认这些字符）
  if (!/^[0-9+\-*/^%().\s]+$/.test(exprSource)) return null
  if (exprSource.length > MAX_LEN) return null

  try {
    const value = new Parser(exprSource).parse()
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const formatted = Number.isInteger(value)
      ? String(value)
      : String(parseFloat(value.toPrecision(12)))
    return { expr: trimmed, value, formatted }
  } catch {
    return null
  }
}
