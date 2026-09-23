/**
 * Frond · E2E：胶囊的无障碍结构（P-7）
 *
 * 断言的是「结构真的连上了」，不是「属性写了」：
 *  - html 有 lang（读屏的发音引擎靠它）
 *  - 搜索框是 combobox，aria-controls 指向真实存在的 listbox
 *  - aria-activedescendant 必须**指向一个真存在的 option 元素**，
 *    并且按 ↓ 之后它跟着换——悬空或钉死不动的 activedescendant 比没有更糟
 *  - 恰好一行 aria-selected=true（多选态或零选中态都不是 listbox 的语义）
 *  - ⌘K 动作面板同样是 listbox/option
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

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-a11y')
  env.FROND_E2E = '1'
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 文档语言与两处窗口的 lang 都在', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  expect(await main.evaluate(() => document.documentElement.lang)).toBe('zh-CN')
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')
  expect(await capsule.evaluate(() => document.documentElement.lang)).toBe('zh-CN')
})

test('2. combobox ↔ listbox ↔ option 三者是连上的，且 ↓ 会带着走', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('录屏')
  await expect(capsule.locator('[role=option]')).not.toHaveCount(0, { timeout: 15000 })

  // 结构：input → listbox 的引用必须真能解析
  await expect(input).toHaveAttribute('role', 'combobox')
  await expect(input).toHaveAttribute('aria-controls', 'launcher-result-list')
  await expect(capsule.locator('#launcher-result-list[role=listbox]')).toHaveCount(1)

  // 恰好一个选中项
  await expect(capsule.locator('[role=option][aria-selected="true"]')).toHaveCount(1)

  const firstActive = await input.getAttribute('aria-activedescendant')
  expect(firstActive, 'combobox 没有报出当前项').toBeTruthy()
  // activedescendant 指向的元素必须真实存在，且就是那个 aria-selected 的行
  await expect(capsule.locator(`#${firstActive}[role=option]`)).toHaveCount(1)
  await expect(capsule.locator(`#${firstActive}`)).toHaveAttribute('aria-selected', 'true')

  // 结果可能只有一行（↑↓ 会绕回同一行），所以按到 id 真的变化为止；
  // 断言的不是「按了」，而是 activedescendant 真的跟着高亮行走
  let secondActive = firstActive
  for (let i = 0; i < 6 && secondActive === firstActive; i++) {
    await input.press('ArrowDown')
    secondActive = await input.getAttribute('aria-activedescendant')
  }
  expect(secondActive, '↓ 之后 activedescendant 没跟着动').not.toBe(firstActive)
  await expect(capsule.locator(`#${secondActive}[role=option]`)).toHaveCount(1)
  await expect(capsule.locator('[role=option][aria-selected="true"]')).toHaveCount(1)
})

/** 让胶囊回到有结果的搜索态（冷实例要 poll，理由见上一条用例的注释） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const readyCapsule = async (main) => {
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await expect
    .poll(
      async () => {
        await input.fill('')
        await input.fill('录屏')
        await new Promise((r) => setTimeout(r, 200))
        return capsule.locator('[role=option]').count()
      },
      { timeout: 25000 }
    )
    .toBeGreaterThan(0)
  return { capsule, input }
}

test('3. 动作面板同样是 listbox/option', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  const { capsule, input } = await readyCapsule(main)
  await input.press('Meta+k')
  const panel = capsule.locator('[data-testid=action-panel]')
  await expect(panel).toBeVisible({ timeout: 5000 })
  await expect(panel.locator('[role=listbox][aria-label="可用动作"]')).toHaveCount(1)
  await expect(panel.locator('[role=option]')).not.toHaveCount(0)
  await expect(panel.locator('[role=option][aria-selected="true"]')).toHaveCount(1)
  await input.press('Escape')
})
