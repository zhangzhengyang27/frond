/**
 * Frond · 性能基线（M0）
 *
 * 产出 test-results/perf-baseline.json：
 * - coldStartMs      ：electron.launch → 主窗口 DOM 就绪（信息性，含进程拉起）
 * - capsuleShowMs    ：胶囊「隐藏 → 可见」耗时（主进程打点，预算 < 200ms，硬断言）
 * - memory           ：app.getAppMetrics() 按类型聚合（KB）
 *
 * 用法：先 pnpm build，再 pnpm exec playwright test e2e/perf-baseline.spec.mjs
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

// 按 url 匹配主窗口（title 匹配会连胶囊窗 "Frond Launcher" 一起命中）。
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) return w
      } catch {
        /* 窗口可能已关闭 */
      }
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('30s 内没等到主窗口（out/renderer/index.html）')
}

test('性能基线：冷启动 / 胶囊唤起 / 内存', async () => {
  const env = { ...process.env }
env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-perf-baseline')
  delete env.ELECTRON_RUN_AS_NODE

  const coldT0 = Date.now()
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  const coldStartMs = Date.now() - coldT0

  // 跳过 onboarding，让主窗落在 Hub
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })

  // 胶囊：首次唤起（含懒创建）→ 记录冷样本；隐藏 → 再唤起 → 热样本（预算断言）
  await main.evaluate(() => window.api.launcher.show())
  await new Promise((r) => setTimeout(r, 800))
  const firstShow = (await main.evaluate(() => window.api.launcher.perf())).lastShowLatencyMs

  await main.evaluate(() => window.api.launcher.hide())
  await new Promise((r) => setTimeout(r, 300))
  await main.evaluate(() => window.api.launcher.show())
  await new Promise((r) => setTimeout(r, 200))
  const warmShow = (await main.evaluate(() => window.api.launcher.perf())).lastShowLatencyMs

  // 内存快照（按类型聚合）
  const memory = await app.evaluate(({ app: electronApp }) => {
    const byType = {}
    for (const m of electronApp.getAppMetrics()) {
      const type = m.type ?? 'unknown'
      byType[type] ??= { count: 0, workingSetKB: 0 }
      byType[type].count += 1
      byType[type].workingSetKB += m.memory?.workingSetSize ?? 0
    }
    return byType
  })

  const report = {
    capturedAt: new Date().toISOString(),
    coldStartMs,
    capsuleShow: { firstMs: firstShow, warmMs: warmShow, budgetMs: 200 },
    memory
  }
  mkdirSync(join(ROOT, 'test-results'), { recursive: true })
  writeFileSync(join(ROOT, 'test-results', 'perf-baseline.json'), JSON.stringify(report, null, 2))
  console.log('[perf]', JSON.stringify(report))

  // 预算硬断言：仅热唤起（用户日常路径）。冷启动与内存只记录，不设阈值。
  expect(warmShow).toBeGreaterThanOrEqual(0)
  expect(warmShow).toBeLessThan(200)
  expect(coldStartMs).toBeLessThan(30000)
})
