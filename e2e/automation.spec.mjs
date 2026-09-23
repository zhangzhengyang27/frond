/**
 * Frond · E2E：定时任务（P-4④ Automations）
 *
 * 这一格真跑的是「界面 → IPC → 引擎执行 → 结果回界面」这条链，
 * 判据刻意选在**没有副作用也能成立**的地方：
 *  - 非法 cron 在保存时就被拒，并把「第几条为什么」显示出来（不是存进去后悄悄不跑）
 *  - AI 未配置时点「立刻跑一次」，界面要拿回引擎给的明确失败原因，而不是静默无反应
 *  - 合法任务落库后重开界面还在（持久化到 pref）
 *
 * 调度本身（同一分钟只跑一次、跨小时、停用不跑、失败留原因）是纯函数 + 注入时钟测的，
 * 见 src/main/modules/automation/__tests__/automation.test.ts —— 那部分不该靠真时间验。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/automation.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const RUN = `auto${Date.now().toString(36)}`

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

/** 进设置 → 高级（定时任务与系统权限同区） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const openAdvanced = async (page) => {
  await expect(page.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await page.getByText('跳过引导').first().click()
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await page.getByRole('button', { name: '高级' }).first().click()
  await expect(page.getByText('定时任务', { exact: true })).toBeVisible({ timeout: 15000 })
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-automation')
  env.FROND_E2E = '1'
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 非法 cron 在保存时就被拒，并把原因显示出来', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await openAdvanced(page)

  await page.getByTestId('automation-json').fill(
    JSON.stringify(
      [
        { id: `${RUN}-ok`, label: '合法', cron: '30 9 * * *', action: { type: 'ai', prompt: '在做什么' } },
        { id: `${RUN}-bad`, label: '坏表达式', cron: '99 9 * * *', action: { type: 'ai', prompt: 'x' } }
      ],
      null,
      2
    )
  )
  await page.getByRole('button', { name: '保存并生效' }).click()
  const msg = page.getByTestId('automation-msg')
  await expect(msg).toContainText('拒绝 1 条', { timeout: 10000 })
  await expect(msg).toContainText('第 2 条')
  await expect(msg).toContainText('cron 不合法')

  await expect(page.locator('[data-testid="automation-row"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="automation-row"]').first()).toContainText('合法')
})

test('2. 点「立刻跑一次」拿回引擎的真实失败原因（AI 未配置）', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  const row = page.locator('[data-testid="automation-row"]').first()
  await row.getByRole('button', { name: '立刻跑一次' }).click()
  // 不是「按了没反应」：原因必须回到界面上
  await expect(page.getByTestId('automation-msg')).toContainText('AI 未启用', { timeout: 15000 })
})

test('3. 任务持久化：重开页面仍在，且开关能改 enabled', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await page.evaluate(() => {
    window.location.hash = '#/launcher'
  })
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await page.getByRole('button', { name: '高级' }).first().click()
  await expect(page.locator('[data-testid="automation-row"]')).toHaveCount(1, { timeout: 10000 })

  const sw = page.locator('[data-testid="automation-row"]').first().getByRole('switch')
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  const stored = await page.evaluate(() => window.api.ai.automationList())
  expect(stored[0]).toMatchObject({ enabled: false, cronValid: true })
})
