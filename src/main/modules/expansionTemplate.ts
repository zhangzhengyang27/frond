/**
 * Leaf · 片段扩展动态占位符（纯函数，可单测）
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
      // {date:format}（如 {date:YYYY年MM月DD日} / {date:HH:mm}）优先于 {date}
      .replace(/\{date:([^}]+)\}/g, (_full, format: string) => formatDate(ctx.now, format))
      .replaceAll('{datetime}', `${date} ${time}`)
      .replaceAll('{date}', date)
      .replaceAll('{time}', time)
      .replaceAll('{clipboard}', () => {
        if (clipboardValue === null) clipboardValue = ctx.clipboardText()
        return clipboardValue
      })
  )
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
    const name = match[1].trim()
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
