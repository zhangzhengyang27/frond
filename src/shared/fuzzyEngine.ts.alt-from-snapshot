/**
 * Frond · 拼写容错引擎（shared）
 *
 * 搜索第三层（连续子串 / 按序子序列之后的兜底层）：
 * 对输错 / 多打 / 敲反字母的查询做编辑距离容错（对标 Raycast fuzzy 档）。
 * 引擎可切换（searchEntries 第 5 参注入），默认实现基于 fuse.js match()。
 *
 * 错误数口径：1 次 = 插入 / 删除 / 替换一个字符，相邻字母敲反记 2 次。
 * 敏感度：≤5 字符查询容错 1 错，6+ 字符容错 2 错（短查询容 2 错会引入大量噪音）。
 */

export interface FuzzyHit {
  /** 错误率（0 = 完美，越高越差），仅供调试 / 断言；排序用 errors */
  score: number
  /** 归一化文本上的命中起点（含） */
  start: number
  /** 归一化文本上的命中终点（含） */
  end: number
  /** 编辑错误数（≥1；0 错命中属异常，默认引擎会拒绝） */
  errors: number
}

export interface FuzzyEngine {
  /** 归一化空间里的拼写容错匹配；无命中返回 null */
  match(nq: string, normText: string): FuzzyHit | null
}

import Fuse from 'fuse.js'

/** 短查询不做容错：2 字符错 1 个 = 50% 错误率，容错只会引入噪音 */
const MIN_TYPO_QUERY_LENGTH = 3
/** fuse.js 错误率上限（0-1）；实际错误数再由 maxErrors 收紧 */
const TYPO_THRESHOLD = 0.4

const FUSE_OPTS = {
  ignoreLocation: true,
  threshold: TYPO_THRESHOLD,
  includeMatches: true,
  includeScore: true
} as const

function maxErrors(queryLength: number): number {
  return queryLength <= 5 ? 1 : 2
}

export const defaultFuzzyEngine: FuzzyEngine = {
  match(nq, normText) {
    if (nq.length < MIN_TYPO_QUERY_LENGTH || !normText) return null
    // 单目标即时搜索：fuse 独立 match() 仅存在于 CJS 构建，ESM 下用类 API 等价实现
    const [r] = new Fuse([normText], FUSE_OPTS).search(nq)
    const indices = r?.matches?.[0]?.indices
    if (!r || !indices?.length) return null
    const errors = Math.round((r.score ?? 1) * nq.length)
    // 0 错命中 = 精确子串，理论上已被前两层消化；到这里属异常，按未命中处理
    if (errors < 1 || errors > maxErrors(nq.length)) return null
    let start = Number.MAX_SAFE_INTEGER
    let end = 0
    for (const [from, to] of indices) {
      start = Math.min(start, from)
      end = Math.max(end, to)
    }
    return { score: r.score ?? 1, start, end, errors }
  }
}
