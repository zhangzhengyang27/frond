import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Frond · 分层门禁：`src/shared` 不得依赖 `src/main`
 *
 * 为什么需要：`src/shared` 是**主进程与渲染层共享**的一层（`preload` 与 `renderer`
 * 都引它）。它反向依赖 `src/main` 会连带把主进程实现拖进**不该看到它们**的程序里 ——
 * 实测：`src/preload/index.d.ts` 引了 `../main/**` 之后，`typecheck:web` 被迫编译
 * **172 个主进程文件**，其中 3 个引 `?asset`（历史上就是这么炸的，现靠
 * `src/renderer/src/env.d.ts` 的 `declare module '*?asset'` 兜住）。
 *
 * 而真正的源头是 `src/shared/ipc-contract.ts` —— 它引了 **51 个** main 模块。
 * 那个选择本身有正当理由（用 `ReturnType<typeof 真实函数>` 从实现派生类型，
 * 避免手抄副本漂移；该文件头 14-16 行记着一次真实的手抄漂移 bug）。
 * 所以本条**不要求立刻还清**，而是**棘轮**：
 *   - 不许新增违规文件（现在只有 1 个）
 *   - 不许让违规条数上涨
 *   - 还债时把下面的基线一起调小（这是显式动作，正是想要的效果）
 *
 * 收口方向见评审 P2-8 与 C3-7：把线格式类型独立定义在 shared、不再从 main 派生，
 * 属**另立专项**的体量。
 */

const REPO_ROOT = join(__dirname, '../../..')
const SHARED_DIR = join(REPO_ROOT, 'src/shared')

/** 棘轮基线（2026-09-24 实测）。**只许往下调**，不许往上加。 */
const BASELINE_VIOLATING_FILES = ['ipc-contract.ts']
const BASELINE_IMPORT_COUNT = 51

function walkTs(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      walkTs(full, out)
    } else if (e.name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('分层门禁：src/shared 不得依赖 src/main（棘轮）', () => {
  it('违规文件集合与违规条数都不超过基线', () => {
    const files = walkTs(SHARED_DIR)
    // 体量哨兵：扫不到文件说明路径错了，不是「通过」
    expect(files.length, 'src/shared 下一个 .ts 都没扫到 = 路径错').toBeGreaterThan(20)

    const perFile: Array<{ rel: string; hits: string[] }> = []
    for (const f of files) {
      const hits = [...readFileSync(f, 'utf-8').matchAll(/from\s+'(\.\.\/main\/[^']*)'/g)].map(
        (m) => m[1]
      )
      if (hits.length) perFile.push({ rel: relative(SHARED_DIR, f), hits })
    }

    const total = perFile.reduce((n, r) => n + r.hits.length, 0)
    const offenders = perFile.map((r) => r.rel).sort()

    expect(
      offenders,
      'src/shared 下出现了**新的**对 src/main 的依赖 —— 共享层不该反向依赖主进程实现：\n  ' +
        offenders.join('\n  ')
    ).toEqual(BASELINE_VIOLATING_FILES)

    expect(
      total,
      `src/shared → src/main 的 import 从基线的 ${BASELINE_IMPORT_COUNT} 条变成了 ${total} 条。\n` +
        '只许下降（还债时把 BASELINE_IMPORT_COUNT 一起调小）；上涨说明又在共享层里引了主进程实现。'
    ).toBeLessThanOrEqual(BASELINE_IMPORT_COUNT)
  })
})
