/**
 * Frond · 片段扩展动态占位符（纯函数，可单测）
 *
 * 对标 Raycast Dynamic Placeholders 的常用子集：
 * {date} → 2026-09-06 · {time} → 14:30 · {datetime} → 组合 · {clipboard} → 当前剪贴板文本
 * 未知占位符原样保留（不吞用户的字面文本）。
 */

export interface ExpansionTemplateContext {
  now: Date
  /** {clipboard} 求值时才调用（无占位符不读剪贴板） */
  clipboardText: () => string
}

/**
 * HTML → 纯文本（富文本片段的剪贴板 text 回退格式，供不支持 HTML 的目标应用）：
 * 剥 script/style，块级标签与 <br> 转换行，解码常用实体，收敛连续空行。
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 按 dayjs 风格 token 格式化日期时间：YYYY/YY/MM/M/DD/D/HH/H/hh/h/mm/m/ss/s/A。
 * 未知 token 与分隔符（中英文标点、汉字）原样保留。
 */
export function formatDate(date: Date, format: string): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const h = date.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  const map: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MM: pad(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: pad(date.getDate()),
    D: String(date.getDate()),
    HH: pad(h),
    H: String(h),
    hh: pad(h12),
    h: String(h12),
    mm: pad(date.getMinutes()),
    m: String(date.getMinutes()),
    ss: pad(date.getSeconds()),
    s: String(date.getSeconds()),
    A: h < 12 ? 'AM' : 'PM',
    a: h < 12 ? 'am' : 'pm'
  }
  // 长 token 优先，避免 YY 先吃掉 YYYY 的前两位
  return format.replace(/YYYY|YY|MM|M|DD|D|HH|H|hh|h|mm|m|ss|s|A|a/g, (t) => map[t] ?? t)
}

