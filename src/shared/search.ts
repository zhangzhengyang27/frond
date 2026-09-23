/**
 * Leaf · 统一搜索匹配引擎（shared）。
 *
 * 从启动器胶囊上移到 shared（IA v2「统一命令层」）：胶囊与 ⌘K 命令面板共用，
 * 保证两个入口的搜索排序 / 高亮完全一致。
 * 命中优先级 = 名称命中 > 路径/副标题命中；连续子串 > 按序子序列；
 * 前缀命中 > 中间命中；跨度越小越高。
 * 三层匹配：连续子串 → 按序子序列 → 拼写容错（FuzzyEngine，可切换，
 * 默认 fuse.js 编辑距离容错）；容错层只在前两层全未命中时兜底，分数压在子序列档之下。
 */

import type { CommandAction } from './commands'
import { defaultFuzzyEngine, type FuzzyEngine, type FuzzyHit } from './fuzzyEngine'

export type { FuzzyEngine, FuzzyHit } from './fuzzyEngine'

export interface NormalizedMatch {
  /** 是否连续命中（精确子串），区别于按序子序列 */
  contiguous: boolean
  /** 归一化空间里的闭区间 */
  start: number
  end: number
}

const WORD_CHAR = /[\w\u4e00-\u9fa5]/
const WHITESPACE = /\s/

export interface NormalizedText {
  text: string
  /** 归一化字符在原文中的下标映射（用于原文高亮） */
  map: number[]
}

/** 保留原文下标的归一化：小写、去空白与特殊字符 */
export function normalizeWithMap(text: string): NormalizedText {
  const lower = text.toLowerCase()
  const chars: string[] = []
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = lower[i]
    if (WHITESPACE.test(ch) || !WORD_CHAR.test(ch)) continue
    chars.push(ch)
    map.push(i)
  }
  return { text: chars.join(''), map }
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
}

/** 归一化文本上的匹配：先找连续子串，找不到再退化为按序子序列 */
export function matchNormalized(normText: string, nq: string): NormalizedMatch | null {
  if (!nq) return null
  const exact = normText.indexOf(nq)
  if (exact !== -1) {
    return { contiguous: true, start: exact, end: exact + nq.length - 1 }
  }
  let cursor = 0
  let first = -1
  let last = -1
  for (let i = 0; i < nq.length; i++) {
    const found = normText.indexOf(nq[i], cursor)
    if (found === -1) return null
    if (first === -1) first = found
    last = found
    cursor = found + 1
  }
  return { contiguous: false, start: first, end: last }
}

/** 命中打分：名称命中 > 路径命中；连续 > 子序列；前缀 > 中间；越紧凑越高 */
export function matchScore(match: NormalizedMatch, isName: boolean): number {
  let score = isName ? 100 : 30
  if (match.contiguous) score += 30
  if (match.start === 0) score += 20
  score -= Math.min(match.end - match.start, 30)
  return score
}

/**
 * 容错命中打分：压在子序列档之下（同字段分层不变量）——
 * 名称子序列下限 70，容错名称 41-50；副标题子序列下限 0-30，容错副标题 11-20。
 * 少错、前缀命中略高。
 */
function typoScore(hit: FuzzyHit, isName: boolean): number {
  let score = isName ? 45 : 15
  if (hit.start === 0) score += 5
  score -= (hit.errors - 1) * 4
  return score
}

/** 容错引擎调用包装：空文本直接跳过，引擎异常降级为未命中（第三方引擎不允许拖垮搜索） */
function tryTypo(engine: FuzzyEngine, nq: string, text: string): FuzzyHit | null {
  if (!text) return null
  try {
    return engine.match(nq, text)
  } catch {
    return null
  }
}

/** 搜索条目基础字段（匹配只依赖这几项；泛型化让非命令场景也能复用打分） */
export interface SearchEntryBase {
  /** 唯一 key（结果列表 v-for / 选中态恢复用） */
  key: string
  /** 结果类型图标名（remixicon，不含 ri- 前缀） */
  icon: string
  /** 主标题 */
  title: string
  /** 副标题（路径 / 描述） */
  subtitle: string
  /** 别名（拼音首字母等，M1.1）；命中得分略低于标题直击 */
  aliases?: string[]
  /** 参数化命令（P-1.6b）：只有声明了它的条目才吃「命令 + 尾部参数」的前缀命中 */
  acceptsArgs?: boolean
}

