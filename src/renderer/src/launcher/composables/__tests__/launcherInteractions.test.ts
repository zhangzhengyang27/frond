/**
 * 启动器交互纯函数单测（B1 五件套）
 *
 * 覆盖：
 *  - digitToIndex: 数字直达键位映射（1-9 → 0-8，0 → 9，非数字 → null）
 *  - isIdleExpired / idleRemainingMs / shiftLastActivity: Pop to Root 空闲判定
 *    （含窗口隐藏暂停 → 恢复后剩余时间继续累计）
 *  - nextHistoryCursor: 搜索历史 ↑/↓ 循环导航游标
 *  - primaryActionLabel: 底部动作栏主动作文案映射
 */

import { ref } from 'vue'
import { describe, it, expect } from 'vitest'
import {
  POP_TO_ROOT_TIMEOUT_MS,
  argPrefill,
  digitToIndex,
  groupResultsForDisplay,
  hoistFavorites,
  isIdleExpired,
  idleRemainingMs,
  shiftLastActivity,
  nextHistoryCursor,
  primaryActionLabel,
  latestOnly
} from '../launcherInteractions'

describe('launcherInteractions', () => {
  describe('digitToIndex（数字直达）', () => {
    it('1-9 映射到下标 0-8', () => {
      expect(digitToIndex('1')).toBe(0)
      expect(digitToIndex('9')).toBe(8)
      expect(digitToIndex('5')).toBe(4)
    })

    it('0 表示第 10 条（下标 9）', () => {
      expect(digitToIndex('0')).toBe(9)
    })

    it('非数字键返回 null', () => {
      expect(digitToIndex('a')).toBeNull()
      expect(digitToIndex('F5')).toBeNull()
      expect(digitToIndex('ArrowUp')).toBeNull()
    })
  })

  describe('Pop to Root 空闲判定', () => {
    it('未超阈值不回根，达到阈值回根', () => {
      const last = 1_000
      expect(isIdleExpired(last, last + POP_TO_ROOT_TIMEOUT_MS - 1, POP_TO_ROOT_TIMEOUT_MS)).toBe(
        false
      )
      expect(isIdleExpired(last, last + POP_TO_ROOT_TIMEOUT_MS, POP_TO_ROOT_TIMEOUT_MS)).toBe(true)
      expect(isIdleExpired(last, last + POP_TO_ROOT_TIMEOUT_MS + 1, POP_TO_ROOT_TIMEOUT_MS)).toBe(
        true
      )
    })

    it('隐藏暂停：剩余时间在暂停时刻冻结', () => {
      const last = 0
      const timeout = 60_000
      // 活动了 20s 后隐藏 → 剩余 40s
      expect(idleRemainingMs(last, 20_000, timeout)).toBe(40_000)
      // 已超过阈值时隐藏 → 剩余 0
      expect(idleRemainingMs(last, 70_000, timeout)).toBe(0)
    })

    it('恢复计时：暂停期间不计入空闲时长（平移 lastActivityAt）', () => {
      const timeout = 60_000
      const last = 0
      const pausedAt = 20_000
      const resumedAt = 80_000 // 隐藏了 60s
      const shifted = shiftLastActivity(last, pausedAt, resumedAt)
      // 恢复时刻的空闲时长应仍等于暂停前的 20s
      expect(resumedAt - shifted).toBe(20_000)
      // 恢复后再过 40s 到期
      expect(isIdleExpired(shifted, resumedAt + 40_000, timeout)).toBe(true)
      expect(isIdleExpired(shifted, resumedAt + 39_999, timeout)).toBe(false)
    })

    it('恢复平移对非法区间（resumedAt < pausedAt）保持原值', () => {
      expect(shiftLastActivity(1_000, 5_000, 4_000)).toBe(1_000)
    })
  })

  describe('nextHistoryCursor（搜索历史导航）', () => {
    it('空历史恒为 -1', () => {
      expect(nextHistoryCursor(-1, 0, 'up')).toBe(-1)
      expect(nextHistoryCursor(-1, 0, 'down')).toBe(-1)
    })

    it('↑ 从未选中态进入最新一条（0），逐条向更旧推进', () => {
      expect(nextHistoryCursor(-1, 3, 'up')).toBe(0)
      expect(nextHistoryCursor(0, 3, 'up')).toBe(1)
      expect(nextHistoryCursor(1, 3, 'up')).toBe(2)
    })

    it('↑ 翻过最旧一条后回到空查询态（-1），形成循环', () => {
      expect(nextHistoryCursor(2, 3, 'up')).toBe(-1)
      expect(nextHistoryCursor(-1, 3, 'up')).toBe(0)
    })

    it('↓ 反向回退，越过空查询态后跳到最旧一条', () => {
      expect(nextHistoryCursor(2, 3, 'down')).toBe(1)
      expect(nextHistoryCursor(0, 3, 'down')).toBe(-1)
      expect(nextHistoryCursor(-1, 3, 'down')).toBe(2)
    })
  })

  describe('primaryActionLabel（底部动作栏）', () => {
    it('打开类动作显示「打开」', () => {
      for (const t of ['app', 'module', 'page', 'file', 'quicklink', 'system']) {
        expect(primaryActionLabel(t)).toBe('打开')
      }
    })

    it('复制类动作显示「复制」', () => {
      for (const t of ['clipboardItem', 'snippetItem', 'copyText']) {
        expect(primaryActionLabel(t)).toBe('复制')
      }
    })

    it('历史词条显示「填入」，未知/无选中显示「执行」', () => {
      expect(primaryActionLabel('searchQuery')).toBe('填入')
      expect(primaryActionLabel('ai')).toBe('发送')
      expect(primaryActionLabel('plugin')).toBe('执行')
      expect(primaryActionLabel(undefined)).toBe('执行')
    })
  })
})

