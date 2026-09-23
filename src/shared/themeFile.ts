/**
 * Frond · 用户主题文件（#12 Phase 2，对标 Vicinae extra/themes/*.toml）
 *
 * 主题文件 = 少量 core 值 + 可选语义子表覆盖，缺失的语义值由 core 派生
 * （docs/DESIGN_TOKENS.md「演进路径」第 1-3 步）。本文件只做数据层：
 * 解析/校验/派生 + 生成注入用的 CSS 变量表，不碰 DOM、不读盘（读盘在主进程）。
 *
 * 三条硬约束：
 * 1. **fail-closed**：任何字段非法即整份拒绝并给出字段级原因——与
 *    src/shared/plugin-protocol.ts 同口径。不允许「部分生效」的主题。
 * 2. **CSS 注入面**：这些值最终会写进 `--x: VALUE` 的 <style>，因此颜色值只走
 *    白名单正则（十六进制 / rgb(a) / hsl(a) / 纯字母颜色名），`;` `}` `<` `url(`
 *    等一律拒绝；不做黑名单转义。
 * 3. **派生基座**：danger/success 之类无法从 core 推出的令牌继承同 appearance 的
 *    内置主题（BUILTIN_THEMES）。模块命名空间里 launcher 的**表面与文本**参与联动
 *    （见 launcherThemeVars，P-6.3），强调色不派生（Decision-010 独立拍板），
 *    pomo/shot 仍不参与——模块自治。
 */
import {
  BUILTIN_THEMES,
  FROND_DARK_THEME,
  FROND_LIGHT_THEME,
  type ThemeDefinition
} from './themeSchema'

/** 颜色值白名单：#hex(3/4/6/8 位) / rgb(a)(...) / hsl(a)(...) / 纯字母颜色名
 *  hex 长度写成 `{3,8}` 会把 `#abcde`（5 位）放进来：CSS 不认它，
 *  派生用的 parseColor 也不认它（静默不派生），于是主题带着一条无效颜色落地。 */
const CSS_COLOR_RE =
  /^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|rgba|hsl|hsla)\(\s*[\d.]+[\d.,%\s/()-]*\)|[a-zA-Z]+)$/
const MAX_ID_LENGTH = 64
const MAX_NAME_LENGTH = 60
const SEMANTIC_TABLES = ['surface', 'border', 'text', 'glass'] as const

export type ThemeParseResult = { ok: true; theme: ThemeDefinition } | { ok: false; error: string }

function fail(field: string, why: string): { ok: false; error: string } {
  return { ok: false, error: `${field}: ${why}` }
}

/** 颜色值消毒：非白名单形态（含 ; } < url( 等）一律拒绝 */
function readColor(
  value: unknown,
  field: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return fail(field, '必须是字符串')
  const trimmed = value.trim()
  if (!trimmed) return fail(field, '不能为空')
  if (trimmed.length > 64) return fail(field, '长度超 64')
  if (!CSS_COLOR_RE.test(trimmed)) return fail(field, '不是允许的 CSS 颜色形态')
  return { ok: true, value: trimmed }
}

/** 逐表覆盖：表名与键都必须落在 schema 白名单里，未知键忽略（不放大成注入面） */
function readTable(
  raw: unknown,
  table: (typeof SEMANTIC_TABLES)[number],
  theme: ThemeDefinition
): { ok: false; error: string } | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail(table, '必须是对象')
  const allowed = Object.keys(theme[table])
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.includes(key)) continue // 未知键忽略：语义子表是封闭集
    const parsed = readColor(value, `${table}.${key}`)
    if (!parsed.ok) return parsed
    ;(theme[table] as unknown as Record<string, string>)[key] = parsed.value
  }
  return null
}

// ─── 极小色彩工具（派生只用到 hex/rgb 的数值形态，其他形态一律不派生） ───

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** 解析 #hex(3/4/6/8) / rgb(a) 数值形态；hsl、颜色名等返回 null（不参与派生，只用原值） */
function parseColor(value: string): Rgba | null {
  const hex = /^#(?:([0-9a-fA-F]{3,4})|([0-9a-fA-F]{6})|([0-9a-fA-F]{8}))$/.exec(value.trim())
  if (hex) {
    let s = hex[1] ?? hex[2] ?? hex[3] ?? ''
    if (s.length === 3 || s.length === 4)
      s = s
        .split('')
        .map((c) => c + c)
        .join('')
    if (s.length !== 6 && s.length !== 8) return null
    const n = (i: number, len = 2): number => parseInt(s.slice(i * len, i * len + len), 16)
    return { r: n(0), g: n(1), b: n(2), a: s.length === 8 ? n(3) / 255 : 1 }
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/]\s*([\d.]+))?\s*\)$/.exec(value.trim())
  if (rgb) {
    const [, r, g, b, a] = rgb
    return { r: Number(r), g: Number(g), b: Number(b), a: a === undefined ? 1 : Number(a) }
  }
  return null
}

const clamp255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)))

