/**
 * Frond · P0-1 统一混合搜索（自 LauncherApp.vue 抽出）
 *
 * 根搜索聚合：命令/应用（同步，searchEntries）+ 计算器 / 单位换算 / Emoji
 * （同步）+ 文件 / 剪贴板 / 片段（异步增量合并）。
 * results 用 ref：同步命中立即可见，慢速 IO 到达后增量合并（token 防过期回写）。
 */
import { ref, type Ref } from 'vue'
import { hoistFavorites } from './launcherInteractions'
import { evaluateExpression } from '@shared/calculator'
import { convertUnit } from '@shared/unitConverter'
import { searchEmoji } from '@shared/emoji'
import type { CommandEntry } from '@shared/commands'
import { normalizeWithMap, searchEntries, type ScoredEntry } from '@shared/search'
import type { useUsageBoost } from '@renderer/composables/useUsageBoost'

type UsageBoost = ReturnType<typeof useUsageBoost>['boost']

/**
 * 根搜索各来源的行数上限（P-6④）。集中一处是为了「改一个数就能量」，
 * 实测数字与结论见 `docs/RAYCAST_PARITY_PLAN_V5.md` P-6.4 和 `e2e/perf-results.spec.mjs`
 * （`test-results/perf-results-*.json` 是每次跑的原始数据）。
 *
 * 两件事量出来是反直觉的：
 * 1. **多渲染十倍行是免费的**——同一台机器同一个查询，13 行时 churn 447ms、
 *    140 行时 451ms，差异全在测量噪声里；所以旧文档里的「无虚拟化」不是一笔欠账。
 * 2. **短查询那 450-540ms 不是画出来的，是文件搜索 IO 晚到**（单字母查询两种封顶
 *    下都一样慢，两字母词只要 50-130ms）。要减延迟得动文件那一侧，不是列表。
 *
 * 所以这里放宽的是**产品那一侧的可见条数**：命令从 8 放到 30、总 cap 从 20 放到 50
 * （8 那一档才是真正卡住面板长度的，总 cap 20 平时根本到不了）。
 * 不变量：`RESULT_CAP > COMMAND_ROW_CAP`，否则文件/剪贴板/片段那 11 行永远被挤掉。
 */
export const COMMAND_ROW_CAP = 30
export const FILE_ROW_CAP = 5
export const CLIP_ROW_CAP = 3
export const SNIP_ROW_CAP = 3
export const RESULT_CAP = 50

/** 文件搜索 → CommandEntry（最多 5 条，避免淹没命令结果） */
async function searchFilesAsEntries(q: string): Promise<ScoredEntry[]> {
  try {
    const resp = (await window.api.fileSearch.query(q, FILE_ROW_CAP, { mode: 'name' })) as {
      ok?: boolean
      items?: Array<{ path: string; name: string; dir?: string }>
    }
    const hits = resp?.items ?? []
    return hits.map((h) => ({
      entry: {
        key: `file:${h.path}`,
        icon: 'file-3-line',
        title: h.name,
        subtitle: h.dir || h.path,
        badge: '文件',
        action: { type: 'file', path: h.path, name: h.name }
      },
      highlight: null,
      score: 50
    }))
  } catch {
    return []
  }
}

/** 剪贴板历史 → CommandEntry（最多 3 条；P0-3：备注关键词参与匹配） */
async function searchClipboardAsEntries(q: string): Promise<ScoredEntry[]> {
  try {
    const items = (await window.api.clipHist.list()) as Array<{
      id: string
      kind: 'text' | 'image' | 'files' | 'link'
      text?: string
      paths?: string[]
      keywords?: string[]
    }>
    const lower = q.toLowerCase()
    const keywordHit = (item: { keywords?: string[] }): boolean =>
      item.keywords?.some((k) => k.toLowerCase().includes(lower)) ?? false
    const matched = items
      .filter((item) => {
        if (item.kind === 'text' || item.kind === 'link')
          return item.text?.toLowerCase().includes(lower) || keywordHit(item)
        if (item.kind === 'files')
          return item.paths?.some((p) => p.toLowerCase().includes(lower)) || keywordHit(item)
        return false
      })
      .slice(0, CLIP_ROW_CAP)
    return matched.map((item) => ({
      entry: {
        key: `clip:${item.id}`,
        icon: item.kind === 'image' ? 'image-line' : 'clipboard-line',
        title:
          item.kind === 'files'
            ? (item.paths?.[0]?.split('/').pop() ?? '文件')
            : (item.text ?? '').slice(0, 60),
        subtitle: item.kind === 'link' ? '链接' : '剪贴板',
        badge: '剪贴板',
        action: { type: 'clipboardItem', id: item.id }
      },
      highlight: null,
      score: 40
    }))
  } catch {
    return []
  }
}

