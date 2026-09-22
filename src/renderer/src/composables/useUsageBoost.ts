import { ref } from 'vue'
import type { CommandEntry } from '@shared/commands'

/**
 * 搜索排序自学习（维度 1）：频次 × 新近混合加权，胶囊与 ⌘K 面板共用。
 * - 新近：最近使用 rank 0 → +40 递减到 0
 * - 频次：log2(count) * 6，上限 +30（约 16 次饱和，避免单一模块霸榜）
 * 不打断标题命中 > 别名 > 副标题命中的基本序（score 只做同档内加权）。
 *
 * V4 P0-3：加权扩展到全部命令类型——命令执行时按 entry.key 记录使用
 * （见 commandRunner），module 动作额外回落到裸 moduleId
 * （useAppMenu / Sidebar / Home 等路由入口只记录模块 id，保持旧数据可用）。
 */
export function useUsageBoost(): {
  refresh: () => Promise<void>
  boost: (entry: CommandEntry) => number
} {
  const usageRank = ref<Map<string, number>>(new Map()) // 记录 key → 新近排名
  const usageCount = ref<Map<string, number>>(new Map()) // 记录 key → 使用次数

  async function refresh(): Promise<void> {
    try {
      const stats = await window.api.usage.getStats()
      const sorted = [...stats].sort((a, b) => b.usedAt - a.usedAt)
      usageRank.value = new Map(sorted.map((s, i) => [s.moduleId, i]))
      usageCount.value = new Map(sorted.map((s) => [s.moduleId, s.useCount]))
    } catch {
      /* 使用记录读取失败不参与加权 */
    }
  }

  /** 取某个记录 key 的加权值；无记录返回 0 */
  function boostOf(key: string): number {
    const rank = usageRank.value.get(key)
    if (rank === undefined) return 0
    const recency = Math.max(0, 40 - rank * 4)
    const frequency = Math.min(30, Math.log2(Math.max(1, usageCount.value.get(key) ?? 1)) * 6)
    return recency + frequency
  }

  function boost(entry: CommandEntry): number {
    const keys = entry.action.type === 'module' ? [entry.key, entry.action.moduleId] : [entry.key]
    let best = 0
    for (const key of keys) {
      best = Math.max(best, boostOf(key))
    }
    return best
  }

  return { refresh, boost }
}