function toHex({ r, g, b }: Rgba): string {
  const part = (n: number): string => clamp255(n).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** 向 target 混合 ratio（0-1），保留源色 alpha */
function mix(source: Rgba, target: Rgba, ratio: number): Rgba {
  return {
    r: source.r + (target.r - source.r) * ratio,
    g: source.g + (target.g - source.g) * ratio,
    b: source.b + (target.b - source.b) * ratio,
    a: source.a
  }
}

/** WCAG 相对亮度（判定深浅用，够用于主题派生） */
function luminance(c: Rgba): number {
  const ch = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b)
}

function alpha(c: Rgba, factor: number): string {
  const a = Math.max(0, Math.min(1, c.a * factor))
  return `rgba(${clamp255(c.r)}, ${clamp255(c.g)}, ${clamp255(c.b)}, ${Number(a.toFixed(3))})`
}

/**
 * 由 core 三元组派生语义子表（未显式覆盖的键才填）。
 * 深浅不靠猜 appearance：以 bg/fg 的相对亮度为准，appearance 写错也能得到
 * 自洽的一整套颜色。
 */
function deriveFromCore(
  core: { bg: string; fg: string; accent: string },
  theme: ThemeDefinition
): void {
  const bg = parseColor(core.bg)
  const fg = parseColor(core.fg)
  const accent = parseColor(core.accent)
  if (!bg || !fg) return // core 非 hex/rgb 时不派生：主题仍可用显式覆盖 + 内置基座

  theme.surface['surface-0'] = core.bg
  theme.surface['surface-inverse'] = core.fg
  if (accent) theme.core.accent = core.accent
  theme.text['text-primary'] = core.fg
  theme.text['text-inverse'] = core.bg
  // 文本层级 = 前景向背景收敛的三档
  theme.text['text-secondary'] = toHex(mix(fg, bg, 0.28))
  theme.text['text-tertiary'] = toHex(mix(fg, bg, 0.44))
  theme.text['text-muted'] = toHex(mix(fg, bg, 0.58))
  // 品牌文本色：accent 在 bg 上对比不足时朝反方向拉一档
  theme.text['text-brand'] = accent ? brandText(accent, bg, fg) : theme.text['text-brand']
  // 表面分层与描边：以前景叠加透明度（深浅两套都成立）
  theme.surface['surface-1'] = toHex(mix(bg, fg, 0.03))
  theme.surface['surface-2'] = toHex(mix(bg, fg, 0.06))
  theme.surface['surface-3'] = toHex(mix(bg, fg, 0.09))
  theme.surface['surface-hover'] = alpha(fg, 0.05)
  theme.surface['surface-active'] = alpha(fg, 0.09)
  theme.border['border-subtle'] = alpha(fg, 0.07)
  theme.border['border-default'] = alpha(fg, 0.12)
  theme.border['border-strong'] = alpha(fg, 0.2)
  theme.glass['glass-bg'] = alpha(bg, luminance(bg) > 0.5 ? 0.7 : 0.72)
  theme.glass['glass-bg-strong'] = alpha(mix(bg, fg, 0.04), 0.86)
  theme.glass['glass-border'] = alpha(fg, 0.09)
  theme.glass['glass-highlight'] = alpha(luminance(bg) > 0.5 ? fg : bg, 0.5)
}

/** accent 作为文本色使用时保证在 bg 上可读 */
function brandText(accent: Rgba, bg: Rgba, fg: Rgba): string {
  const contrast = (c: Rgba): number => {
    const l1 = Math.max(luminance(c), luminance(bg))
    const l2 = Math.min(luminance(c), luminance(bg))
    return (l1 + 0.05) / (l2 + 0.05)
  }
  let candidate = accent
  for (let i = 0; i < 8 && contrast(candidate) < 4.5; i++) {
    candidate = mix(candidate, fg, 0.15)
  }
  return toHex(candidate)
}

const cloneBase = (appearance: 'light' | 'dark'): ThemeDefinition =>
  JSON.parse(
    JSON.stringify(appearance === 'dark' ? FROND_DARK_THEME : FROND_LIGHT_THEME)
  ) as ThemeDefinition

/**
 * 解析并派生一份用户主题文件。
 * 输入是 fs.readFile + JSON.parse 之后的 unknown（本函数不做 IO，便于单测）。
 */