export function renderExpansionTemplate(text: string, ctx: ExpansionTemplateContext): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${ctx.now.getFullYear()}-${pad(ctx.now.getMonth() + 1)}-${pad(ctx.now.getDate())}`
  const time = `${pad(ctx.now.getHours())}:${pad(ctx.now.getMinutes())}`
  let clipboardValue: string | null = null
  return (
    text
      // {date:format}（如 {date:YYYY年MM月DD日} / {date:HH:mm}）优先于 {date}；
      // P-3 起支持尾部日期算术：{date:YYYY-MM-DD +7d} / {date:-1w} / {time:HH:mm +30m}
      // （单位 d/w/M/y/h/m，偏移与格式间必须有空白）。{datetime} 不参与算术。
      .replace(/\{date:([^}]+)\}/g, (_full, part: string) => {
        const { format, offset } = splitFormatOffset(part)
        return formatDate(offset ? shiftDate(ctx.now, offset.amount, offset.unit) : ctx.now, format)
      })
      .replace(/\{time:([^}]+)\}/g, (_full, part: string) => {
        const { format, offset } = splitFormatOffset(part)
        return formatDate(offset ? shiftDate(ctx.now, offset.amount, offset.unit) : ctx.now, format)
      })
      .replace(/\{date\s+([+-][^}]+)\}/g, (full, expr: string) => {
        // 非法偏移按模块原则原样保留（不吞用户的字面文本）
        const offset = parseDateOffset(expr)
        if (!offset) return full
        return formatDate(shiftDate(ctx.now, offset.amount, offset.unit), 'YYYY-MM-DD')
      })
      .replace(/\{time\s+([+-][^}]+)\}/g, (full, expr: string) => {
        const offset = parseDateOffset(expr)
        if (!offset) return full
        return formatDate(shiftDate(ctx.now, offset.amount, offset.unit), 'HH:mm')
      })
      .replaceAll('{datetime}', `${date} ${time}`)
      .replaceAll('{date}', date)
      .replaceAll('{time}', time)
      .replaceAll('{clipboard}', () => {
        if (clipboardValue === null) clipboardValue = ctx.clipboardText()
        return clipboardValue
      })
  )
}

/** 日期/时间偏移单位：d 天 · w 周 · M 月 · y 年 · h 时 · m 分（大小写敏感：M 月 m 分） */
export type DateOffsetUnit = 'd' | 'w' | 'M' | 'y' | 'h' | 'm'

/** 解析偏移表达式（纯函数）：`+7d` / `-30m`；非法返回 null */
export function parseDateOffset(expr: string): { amount: number; unit: DateOffsetUnit } | null {
  const m = /^([+-]\d+)\s*(d|w|M|y|h|m)$/.exec(expr.trim())
  if (!m) return null
  return { amount: Number(m[1]), unit: m[2] as DateOffsetUnit }
}

/**
 * 对 Date 应用偏移（纯函数，不改动入参）。月末/月末回滚交由 JS Date 语义
 * （1月31日 +1M → 3月3日），与大多数日期库的宽松行为一致，不做过界钳制。
 */
export function shiftDate(date: Date, amount: number, unit: DateOffsetUnit): Date {
  const d = new Date(date.getTime())
  switch (unit) {
    case 'd':
      d.setDate(d.getDate() + amount)
      break
    case 'w':
      d.setDate(d.getDate() + amount * 7)
      break
    case 'M':
      d.setMonth(d.getMonth() + amount)
      break
    case 'y':
      d.setFullYear(d.getFullYear() + amount)
      break
    case 'h':
      d.setHours(d.getHours() + amount)
      break
    case 'm':
      d.setMinutes(d.getMinutes() + amount)
      break
  }
  return d
}

/**
 * 从 `{date:` 捕获的内部串里剥出尾部偏移（纯函数）：`YYYY-MM-DD +7d` →
 * format `YYYY-MM-DD` + 偏移 7 天。偏移必须与格式串之间有空白，避免吞掉
 * 格式串自己的 token（如 `HH:mm` 结尾的 m）。
 */
export function splitFormatOffset(
  part: string
): { format: string; offset: { amount: number; unit: DateOffsetUnit } | null } {
  const m = /^(.*?)\s+([+-]\d+)\s*([dwMyhm])$/.exec(part.trim())
  if (!m) return { format: part.trim(), offset: null }
  const offset = parseDateOffset(`${m[2]}${m[3]}`)
  return offset ? { format: m[1]!, offset } : { format: part.trim(), offset: null }
}

/**
 * 渲染 + 定位 `{cursor}`（V4 P-1-6）。
 *
 * 算法是「按 {cursor} 切成两半分别渲染」而不是渲染完再找位置 —— 占位符替换会改长度，
 * 事后换算必然要重算一遍同样的规则，切两半则前半渲染出的长度天然就是光标位。
 * 索引按**码点**计（不是 UTF-16 单元）：消费方拿 `[...text].length - cursorIndex` 算回删几次，
 * 两边不同尺子的话，emoji 开头的模板会把光标删到正文里。
 * 多个 `{cursor}` 只认第一个（与 Raycast 一致，第二个当普通文本渲染掉）。
 */
export function renderExpansionWithCursor(
  text: string,
  ctx: ExpansionTemplateContext
): { text: string; cursorIndex: number | null } {
  const MARK = '{cursor}'
  const at = text.indexOf(MARK)
  if (at < 0) return { text: renderExpansionTemplate(text, ctx), cursorIndex: null }
  const head = renderExpansionTemplate(text.slice(0, at), ctx)
  const tail = renderExpansionTemplate(text.slice(at + MARK.length), ctx)
  return { text: head + tail, cursorIndex: [...head].length }
}

/**
 * 提取用户输入动态参数（{{paramName}} 格式）
 * 对标 Raycast Snippet Dynamic Placeholders：展开时弹出表单让用户填写。
 * 返回去重后的参数名列表（按出现顺序）。
 */
export function extractDynamicParams(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const params: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]!.trim()
    if (name && !params.includes(name)) {
      params.push(name)
    }
  }
  return params
}

/**
 * 替换用户输入动态参数
 * @param text 原始文本
 * @param values 参数名 → 用户输入值的映射
 */
export function applyDynamicParams(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_full, name: string) => {
    const key = name.trim()
    return values[key] !== undefined ? values[key] : `{{${key}}}`
  })
}
