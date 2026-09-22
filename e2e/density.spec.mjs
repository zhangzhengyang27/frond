/**
 * Leaf · E2E：结果列表密度档（P-6 Compact Mode）
 *
 * 量的是胶囊里**真实一行的高度**，不是 CSS 里写了个变量：
 * 设置页改档 → 主进程存偏好 → 胶囊重新可见时补读 → 行高真的变了。
 * 顺带钉住「字号不跟着缩」——紧凑档只压行高与间距，
 * 字号一改，详情面板那套按像素对齐的地方就会错位（那是另一个问题，不该混进来）。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/density.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
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
    await new Promise((r) => setTimeout(r, 200))
  }
  return app.firstWindow()
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getCapsuleWindow = async () => {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('launcher.html')) return w
      } catch {
        /* noop */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

/** 当前一行的高与该行的字号 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const measureRow = async (capsule) => {
  const row = capsule.locator('.launcher-result').first()
  const box = await row.boundingBox()
  const fontSize = await row.evaluate((el) => getComputedStyle(el).fontSize)
  return { height: box ? box.height : 0, fontSize }
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-density')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

/** 让胶囊处于有结果的状态（冷实例要 poll，理由见 a11y 用例的注释） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const showResults = async (main) => {
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await expect
    .poll(
      async () => {
        await input.fill('')
        await input.fill('设置')
        await new Promise((r) => setTimeout(r, 200))
        return capsule.locator('.launcher-result').count()
      },
      { timeout: 25000 }
    )
    .toBeGreaterThan(0)
  return capsule
}

test('1. 默认是宽松档，切到紧凑档后行高真的变小、字号不变', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()

  expect(await main.evaluate(() => window.api.preferences.getDensity())).toBe('comfortable')
  let capsule = await showResults(main)
  const wide = await measureRow(capsule)
  expect(wide.height).toBeGreaterThan(30)

  // 走 UI 改档（不是直接调 API）：设置页那一行按钮也得真的接着
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await main.getByText('结果列表密度').first().waitFor({ timeout: 15000 })
  await main.locator('[data-density-opt="compact"]').click()
  expect(await main.evaluate(() => window.api.preferences.getDensity())).toBe('compact')

  // 胶囊重新可见时补读一次偏好
  capsule = await showResults(main)
  const compact = await measureRow(capsule)
  expect(compact.height).toBeLessThan(wide.height)
  // 只压行高与间距：字号跟着缩就说明改到了不该改的地方
  expect(compact.fontSize).toBe(wide.fontSize)
})

test('2. 设置页与主进程说的是同一个档', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  const shown = await main.locator('[data-density-opt="compact"]').evaluate((el) =>
    el.classList.contains('bg-brand-500')
  )
  expect(shown, '界面高亮的档与存储的档不一致').toBe(true)
})
