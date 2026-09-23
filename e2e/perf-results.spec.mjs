/**
 * Frond · 根搜索列表性能实测（P-6④）
 *
 * 要回答的问题很具体：**多渲染几条行，敲一个键要付多少钱**。
 * 旧结论（HANDOFF §8「Fuse 实例复用只省 11%」）是封顶 20 条时量的，
 * 而 20 这条上限现在根本到不了——命令那一档只有 8 行（`useUnifiedSearch.ts`），
 * 文件/剪贴板/片段各 5/3/3。所以先按现状量，再改常量重建一次量「放宽到 200」的代价。
 *
 * A/B 的做法是**改 `useUnifiedSearch.ts` 里那几个常量 → 重新 build → 再跑本文件**，
 * 不在产品代码里留运行期开关（一个只有测试会碰的旋钮很容易被当成真功能）。
 * 用 `FROND_PERF_LABEL` 标记这一次是哪个变体，结果写进
 * `test-results/perf-results-<label>.json`，两轮数字放一起比才有意义。
 *
 * 量的是端到端：填入查询 → 列表连续两次采样不再变。里面含 150ms 防抖与异步补充，
 * 这是刻意的——用户感知的就是这一整段；两个变体付的是同一份防抖，**差值才是行数带来的**。
 *
 * 用法：`npx electron-vite build && FROND_PERF_LABEL=cap20 npx playwright test e2e/perf-results.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync, writeFileSync, mkdirSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const LABEL = process.env.FROND_PERF_LABEL ?? 'default'

/**
 * 探测查询：**每个词只量一次**（同值重复填不会有 DOM 变化，中位数会被 0 糊掉），
 * 常用字母命中一大片、两字母词命中较少，凑出一条「行数 vs 代价」的散点。
 */
const PROBES = ['a', 'e', 'i', 's', 'se', 'er', 'co', 'clip', 'safari', 'note']

let app = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getCapsuleWindow = async () => {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('launcher.html')) return w
      } catch {
        /* 窗口可能已关闭 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `找不到胶囊窗：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        const u = w.url()
        if (/\/index\.html/.test(u) && !/launcher\.html/.test(u)) return w
      } catch {
        /* 尚未就绪 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `找不到主窗：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const rowCount = (capsule) => capsule.locator('.launcher-result').count()

/**
 * 敲一个键并量到「列表不再变化」为止。
 *
 * 为什么用页内 MutationObserver 而不是在外面数行数收敛：换查询时新旧列表常常**一样长**
 * （比如 'e'→'a' 都是 10 行），数行数的写法会在 150ms 防抖都还没到期时就判「稳定」，
 * 量出 110ms 这种看着合理其实是假的数字。观察 DOM 真的停了才作数。
 * 窗口固定 1.6s：够文件/剪贴板这类异步源到达。
 * 除了三个数还回一份 `stalled`：**窗口到底为止 DOM 还在变**（= 最后一次突变贴着窗尾）。
 * 这个布尔才是「列表根本不落定了」的信号——settleMs 被窗口封顶，拿它去比一个比窗口大的
 * 预算是恒真的断言（之前那条 < 4000 就是这么空的）。
 */
const MEASURE_WINDOW_MS = 1600

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const measure = (capsule, q) =>
  capsule.evaluate(
    ({ text, windowMs }) => {
      const input = document.querySelector('.launcher-search-input')
      const root = document.querySelector('.launcher')
      if (!input || !root) throw new Error('胶囊还没挂载')
      return new Promise((resolve) => {
        let first = -1
        let last = 0
        const t0 = performance.now()
        const obs = new MutationObserver(() => {
          const now = performance.now() - t0
          if (first < 0) first = now
          last = now
        })
        obs.observe(root, { childList: true, subtree: true, characterData: true })
        input.value = text
        input.dispatchEvent(new Event('input', { bubbles: true }))
        setTimeout(() => {
          obs.disconnect()
          // settleMs：从敲下这一键到 DOM 最后一次变化（含 150ms 防抖，两档同价）
          // churnMs ：第一次到最后一次变化——把防抖那段切掉，看的是「算完到画完」
          resolve({
            rows: document.querySelectorAll('.launcher-result').length,
            settleMs: Math.min(windowMs, Math.round(last)),
            churnMs: first < 0 ? 0 : Math.min(windowMs, Math.round(last - first)),
            // 这一项才是「同步那一半」（打分 + 首屏绘制）多少钱：
            // 与 150ms 防抖比差值就是答案，不用碰产品代码去插桩
            firstMutationMs: first < 0 ? 0 : Math.round(first),
            // 最后一次突变落在窗尾 15% 以内 = 根本没停
            stalled: last > windowMs * 0.85
          })
        }, windowMs)
      })
    },
    { text: q, windowMs: MEASURE_WINDOW_MS }
  )

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-perf-results')
  env.FROND_E2E = '1'
  // 这条用例量的是「面板真长到那么多行时多少钱」，所以命令表必须是真规模：
  // 不跳内置插件（跳了之后命令池小一倍，200 那一档根本填不满，量出来的是假数字）
  delete env.FROND_SKIP_BUILTIN_PLUGINS
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test(`量一次：变体 ${LABEL}`, async () => {
  test.setTimeout(150000)
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  // 冷实例里空查询那一屏不保证有行（命令表在异步装配），所以 readiness 用真查询驱动，
  // 顺带当作热身：首键要付 alias/enrich 的异步装配，不该计进测量样本
  await input.click()
  // 热身手用一个和样本都不一样的词：同值再填一次 Vue 不会重渲染，
  // 那样第一个样本会量到 0 突变（settleMs=0 的假快）
  await input.fill('设置')
  await expect
    .poll(async () => (await rowCount(capsule)) > 0, { timeout: 25000, interval: 300 })
    .toBe(true)

  // 先把全部探测词过一遍当热身再采数：不热身时前几个词会撞上文件索引冷启动，
  // 同一份代码同一份数据能差出 400ms（实测：单字母词 466ms vs 后面同样的单字母 15ms），
  // 那种数字写进文档就是下一次误判的来源
  for (const q of PROBES) await measure(capsule, q)
  const samples = []
  for (const q of PROBES) samples.push({ q, ...(await measure(capsule, q)) })
  samples.sort((x, y) => x.rows - y.rows)

  const report = { capturedAt: new Date().toISOString(), variant: LABEL, samples }
  mkdirSync(join(ROOT, 'test-results'), { recursive: true })
  writeFileSync(
    join(ROOT, `test-results/perf-results-${LABEL}.json`),
    JSON.stringify(report, null, 2)
  )
  console.log('[perf-results]', JSON.stringify(report.samples))

  // 只设一条很松的预算：这条用例的产出是**数字**，不是把一个易变指标钉成红线。
  // 预算存在的意义是「哪天列表根本不落定了」能被看见。
  //
  // 但这条预算之前是**恒真**的：settleMs 被 Math.min(1200, …) 封顶之后再去断言 < 4000，
  // 任何行为都过——包括「DOM 到现在还在变」那种最该红的情形。
  // 现在两件事分开：`stalled` 量的是「观察窗到底为止没停」（必须为 false，这条不封顶所以不恒真），
  // settleMs 只是写进 JSON 的数值，封顶留着（超过窗口就是窗口的长度，不参与断言）。
  for (const s of samples) {
    expect(s.rows).toBeGreaterThan(0)
    expect(s.stalled, `「${s.q}」这一键到观察窗结束还在变，列表根本没落定`).toBe(false)
  }
})
