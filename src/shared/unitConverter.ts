/**
 * Frond · 单位换算器（对标 Raycast 内联单位换算）
 *
 * 识别 "10kg to lb" / "10 kg in lb" / "100usd to cny" 等自然语言格式，
 * 支持长度、重量、温度、面积、体积、数据存储、货币七大类。
 * 货币使用内置静态汇率表（标注基准日期），离线可用。
 */

export interface UnitConvertResult {
  /** 原始输入 */
  expr: string
  /** 输入数值 */
  fromValue: number
  /** 输入单位 */
  fromUnit: string
  /** 输出数值 */
  toValue: number
  /** 输出单位 */
  toUnit: string
  /** 展示用结果 */
  formatted: string
  /** 类别（货币为「货币」，汇率基准日期另见 rateDate） */
  category: string
  /** 货币换算的汇率基准日期（静态汇率，非货币时为 undefined） */
  rateDate?: string
}

// ───── 单位定义（以基本单位为锚点的换算系数）─────

interface UnitDef {
  name: string
  /** 转换到基本单位的系数；温度特殊处理 */
  factor: number
  aliases: string[]
}

// 长度：基本单位 m
const LENGTH: Record<string, UnitDef> = {
  m: { name: '米', factor: 1, aliases: ['m', 'meter', 'meters', '米'] },
  km: { name: '千米', factor: 1000, aliases: ['km', 'kilometer', 'kilometers', '千米', '公里'] },
  cm: { name: '厘米', factor: 0.01, aliases: ['cm', 'centimeter', 'centimeters', '厘米'] },
  mm: { name: '毫米', factor: 0.001, aliases: ['mm', 'millimeter', 'millimeters', '毫米'] },
  mile: { name: '英里', factor: 1609.344, aliases: ['mi', 'mile', 'miles', '英里'] },
  yard: { name: '码', factor: 0.9144, aliases: ['yd', 'yard', 'yards', '码'] },
  ft: { name: '英尺', factor: 0.3048, aliases: ['ft', 'foot', 'feet', '英尺'] },
  in: { name: '英寸', factor: 0.0254, aliases: ['in', 'inch', 'inches', '英寸'] }
}

// 重量：基本单位 kg
const WEIGHT: Record<string, UnitDef> = {
  kg: { name: '千克', factor: 1, aliases: ['kg', 'kilogram', 'kilograms', '千克', '公斤'] },
  g: { name: '克', factor: 0.001, aliases: ['g', 'gram', 'grams', '克'] },
  mg: { name: '毫克', factor: 0.000001, aliases: ['mg', 'milligram', 'milligrams', '毫克'] },
  t: { name: '吨', factor: 1000, aliases: ['t', 'ton', 'tons', 'tonne', '吨'] },
  lb: { name: '磅', factor: 0.45359237, aliases: ['lb', 'lbs', 'pound', 'pounds', '磅'] },
  oz: { name: '盎司', factor: 0.028349523125, aliases: ['oz', 'ounce', 'ounces', '盎司'] }
}

// 面积：基本单位 m²
const AREA: Record<string, UnitDef> = {
  m2: { name: '平方米', factor: 1, aliases: ['m2', 'm²', 'sqm', 'squaremeter', '平方米', '平米'] },
  km2: {
    name: '平方千米',
    factor: 1000000,
    aliases: ['km2', 'km²', 'squarekilometer', '平方千米', '平方公里']
  },
  ha: { name: '公顷', factor: 10000, aliases: ['ha', 'hectare', 'hectares', '公顷'] },
  acre: { name: '英亩', factor: 4046.8564224, aliases: ['acre', 'acres', '英亩'] },
  ft2: {
    name: '平方英尺',
    factor: 0.09290304,
    aliases: ['ft2', 'ft²', 'sqft', 'squarefoot', '平方英尺']
  }
}

