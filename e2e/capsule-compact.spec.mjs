/**
 * Leaf · E2E：紧凑模式（P-6⑤ 最后一格）
 *
 * 三个都必须成立的点：
 *  1. **默认关**——空态那一屏（下一个会议 / 固定建议 / 最近搜索）是另一格 Raycast 对齐
 *     拍板过的东西，这格不能把它默认推翻；
 *  2. 开起来后空查询确实**收成一条栏**：窗口高度真的变小、列表不再渲染，
 *     而不是只存了个偏好值；
 *  3. 打字即回到完整高度（且行还在）——这是「收缩」而不是「把列表关掉」。
 *
 * 用法：先 `npx electron-vite build`，再 `pnpm exec playwright test e2e/capsule-compact.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const FULL_HEIGHT = 520

let app = null

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
  throw new Error(`找不到主窗：${app.windows().map((w) => w.url()).join(' | ')}`)
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getCapsuleWindow = async () => {
  const deadline = Date.now() + 20000
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
  throw new Error('找不到胶囊窗')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const capsuleHeight = () =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Launcher'))
    return win ? win.getBounds().height : -1
  })

/**
 * 搜索行底边那条分隔线：完整态 1px，收成一条栏时必须是 0。
 * 这条断言是为「把搜索栏拆成子组件」准备的守卫——scoped CSS 的规则只作用于带本组件
 * 作用域属性的元素，父组件里写的 `.launcher.compact .launcher-search` 在子组件的
 * 内部元素上**不生效**，规则丢了界面只会多/少一条线，谁都不会报错。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const searchBarBorder = (capsule) =>
  capsule.evaluate(() => {
    const el = document.querySelector('.launcher-search')
    return el ? getComputedStyle(el).borderBottomWidth : 'no-element'
  })

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-capsule-compact')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 90000 })

test('1. 默认关：空查询仍是完整高度并显示空态建议', async () => {
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  expect(await main.evaluate(() => window.api.preferences.getCompactMode())).toBe(false)
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  await expect
    .poll(async () => capsule.locator('.launcher-search-input').count(), { timeout: 20000 })
    .toBeGreaterThan(0)
  await expect
    .poll(async () => (await capsuleHeight()) === FULL_HEIGHT, { timeout: 5000 })
    .toBe(true)
  // 空态那一屏必须真的有一行：它曾被「下一个会议」那条无界 await 挡成空白面板
  await expect
    .poll(async () => capsule.locator('.launcher-result').count(), { timeout: 8000 })
    .toBeGreaterThan(0)
  // 空态那一屏必须真的有一行：它曾经被「下一个会议」那条无界 await 挡成空白面板
  await expect
    .poll(async () => capsule.locator('.launcher-result').count(), { timeout: 8000 })
    .toBeGreaterThan(0)
  // 空态那一屏要等建议装配完（下一个会议走日历 IPC），不要读得太快
  await expect
    .poll(async () => capsule.locator('.launcher-result').count(), { timeout: 25000 })
    .toBeGreaterThan(0)
})

test('2. 开起来后：空查询收成一条栏，打字回到完整高度', async () => {
  const main = await getMainWindow()
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  // eslint-disable-next-line no-console -- 临时判异
  console.log('[ROUTE]', await main.evaluate(() => location.href))
  await main.getByRole('button', { name: '启动器' }).first().click()
  await main.getByText('紧凑模式').first().waitFor({ timeout: 15000 })
  await main.locator('[data-compact-toggle]').click()
  await expect
    .poll(async () => main.evaluate(() => window.api.preferences.getCompactMode()), {
      timeout: 10000
    })
    .toBe(true)

  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  // 空查询：收成一条栏（只剩搜索行 + 窗口描边），列表不再渲染
  await input.fill('')
  await expect.poll(async () => (await capsuleHeight()) < 120, { timeout: 8000 }).toBe(true)
  // 一条栏底下没有列表，那条 hairline 会变成窗口的第二条描边 → 必须收掉
  await expect
    .poll(async () => searchBarBorder(capsule), { timeout: 5000 })
    .toBe('0px')
  expect(await capsule.locator('.launcher-result').count()).toBe(0)

  // 打字：高度回来且结果真的在
  await input.fill('se')
  await expect.poll(async () => (await capsuleHeight()) === FULL_HEIGHT, { timeout: 8000 }).toBe(true)
  expect(await capsule.locator('.launcher-result').count()).toBeGreaterThan(0)

  // 清空：又收回一条栏（双向都要跟，不然「收缩」变成「一次性的」）
  await input.fill('')
  await expect.poll(async () => (await capsuleHeight()) < 120, { timeout: 8000 }).toBe(true)
  // 一条栏底下没有列表，那条 hairline 会变成窗口的第二条描边 → 必须收掉
  expect(await searchBarBorder(capsule)).toBe('0px')

  // 关掉开关：空查询也回到完整高度（默认语义没被这次开启污染）
  await main.locator('[data-compact-toggle]').click()
  await expect
    .poll(async () => main.evaluate(() => window.api.preferences.getCompactMode()), {
      timeout: 10000
    })
    .toBe(false)
  await expect.poll(async () => (await capsuleHeight()) === FULL_HEIGHT, { timeout: 8000 }).toBe(true)
  expect(await capsule.locator('.launcher-result').count()).toBeGreaterThan(0)
})