export function parseThemeFile(raw: unknown): ThemeParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail('root', '主题文件必须是一个对象')
  }
  const file = raw as Record<string, unknown>

  const appearance = file.appearance
  if (appearance !== 'light' && appearance !== 'dark') {
    return fail('appearance', "只能是 'light' 或 'dark'")
  }
  const name = typeof file.name === 'string' ? file.name.trim() : ''
  if (!name) return fail('name', '必填')
  if (name.length > MAX_NAME_LENGTH) return fail('name', `长度超 ${MAX_NAME_LENGTH}`)

  const coreRaw = file.core
  if (typeof coreRaw !== 'object' || coreRaw === null) return fail('core', '必填（bg/fg/accent）')
  const core = coreRaw as Record<string, unknown>
  const parsedCore: Record<'bg' | 'fg' | 'accent', string> = { bg: '', fg: '', accent: '' }
  for (const key of ['bg', 'fg', 'accent'] as const) {
    const parsed = readColor(core[key], `core.${key}`)
    if (!parsed.ok) return parsed
    parsedCore[key] = parsed.value
  }

  const idRaw = typeof file.id === 'string' ? file.id.trim() : ''
  const id = idRaw || slug(name)
  if (id.length > MAX_ID_LENGTH) return fail('id', `长度超 ${MAX_ID_LENGTH}`)

  // 基座 = 同 appearance 的内置主题（未覆盖项与不可派生项都落在这里）
  const theme = cloneBase(appearance)
  theme.id = id
  theme.name = name
  theme.appearance = appearance
  theme.core = { ...parsedCore }
  deriveFromCore(parsedCore, theme)

  for (const table of SEMANTIC_TABLES) {
    const error = readTable(file[table], table, theme)
    if (error) return error
  }
  return { ok: true, theme }
}

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // 非拉丁主题名（中文等）落不进 [a-z0-9]：用名字哈希兜底，**必须确定**——
  // id 会被持久化成「当前激活主题」，不稳定 id 等于重启后主题失效
  return s || `theme-${fnv32(name)}`
}

/** FNV-1a 32 位 → base36（只为 id 兜底，不承担去重之外的语义） */
function fnv32(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/**
 * 胶囊（`--launcher-*`）与用户主题的联动桥（P-6.3，Decision-010 复审后的口径）。
 *
 * 只联动**表面与文本**这一组：底色、悬浮层、弹层、描边与四级文本。
 * 刻意不动的两类：
 * - 强调色（accent / accent-soft / accent-strong / selected-indicator / badge-bg）
 *   维持 Decision-010 的独立拍板（Raycast 红），与 `--brand-500` 同口径；
 * - 几何与阴影（radius / search-height / footer-height / detail-width / shadow）
 *   不是颜色，且胶囊窗尺寸由主进程算，主题插一脚只会对不齐。
 *
 * 深浅不读 `appearance` 字符串而看 core.bg 的实际亮度（与 deriveFromCore 同口径）：
 * 深色档必须保留 `--launcher-bg` 的 alpha 结构，否则主题一开胶囊就从毛玻璃变成死色块。
 * core 落不进 hex/rgb 数值形态时**一个键都不发**：宁可整套保持 tokens.css，
 * 也不要发半套颜色。
 */
export function launcherThemeVars(core: { bg: string; fg: string }): Record<string, string> {
  const bg = parseColor(core.bg)
  const fg = parseColor(core.fg)
  if (!bg || !fg) return {}
  const light = luminance(bg) > 0.5
  return {
    '--launcher-bg': light ? core.bg : alpha(bg, 0.74),
    '--launcher-bg-elevated': light ? toHex(mix(bg, fg, 0.02)) : alpha(fg, 0.08),
    '--launcher-popover-bg': light ? core.bg : alpha(mix(bg, fg, 0.06), 0.96),
    '--launcher-border': alpha(fg, light ? 0.1 : 0.14),
    '--launcher-hairline': alpha(fg, light ? 0.06 : 0.08),
    '--launcher-text': alpha(fg, light ? 0.9 : 0.96),
    '--launcher-text-dim': alpha(fg, light ? 0.55 : 0.66),
    '--launcher-text-muted': alpha(fg, light ? 0.4 : 0.5),
    '--launcher-text-faint': alpha(fg, light ? 0.3 : 0.34),
    '--launcher-selected-bg': light ? toHex(mix(bg, fg, 0.09)) : alpha(fg, 0.14),
    '--launcher-result-hover': alpha(fg, light ? 0.045 : 0.07),
    '--launcher-input-bg': alpha(fg, light ? 0.04 : 0.08)
  }
}

/** 主题 → 注入用的 CSS 变量表。
 * 语义子表 22 键与 tokens.css 的 `--surface-*` / `--text-*` / `--border-*` /
 * `--glass-*` 完全同名（themeSchema.test 守护），直接 `--` + 键名即可覆盖。
 * core 三项**不输出**：tokens.css 里没有 --bg/--fg/--accent 这个消费者
 * （bg 的实际载体是 --surface-0、fg 是 --text-primary，已由派生写入对应键；
 * 强调色的实际消费者是 --brand-500，Decision-010 定过它不随主题派生）。
 * 模块命名空间里只有 launcher 的表面/文本参与（见 launcherThemeVars），
 * pomo/shot 仍不在此表——模块自治。 */
export function themeToCssVars(theme: ThemeDefinition): Record<string, string> {
  const out: Record<string, string> = {}
  for (const table of SEMANTIC_TABLES) {
    for (const [key, value] of Object.entries(theme[table])) {
      out[`--${key}`] = value
    }
  }
  return Object.assign(out, launcherThemeVars(theme.core))
}

/** 内置主题按 id 取用（用户主题与内置主题在同一选择器里并列） */
export function builtinTheme(id: string): ThemeDefinition | null {
  return BUILTIN_THEMES.find((t) => t.id === id) ?? null
}
