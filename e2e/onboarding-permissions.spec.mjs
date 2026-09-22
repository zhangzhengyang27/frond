/**
 * Leaf · E2E：引导页的系统权限步骤（P-3.5）
 *
 * 断言的是「界面文字与主进程真状态同向」，不是「界面有没有画出来」：
 *  - 三行分别是辅助功能 / 日历 / 屏幕录制，且步序标签是 2 / 5（新插一步没把进度条与点号错位）
 *  - 每行显示的状态文案必须等于 permissions:probe() 对该 id 返回的状态
 *  - 屏幕录制没有可编程申请口 → 只给「打开设置」不给「申请」
 *
 * 不去点「申请 / 打开设置」：那两条的副作用是系统弹窗与打开系统设置面板，
 * 属于必须由人确认的界面行为，自动化跑它会污染开发机状态。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/onboarding-permissions.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

const STATE_TEXT = {
  granted: '已授权',
  denied: '未授权',
  'not-determined': '还没问过你',
  restricted: '被系统策略限制',
  unknown: '读不到状态',
  unsupported: '本系统不需要'
}

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

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-onboarding-perms')
  env.LEAF_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  // 全新 userData = 必然落在引导页第一步，这正是本用例要的前提
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 引导页第二步列出三项权限，文案与主进程真状态一致', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await expect(page.getByText('欢迎来到 Leaf')).toBeVisible({ timeout: 30000 })
  await page.getByText('下一步').click()

  const step2 = page.locator('section').filter({ has: page.getByText('给 Leaf 该有的系统权限') })
  await expect(step2).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('步骤 2 / 5')).toBeVisible({ timeout: 10000 })

  // 三行都渲染出来才算读完（日历那项要起 osascript 进程，偏慢）
  await expect(step2.locator('[data-perm-row="screenRecording"]')).toBeVisible({ timeout: 20000 })
  await expect(step2.locator('[data-perm-row="accessibility"]')).toBeVisible()
  await expect(step2.locator('[data-perm-row="calendar"]')).toBeVisible()

  const probed = await page.evaluate(() => window.api.permissions.probe())
  expect(probed.map((r) => r.id).sort()).toEqual(['accessibility', 'calendar', 'screenRecording'])
  for (const row of probed) {
    const text = STATE_TEXT[row.state]
    expect(text, `未知状态 ${row.state}`).toBeTruthy()
    // 这一行的 data 属性与显示文案必须是同一个状态（DOM 与主进程不许各说各话）
    const line = step2.locator(`[data-perm-row="${row.id}"]`)
    await expect(line).toHaveAttribute('data-perm-state', row.state)
    await expect(line.getByText(text, { exact: true })).toBeVisible()
  }
})

test('2. 屏幕录制不给「申请」（无编程申请口），未授权时仍给「打开设置」', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  const step2 = page.locator('section').filter({ has: page.getByText('给 Leaf 该有的系统权限') })
  const screenRow = step2.locator('[data-perm-row="screenRecording"]')
  const state = await screenRow.getAttribute('data-perm-state')

  // 无论什么状态都不许出现「申请」——Electron 没有屏幕录制的编程申请口
  await expect(screenRow.locator('[data-perm-action="request"]')).toHaveCount(0)
  if (state === 'granted') {
    // 本机（开发机）多半已授权：这时这一行不该留任何按钮
    await expect(screenRow.locator('button')).toHaveCount(0)
  } else {
    await expect(screenRow.locator('[data-perm-action="settings"]')).toBeVisible()
  }

  // 能就地申请的项在未授权时必须给「申请」按钮（读的是同一份 canRequest）
  const probed = await page.evaluate(() => window.api.permissions.probe())
  const askable = probed.find((r) => r.canRequest && r.state !== 'granted')
  if (askable) {
    await expect(
      step2.locator(`[data-perm-row="${askable.id}"]`).locator('[data-perm-action="request"]')
    ).toBeVisible()
  }
})

test('3. 设置 → 高级 有同一块面板：跳过引导后的补授权落点，挂上自动读', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  // 路由守卫只认 markOnboardingCompleted()（只有走完/跳过引导才会调），
  // 所以这条必须先结掉向导，再进设置页
  await page.getByText('跳过引导').first().click()
  await expect(page.getByText('跳过引导')).toHaveCount(0)
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  // 不按 exact 匹配：AppIcon 的 <title> 会进可访问名，整串是「图标名 + 高级」
  const advancedNav = page.getByRole('button', { name: '高级' })
  await expect(advancedNav.first()).toBeVisible({ timeout: 20000 })
  await advancedNav.first().click()
  await expect(page.getByText('系统权限', { exact: true })).toBeVisible({ timeout: 10000 })

  const probed = await page.evaluate(() => window.api.permissions.probe())
  for (const row of probed) {
    const line = page.locator(`[data-perm-row="${row.id}"]`)
    await expect(line).toBeVisible({ timeout: 20000 })
    await expect(line).toHaveAttribute('data-perm-state', row.state)
  }
})
