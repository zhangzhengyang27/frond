/**
 * Frond · E2E：设置页跟随主题（P-6 观感）
 *
 * 设置页原本把颜色写死成 Apple 亮色档（bg-white / text-[#1d1d1f] / ring-black/[0.06]…），
 * 于是深色主题下**整页仍然是白的**——这一格不是审美问题，是「换主题没换全」。
 * 现在它走与胶囊同一套 token，所以这条用例断言的是同一个元素在两个主题下
 * 计算样式真的变了（改回写死的颜色，这条立刻红）。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/settings-theme.spec.mjs`
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

/** 设置页里一张卡片 + 一个标题：both 都取 token 化的元素 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const readTokens = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('main .bg-surface-1')
    const head = document.querySelector('main h1.text-fg-primary')
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
    const cs = (el) => (el ? getComputedStyle(el).backgroundColor : 'none')
    return {
      card: cs(card),
      head: head ? getComputedStyle(head).color : 'none',
      htmlDark: document.documentElement.classList.contains('dark')
    }
  })

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-settings-theme')
  env.FROND_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 深色主题下设置页跟着变暗（原本整页留白）', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await expect(page.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await page.getByText('跳过引导').first().click()
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15000 })

  await page.evaluate(() => window.api.preferences.setTheme('light'))
  await expect
    .poll(async () => (await readTokens(page)).htmlDark, { timeout: 10000 })
    .toBe(false)
  const light = await readTokens(page)
  expect(light.card).not.toBe('none')
  expect(light.head).not.toBe('none')

  await page.evaluate(() => window.api.preferences.setTheme('dark'))
  // 主题切换有 320ms 的 CSS 过渡（useTheme 刻意加的），过渡期间取计算样式会拿到
  // 还没走完的中间值——所以要 poll 到「真的变了」，而不是切完立刻读
  const dark = await (async () => {
    let snap = light
    await expect
      .poll(
        async () => {
          snap = await readTokens(page)
          return snap.card !== light.card && snap.head !== light.head
        },
        { timeout: 10000 }
      )
      .toBe(true)
    return snap
  })()
  expect(dark.htmlDark).toBe(true)
  // 深色档下卡片必须是暗面（写死 bg-white 的话这条永远是 #fff，会红）
  expect(dark.card).not.toBe('rgb(255, 255, 255)')
})

test('2. 设置页里不再有写死的亮色文字档', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  const leftovers = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return ['<没有 main>']
    const bad = []
    main.querySelectorAll('*').forEach((el) => {
      el.classList.forEach((c) => {
        if (/^(text|bg|ring|border|divide)-\[#/.test(c)) bad.push(c)
      })
    })
    return [...new Set(bad)]
  })
  // 只允许还没有对应 token 的语义色（Apple 橙/紫一类），亮色档必须清零
  const offenders = leftovers.filter((c) => !/ff9500|af52de|d70015/.test(c))
  expect(offenders, `这些类还是写死的亮色：${offenders.join(', ')}`).toEqual([])
})