// 体积：基本单位 L
const VOLUME: Record<string, UnitDef> = {
  l: { name: '升', factor: 1, aliases: ['l', 'L', 'liter', 'liters', 'litre', '升'] },
  ml: { name: '毫升', factor: 0.001, aliases: ['ml', 'mL', 'milliliter', 'milliliters', '毫升'] },
  m3: { name: '立方米', factor: 1000, aliases: ['m3', 'm³', 'cubicmeter', '立方米'] },
  gal: { name: '加仑', factor: 3.785411784, aliases: ['gal', 'gallon', 'gallons', '加仑'] },
  qt: { name: '夸脱', factor: 0.946352946, aliases: ['qt', 'quart', 'quarts', '夸脱'] },
  pt: { name: '品脱', factor: 0.473176473, aliases: ['pt', 'pint', 'pints', '品脱'] },
  cup: { name: '杯', factor: 0.2365882365, aliases: ['cup', 'cups', '杯'] }
}

// 数据存储：基本单位 B
const DATA: Record<string, UnitDef> = {
  b: { name: '字节', factor: 1, aliases: ['b', 'B', 'byte', 'bytes', '字节'] },
  kb: { name: 'KB', factor: 1024, aliases: ['kb', 'KB', 'kilobyte', 'kilobytes'] },
  mb: { name: 'MB', factor: 1024 * 1024, aliases: ['mb', 'MB', 'megabyte', 'megabytes'] },
  gb: { name: 'GB', factor: 1024 * 1024 * 1024, aliases: ['gb', 'GB', 'gigabyte', 'gigabytes'] },
  tb: { name: 'TB', factor: 1024 ** 4, aliases: ['tb', 'TB', 'terabyte', 'terabytes'] },
  pb: { name: 'PB', factor: 1024 ** 5, aliases: ['pb', 'PB', 'petabyte', 'petabytes'] }
}

// 货币：基本单位 USD（汇率基准日期 2026-09-01，1 USD = X 货币）
const CURRENCY_RATES: Record<string, { name: string; rate: number; aliases: string[] }> = {
  usd: { name: '美元', rate: 1, aliases: ['usd', '$', '美元', '美金'] },
  cny: { name: '人民币', rate: 7.18, aliases: ['cny', 'rmb', '¥', '人民币', '块'] },
  eur: { name: '欧元', rate: 0.92, aliases: ['eur', '€', '欧元'] },
  jpy: { name: '日元', rate: 149.5, aliases: ['jpy', '¥', '日元'] },
  gbp: { name: '英镑', rate: 0.79, aliases: ['gbp', '£', '英镑'] },
  hkd: { name: '港币', rate: 7.81, aliases: ['hkd', '港币', '港元'] },
  krw: { name: '韩元', rate: 1370, aliases: ['krw', '₩', '韩元'] },
  aud: { name: '澳元', rate: 1.51, aliases: ['aud', '澳元', '澳币'] },
  cad: { name: '加元', rate: 1.37, aliases: ['cad', '加元'] },
  sgd: { name: '新加坡元', rate: 1.35, aliases: ['sgd', '新币', '新加坡元'] },
  chf: { name: '瑞士法郎', rate: 0.89, aliases: ['chf', '瑞郎'] },
  inr: { name: '印度卢比', rate: 83.4, aliases: ['inr', '₹', '卢比', '印度卢比'] },
  twd: { name: '新台币', rate: 32.5, aliases: ['twd', '台币', '新台币'] }
}

const CURRENCY_DATE = '2026-09-01'

// 温度特殊处理
const TEMP_ALIASES: Record<string, string> = {
  c: 'C',
  celsius: 'C',
  '°c': 'C',
  摄氏度: 'C',
  度: 'C',
  f: 'F',
  fahrenheit: 'F',
  '°f': 'F',
  华氏度: 'F',
  k: 'K',
  kelvin: 'K',
  '°k': 'K',
  开尔文: 'K'
}

interface CategoryDef {
  name: string
  units: Record<string, UnitDef>
}

const CATEGORIES: CategoryDef[] = [
  { name: '长度', units: LENGTH },
  { name: '重量', units: WEIGHT },
  { name: '面积', units: AREA },
  { name: '体积', units: VOLUME },
  { name: '数据', units: DATA }
]

// ───── 单位解析 ─────

function resolveUnit(input: string, category: CategoryDef): UnitDef | null {
  const lower = input.toLowerCase().trim()
  for (const def of Object.values(category.units)) {
    if (def.aliases.some((a) => a.toLowerCase() === lower)) return def
  }
  return null
}