/** 统一的搜索条目：模块 / 系统页 / 动作 / 插件命令 / 本机应用共用 */
export interface SearchEntry extends SearchEntryBase {
  /** 结果行右侧的类型徽标文案 */
  badge: string
  /** 执行动作 */
  action: CommandAction
}

export interface ScoredEntry<T = SearchEntry> {
  entry: T
  /** 原文主标题的高亮区间（匹配为 null 时无高亮） */
  highlight: NormalizedMatch | null
  score: number
}

/**
 * 「命令 + 尾部参数」的前缀命中（对标 Raycast 的行内补全）。
 *
 * 旧规则要求整条查询作为子串/子序列命中标题，于是 `正则测试 \d+` 选不中命令「正则测试」，
 * 参数表单永远只能空着打开 —— argPrefill 成了走不到的死路。
 *
 * 判定卡在三件事上，少一件就是误命中：标题要**整词**开头（`Github x` 不许匹配命令 `Git`）、
 * 标题之后紧跟空白、查询比标题长（等于标题走普通命中，不该在这里加分）。
 * 区间给的是原文坐标（start=0、end=标题末位下标），高亮只盖住命令名那一段。
 */
export function argPrefixMatch(query: string, title: string): NormalizedMatch | null {
  const q = query.trimStart()
  const offset = query.length - q.length
  if (!title || q.length <= title.length) return null
  if (q.slice(0, title.length).toLowerCase() !== title.toLowerCase()) return null
  if (!/\s/.test(q[title.length])) return null
  return { contiguous: true, start: offset, end: offset + title.length - 1 }
}

/** 前缀命中的降档值：参数化命令排到整条匹配之后，但仍在「没别的命中」时兜得住 */
const ARG_PREFIX_PENALTY = 25

/**
 * 在一组条目上执行归一化搜索，按分数降序截断。
 * boost（可选）：命中条目的附加分（使用频率自学习等），在排序前叠加。
 * fuzzyEngine（可选）：拼写容错引擎，默认 defaultFuzzyEngine（fuse.js）。
 */
export function searchEntries<T extends SearchEntryBase>(
  entries: T[],
  query: string,
  limit = 8,
  boost?: (entry: T) => number,
  fuzzyEngine: FuzzyEngine = defaultFuzzyEngine
): ScoredEntry<T>[] {
  const nq = normalizeText(query)
  if (!nq) return []
  const scored: ScoredEntry<T>[] = []
  for (const entry of entries) {
    const name = normalizeWithMap(entry.title)
    const sub = normalizeText(entry.subtitle)

    const nameMatch = matchNormalized(name.text, nq)
    if (nameMatch) {
      scored.push({
        entry,
        highlight: nameMatch,
        score: matchScore(nameMatch, true) + (boost?.(entry) ?? 0)
      })
      continue
    }

    // 参数化命令：「命令 + 空格 + 参数」的写法在前缀命中里排到整条匹配之后
    if (entry.acceptsArgs) {
      const prefix = argPrefixMatch(query, entry.title)
      if (prefix) {
        scored.push({
          entry,
          highlight: prefix,
          score:
            matchScore({ ...prefix, contiguous: true }, true) -
            ARG_PREFIX_PENALTY +
            (boost?.(entry) ?? 0)
        })
        continue
      }
    }

    // 别名（拼音首字母等）：按标题级打分略降档，无高亮区间
    let aliasHit = false
    for (const alias of entry.aliases ?? []) {
      const aliasMatch = matchNormalized(normalizeText(alias), nq)
      if (aliasMatch) {
        scored.push({
          entry,
          highlight: null,
          score: matchScore(aliasMatch, true) - 10 + (boost?.(entry) ?? 0)
        })
        aliasHit = true
        break
      }
    }
    if (aliasHit) continue

    const subMatch = matchNormalized(sub, nq)
    if (!subMatch) {
      // 拼写容错层（第三层兜底）：标题 → 副标题，仅当前三层全未命中
      const typoName = tryTypo(fuzzyEngine, nq, name.text)
      if (typoName) {
        scored.push({
          entry,
          highlight: { contiguous: false, start: typoName.start, end: typoName.end },
          score: typoScore(typoName, true) + (boost?.(entry) ?? 0)
        })
        continue
      }
      const typoSub = tryTypo(fuzzyEngine, nq, sub)
      if (typoSub) {
        scored.push({
          entry,
          highlight: null,
          score: typoScore(typoSub, false) + (boost?.(entry) ?? 0)
        })
      }
      continue
    }
    scored.push({
      entry,
      highlight: null,
      score: matchScore(subMatch, false) + (boost?.(entry) ?? 0)
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
