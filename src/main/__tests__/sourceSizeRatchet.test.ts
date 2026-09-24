/**
 * Frond · 源文件体量棘轮门禁
 *
 * 为什么管行数：单人 + AI 协作模式下，巨型文件是编辑事故率最高的场景 ——
 * 行号引用漂移、局部改写误伤无关代码、上下文装不下导致「按印象写」。
 * 本仓的防幻觉制度（结论带 文件:行号）在 2000 行文件面前是脆的。
 *
 * 棘轮规则（2026-09-24 基线，只许降不许升）：
 *   1. 任何源文件不得超过当前最大者（LauncherApp.vue 2437 行）——
 *      「再造一个更大的」必须显式改数字，让决策可见
 *   2. 超 1000 行的文件清单精确等于 KNOWN_OVER_1000 —— 拆掉一个就从清单
 *      移除一行（棘轮咬紧）；新进一个就红灯，逼先拆再写
 *
 * ⚠ 本测试**不是**反巨型化纲领的自动执行者：它只防「静默变糟」。
 * 存量 7 个的拆分是刻意的工作（见 HANDOFF 工程评估 P1），不在本门禁范围内。
 *
 * 口径：src 下所有 .ts 与 .vue（排除 __tests__——测试文件该小，由 code review 管；
 * 排除 .d.ts——纯声明）。行数 = 文件行数（wc 口径，与 scripts/recovery 同源）。
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC_DIR = join(__dirname, '..', '..')

/** 2026-09-24 基线：超 1000 行的全部源文件（按行数降序）。拆掉一个就删一行。 */
const KNOWN_OVER_1000 = [
  'renderer/src/launcher/LauncherApp.vue', // 2437
  'renderer/src/views/SettingsView.vue', // 1743
  'shared/ipc-contract.ts', // 1567
  'renderer/src/views/pomodoro/index.vue', // 1539
  'renderer/src/views/snippets/components/Editor.vue', // 1515
  'renderer/src/views/launcher/index.vue', // 1236
  'preload/index.ts' // 1131
]

/** 体量哨兵基线：任何文件不得超过此行数（= 当前最大者） */
const MAX_LINES = 2437

interface Sized {
  rel: string
  lines: number
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      walk(full, out)
    } else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(relative(SRC_DIR, full))
    }
  }
  return out
}

function sizedFiles(): Sized[] {
  return walk(SRC_DIR)
    .map((rel) => {
      // wc 口径（换行符计数）：split('\n') 会把末尾换行多算一行，与 wc -l 差 1
      const text = readFileSync(join(SRC_DIR, rel), 'utf-8')
      const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
      return { rel, lines }
    })
    .sort((a, b) => b.lines - a.lines)
}

describe('源文件体量棘轮', () => {
  it('扫描到足够的源文件（体量哨兵：防止扫描退化成扫了个空目录）', () => {
    expect(walk(SRC_DIR).length).toBeGreaterThan(300)
  })

  it('没有任何文件超过当前最大者（要更大必须显式改 MAX_LINES，让决策可见）', () => {
    const oversized = sizedFiles().filter((f) => f.lines > MAX_LINES)
    expect(
      oversized,
      `这些文件突破了 ${MAX_LINES} 行上限 —— 先拆分，或有意突破时改 MAX_LINES 并在此说明`
    ).toEqual([])
  })

  it('超 1000 行的文件精确等于已知清单（拆一个少一个；新增即红灯）', () => {
    const over = sizedFiles()
      .filter((f) => f.lines > 1000)
      .map((f) => `${f.rel}`)

    const known = [...KNOWN_OVER_1000].sort()
    expect(over.sort(), '与 KNOWN_OVER_1000 不一致：拆掉的就删行；新进的先拆分再写').toEqual(known)
  })
})