/** 代码片段 → CommandEntry（最多 3 条） */
async function searchSnippetsAsEntries(q: string): Promise<ScoredEntry[]> {
  try {
    const snips = (await window.api.snippet.getSnippets({ search: q })) as Array<{
      id: string
      title?: string
      content?: { text?: string } | string
      language?: string
    }>
    return snips.slice(0, SNIP_ROW_CAP).map((s) => ({
      entry: {
        key: `snip:${s.id}`,
        icon: 'file-code-line',
        title: s.title ?? '未命名片段',
        subtitle: s.language ?? '片段',
        badge: '片段',
        action: { type: 'snippetItem', id: s.id }
      },
      highlight: null,
      score: 45
    }))
  } catch {
    return []
  }
}

export function useUnifiedSearch(options: {
  /** 聚合后的命令条目（含别名，随 aliasEpoch 重算） */
  entries: () => CommandEntry[]
  /** 使用统计排序（频次 × 新近混合加权） */
  usageBoost: UsageBoost
  /** 空查询态展示的建议列表 */
  suggestions: Ref<ScoredEntry[]>
  /** 收藏的 CommandEntry.key（P-1.4）：命中即置顶，稳定二分不推翻打分顺序 */
  favorites: Ref<string[]>
}) {
  const results = ref<ScoredEntry[]>([])
  let unifiedSearchToken = 0
  let unifiedSearchTimer: ReturnType<typeof setTimeout> | null = null

  /** 统一混合搜索入口：命令/应用同步 + 文件/剪贴板/片段 异步 */
  async function runUnifiedSearch(q: string): Promise<void> {
    const token = ++unifiedSearchToken
    const trimmed = q.trim()
    if (!trimmed) {
      results.value = options.suggestions.value
      return
    }
    // 同步：命令 + 应用（已有 searchEntries）
    const cmdRows = searchEntries(options.entries(), trimmed, COMMAND_ROW_CAP, options.usageBoost)
    const calc = evaluateExpression(trimmed)
    if (calc) {
      cmdRows.unshift({
        entry: {
          key: 'calc:result',
          icon: 'function-line',
          title: `= ${calc.formatted}`,
          subtitle: calc.expr,
          badge: '计算',
          action: { type: 'copyText', text: calc.formatted }
        },
        highlight: null,
        score: Number.MAX_SAFE_INTEGER
      })
    }
    // 单位换算（10kg to lb / 100usd to cny / 37c to f）
    const conv = convertUnit(trimmed)
    if (conv) {
      // 货币换算标注汇率基准日期（静态汇率，非实时）
      const subtitleSuffix = conv.rateDate ? `（汇率基准 ${conv.rateDate}）` : ''
      cmdRows.unshift({
        entry: {
          key: 'unit:result',
          icon: 'exchange-line',
          title: conv.formatted,
          subtitle: `${conv.fromValue} ${conv.fromUnit} → ${conv.toUnit}${subtitleSuffix}`,
          badge: conv.category,
          action: { type: 'copyText', text: String(conv.toValue) }
        },
        highlight: null,
        score: Number.MAX_SAFE_INTEGER
      })
    }
    // Emoji 搜索（输入关键词匹配 Emoji，回车复制）
    if (trimmed.length >= 2) {
      const emojis = searchEmoji(trimmed, 3)
      for (const emoji of emojis) {
        cmdRows.push({
          entry: {
            key: `emoji:${emoji.emoji}`,
            icon: 'emotion-line',
            title: `${emoji.emoji}  ${emoji.name}`,
            subtitle: emoji.keywords.join(' · '),
            badge: 'Emoji',
            action: { type: 'copyText', text: emoji.emoji }
          },
          highlight: null,
          score: 50
        })
      }
    }
    // 先展示同步结果（立即可见）
    results.value = hoistFavorites(cmdRows, options.favorites.value)

    // 异步：文件 / 剪贴板 / 片段 并行
    const [fileRows, clipRows, snipRows] = await Promise.all([
      searchFilesAsEntries(trimmed),
      searchClipboardAsEntries(trimmed),
      searchSnippetsAsEntries(trimmed)
    ])
    // 过期 token（用户已输入新内容）则丢弃
    if (token !== unifiedSearchToken) return
    // 先置顶再截断：否则收藏项可能被 20 条上限挤掉，置顶就等于没生效
    results.value = hoistFavorites(
      [...cmdRows, ...fileRows, ...clipRows, ...snipRows],
      options.favorites.value
    ).slice(0, RESULT_CAP)
  }

  /** watch(query) 的搜索侧：debounce 触发；空查询回到建议列表 */
  function scheduleForQuery(q: string): void {
    if (unifiedSearchTimer) clearTimeout(unifiedSearchTimer)
    if (!q.trim()) {
      results.value = options.suggestions.value
      return
    }
    unifiedSearchTimer = setTimeout(() => void runUnifiedSearch(q), 150)
  }

  /** 回到建议列表（唤起 / Pop to Root / 空查询） */
  function resetToSuggestions(): void {
    results.value = options.suggestions.value
  }

  return { results, runUnifiedSearch, scheduleForQuery, resetToSuggestions }
}
