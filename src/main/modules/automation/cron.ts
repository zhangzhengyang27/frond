/**
 * Frond · 极简 cron（P-4④ Automations 的调度判据）
 *
 * 只支持标准 5 字段（分 时 日 月 周），每字段允许：通配、单值、区间 a-b、
 * 逗号列表、以及斜杠步进（如每 15 分钟）。
 * 不做秒、不做 `@daily` 之类的别名、不做时区换算——按本机本地时间判定，
 * 因为「每天 09:00 提醒我」这件事本来就是用户坐在本机前的语义。
 *
 * 解析失败一律返回 null（fail-closed）：一个写错的表达式宁可不跑，
 * 也不能被解释成「每分钟都跑」。
 */

export interface CronSpec {
  minutes: Set<number>
  hours: Set<number>
  daysOfMonth: Set<number>
  months: Set<number>
  daysOfWeek: Set<number>
  /** 原始串，回显与持久化用 */
  source: string
}

const RANGES: Array<[number, number]> = [
  [0, 59], // 分
  [0, 23], // 时
  [1, 31], // 日
  [1, 12], // 月
  [0, 6] // 周（0=周日）
]

function parseField(raw: string, [min, max]: [number, number]): Set<number> | null {
  const out = new Set<number>()
  for (const part of raw.split(',')) {
    if (part === '') return null
    const [body, stepStr] = part.split('/')
    let step = 1
    if (stepStr !== undefined) {
      if (!/^\d+$/.test(stepStr)) return null
      step = Number(stepStr)
      if (step < 1 || step > max - min + 1) return null
    }
    let from = min
    let to = max
    if (body !== '*' && body !== '') {
      const range = /^(\d+)(?:-(\d+))?$/.exec(body)
      if (!range) return null
      from = Number(range[1])
      to = range[2] === undefined ? (stepStr !== undefined ? max : from) : Number(range[2])
    }
    if (from < min || to > max || from > to) return null
    for (let v = from; v <= to; v += step) out.add(v)
  }
  return out.size > 0 ? out : null
}

/** 解析 5 字段 cron；不合法返回 null */
export function parseCron(source: string): CronSpec | null {
  const parts = (source ?? '').trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minutes, hours, daysOfMonth, months, daysOfWeek] = parts.map((p, i) =>
    parseField(p, RANGES[i])
  )
  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) return null
  return { minutes, hours, daysOfMonth, months, daysOfWeek, source: parts.join(' ') }
}

/**
 * 分钟级判定。**只有两个都受限**时才取并集（cron 惯例：`0 0 1 * 1` 是
 * 「每月 1 号 或 每周一」）；只有一个受限时必须按那个受限字段判——
 * 否则「每周一」会因为日字段是全通配而天天命中（这个错在单测里被抓到过）。
 */
export function cronMatches(spec: CronSpec, at: Date): boolean {
  const domRestricted = spec.daysOfMonth.size !== 31
  const dowRestricted = spec.daysOfWeek.size !== 7
  const domOk = spec.daysOfMonth.has(at.getDate())
  const dowOk = spec.daysOfWeek.has(at.getDay())
  const dayOk = domRestricted && dowRestricted ? domOk || dowOk : domRestricted ? domOk : dowOk
  return (
    spec.minutes.has(at.getMinutes()) &&
    spec.hours.has(at.getHours()) &&
    spec.months.has(at.getMonth() + 1) &&
    dayOk
  )
}

/**
 * 这个表达式在 24 小时里会触发几次（从 `from` 起算的下一个整点日）。
 *
 * 用最笨也最可靠的办法：一分钟一分钟问 `cronMatches`。1440 次判定比任何
 * 解析式推算都便宜，而且**与真正决定触发的判据是同一份代码**——自己按字段
 * 推算的话，DOM/DOW 那条并集规则（见 cronMatches）迟早会被算错一次。
 */
export function firesPerDay(spec: CronSpec, from = new Date()): number {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  let n = 0
  for (let i = 0; i < 1440; i++) {
    if (cronMatches(spec, new Date(start.getTime() + i * 60_000))) n++
  }
  return n
}

/** 一行说明写错在哪（界面直接显示，不要求用户懂 cron 语法） */
export function cronError(source: string): string | null {
  const parts = (source ?? '').trim().split(/\s+/)
  if (parts.length !== 5)
    return `需要 5 个字段（分 时 日 月 周），当前 ${parts.filter(Boolean).length} 个`
  if (!parseCron(source)) return '字段里有超出范围或写错的取值'
  return null
}
