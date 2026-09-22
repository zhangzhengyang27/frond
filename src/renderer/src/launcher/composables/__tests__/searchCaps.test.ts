import { describe, it, expect } from 'vitest'
import {
  CLIP_ROW_CAP,
  COMMAND_ROW_CAP,
  FILE_ROW_CAP,
  RESULT_CAP,
  SNIP_ROW_CAP
} from '../useUnifiedSearch'

/**
 * 根搜索各来源的行数上限（P-6④）之间的关系。
 *
 * 单看每个数都没意义，有意义的是它们**挤不挤得下彼此**：
 * 命令一栏就把总 cap 吃满的话，文件 / 剪贴板 / 片段那几路永远轮不到显示——
 * 而那正是「同一查询里结果类型越少越像没生效」的来源。
 * 这条不变量以前只写在注释里（注释不会变红）。
 */
describe('根搜索行数上限的相互关系', () => {
  it('命令占满之后，剩下的位子还装得下其余三路各自的上限', () => {
    const others = FILE_ROW_CAP + CLIP_ROW_CAP + SNIP_ROW_CAP
    expect(others, '三路加起来是 0 就没有比较的意义').toBeGreaterThan(0)
    expect(
      RESULT_CAP - COMMAND_ROW_CAP,
      `命令 ${COMMAND_ROW_CAP} 行之后只剩 ${RESULT_CAP - COMMAND_ROW_CAP} 个位子，装不下 ${others} 行`
    ).toBeGreaterThanOrEqual(others)
  })

  it('每一路自己的上限都不超过总 cap（否则单路就能把别的挤光）', () => {
    for (const [name, cap] of [
      ['COMMAND_ROW_CAP', COMMAND_ROW_CAP],
      ['FILE_ROW_CAP', FILE_ROW_CAP],
      ['CLIP_ROW_CAP', CLIP_ROW_CAP],
      ['SNIP_ROW_CAP', SNIP_ROW_CAP]
    ] as const) {
      expect(cap, name).toBeGreaterThan(0)
      expect(cap, name).toBeLessThan(RESULT_CAP)
    }
  })
})