function resolveCurrency(input: string): { code: string; name: string; rate: number } | null {
  const lower = input.toLowerCase().trim()
  for (const [code, def] of Object.entries(CURRENCY_RATES)) {
    if (def.aliases.some((a) => a.toLowerCase() === lower)) return { code, ...def }
  }
  return null
}

function resolveTemp(input: string): string | null {
  const lower = input.toLowerCase().trim()
  return TEMP_ALIASES[lower] ?? null
}

// ───── 温度换算 ─────

function convertTemp(value: number, from: string, to: string): number {
  // 先转 Celsius
  let celsius: number
  if (from === 'C') celsius = value
  else if (from === 'F') celsius = ((value - 32) * 5) / 9
  else celsius = value - 273.15
  // 再转目标
  if (to === 'C') return celsius
  if (to === 'F') return (celsius * 9) / 5 + 32
  return celsius + 273.15
}

// ───── 格式化 ─────

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e15 || abs < 1e-6) return n.toExponential(6)
  // 去除浮点尾差
  const rounded = parseFloat(n.toPrecision(12))
  if (abs >= 1000) return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return String(rounded)
}

// ───── 主入口 ─────

/**
 * 换算表达式：`数值 + 原单位 + 分隔符 + 目标单位`
 * 分隔符支持 to / in / → / -> / => / = / 空格（空格用于「100美元 人民币」这类中文写法）。
 * to / in 不加词边界，以兼容「10kgtolb」这类无空格写法。
 */
const CONVERT_PATTERN =
  /^(-?\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5$€£¥₩₹°][a-zA-Z0-9\u4e00-\u9fa5$€£¥₩₹°]*)\s*(?:to|in|→|->|=>|=|\s+)\s*([a-zA-Z\u4e00-\u9fa5$€£¥₩₹°][a-zA-Z0-9\u4e00-\u9fa5$€£¥₩₹°]*)$/i

export function convertUnit(query: string): UnitConvertResult | null {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length > 80) return null
  // 必须含数字
  if (!/\d/.test(trimmed)) return null

  const m = trimmed.match(CONVERT_PATTERN)
  if (!m) return null

  const value = parseFloat(m[1])
  if (!Number.isFinite(value)) return null
  const fromRaw = m[2]
  const toRaw = m[3]

  // 1) 温度
  const fromTemp = resolveTemp(fromRaw)
  const toTemp = resolveTemp(toRaw)
  if (fromTemp && toTemp) {
    const result = convertTemp(value, fromTemp, toTemp)
    const fromName = fromTemp === 'C' ? '摄氏度' : fromTemp === 'F' ? '华氏度' : '开尔文'
    const toName = toTemp === 'C' ? '摄氏度' : toTemp === 'F' ? '华氏度' : '开尔文'
    return {
      expr: trimmed,
      fromValue: value,
      fromUnit: fromName,
      toValue: result,
      toUnit: toName,
      formatted: `${formatNumber(result)} ${toName}`,
      category: '温度'
    }
  }

  // 2) 货币
  const fromCur = resolveCurrency(fromRaw)
  const toCur = resolveCurrency(toRaw)
  if (fromCur && toCur) {
    // value (fromCur) → USD → toCur
    const usd = value / fromCur.rate
    const result = usd * toCur.rate
    return {
      expr: trimmed,
      fromValue: value,
      fromUnit: fromCur.name,
      toValue: result,
      toUnit: toCur.name,
      formatted: `${formatNumber(result)} ${toCur.name}`,
      category: '货币',
      rateDate: CURRENCY_DATE
    }
  }

  // 3) 普通单位（必须同类）
  for (const cat of CATEGORIES) {
    const fromDef = resolveUnit(fromRaw, cat)
    const toDef = resolveUnit(toRaw, cat)
    if (fromDef && toDef) {
      const baseValue = value * fromDef.factor
      const result = baseValue / toDef.factor
      return {
        expr: trimmed,
        fromValue: value,
        fromUnit: fromDef.name,
        toValue: result,
        toUnit: toDef.name,
        formatted: `${formatNumber(result)} ${toDef.name}`,
        category: cat.name
      }
    }
  }

  return null
}