describe('groupResultsForDisplay（V5 分区渲染的扁平下标映射）', () => {
  const mk = (
    type: string,
    title: string
  ): { entry: { action: { type: string }; title: string } } => ({
    entry: { action: { type }, title }
  })
  const mixed = [mk('app', 'a'), mk('file', 'f1'), mk('module', 'm'), mk('file', 'f2')]

  it('根态（无查询词）：单「建议」分区，保序 + 扁平下标', () => {
    const groups = groupResultsForDisplay(mixed, false)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('建议')
    expect(groups[0].items.map((s) => s.index)).toEqual([0, 1, 2, 3])
  })

  it('查询态：文件行归「文件」，其余归「结果」，槽位保留原扁平下标', () => {
    const groups = groupResultsForDisplay(mixed, true)
    expect(groups.map((g) => g.label)).toEqual(['结果', '文件'])
    expect(groups[0].items.map((s) => s.index)).toEqual([0, 2])
    expect(groups[1].items.map((s) => s.index)).toEqual([1, 3])
  })

  it('查询态无文件结果：只输出「结果」一个分区', () => {
    const groups = groupResultsForDisplay([mk('app', 'a')], true)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('结果')
  })

  it('查询态全是文件：输出空的「结果」分区 + 「文件」分区', () => {
    const groups = groupResultsForDisplay([mk('file', 'f1')], true)
    expect(groups.map((g) => g.label)).toEqual(['结果', '文件'])
    expect(groups[0].items).toEqual([])
    expect(groups[1].items.map((s) => s.index)).toEqual([0])
  })
})

describe('latestOnly（推送驱动的重拉：只认最新一趟）', () => {
  it('先发起的那趟晚回来时，不许覆盖后一趟的结果', async () => {
    const commit = ref<string>('')
    let n = 0
    const load = latestOnly<string>(
      async () => {
        const mine = ++n
        // 第 1 趟慢、第 2 趟快：不按序号提交的话，晚到的「1」会盖掉「2」
        await new Promise((r) => setTimeout(r, mine === 1 ? 30 : 1))
        return String(mine)
      },
      (v) => {
        commit.value = v
      }
    )
    const first = load()
    const second = load()
    await Promise.all([first, second])
    expect(commit.value).toBe('2')
  })

  it('一趟都没有更新时照常提交（这条闸不能变成「什么都不提交」）', async () => {
    const commit = ref<number | null>(null)
    const load = latestOnly<number>(async () => 7, (v) => (commit.value = v))
    await load()
    expect(commit.value).toBe(7)
  })
})

describe('argPrefill', () => {
  it('标题是前缀时，剩余部分作为参数初值', () => {
    expect(argPrefill('github react', 'GitHub')).toBe('react')
  })
  it('标题不是前缀就不猜（避免把用户别的词塞进参数）', () => {
    expect(argPrefill('react github', 'GitHub')).toBe('')
    expect(argPrefill('github', 'GitHub repo')).toBe('')
  })
  it('只有标题本身 / 空查询都返回空串', () => {
    expect(argPrefill('GitHub', 'github')).toBe('')
    expect(argPrefill('', 'GitHub')).toBe('')
    expect(argPrefill('   ', 'GitHub')).toBe('')
  })
})

describe('hoistFavorites', () => {
  const row = (key: string): { entry: { key: string } } => ({ entry: { key } })

  it('收藏条目提到最前，收藏之间保持原有分数顺序（不受收藏写入先后影响）', () => {
    const rows = [row('a'), row('b'), row('c'), row('d')]
    // 收藏表里 d 比 b 先写，但 b 分数更高 → b 仍在 d 前
    expect(hoistFavorites(rows, ['d', 'b']).map((r) => r.entry.key)).toEqual(['b', 'd', 'a', 'c'])
  })
  it('无收藏 / 空列表都原样返回（同引用内容即可，不要求同实例）', () => {
    const rows = [row('a'), row('b')]
    expect(hoistFavorites(rows, []).map((r) => r.entry.key)).toEqual(['a', 'b'])
    expect(hoistFavorites([], ['a'])).toEqual([])
  })
  it('收藏了但本次没命中的 key 不凭空造行', () => {
    const rows = [row('a')]
    expect(hoistFavorites(rows, ['ghost', 'a']).map((r) => r.entry.key)).toEqual(['a'])
  })
})
