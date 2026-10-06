/**
 * Frond · E2E：插件中心独立页（2026-10-06 重设计）
 *
 * 搜「插件中心」回车 → page action → 独立沉浸窗（url 含 /plugins-center）→
 * 列表渲染已装插件 → 搜索过滤 → USwitch 启停（徽章与统计联动）。
 * 选择器沿用 capsule-actions 惯例（.launcher-search-input / .launcher-result）。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
let app = null

test.beforeAll(async () => {
  rmSync(join(ROOT, 'test-results', 'e2e-userdata-plugins-center'), { recursive: true, force: true })
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-plugins-center')
  env.FROND_E2E = '1'
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) return w
      } catch {
        /* noop */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('30s 内没等到主窗口')
}

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

test('搜「插件中心」→ 独立窗口渲染列表 → 过滤 → 启停', async () => {
  test.setTimeout(90000)
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  // 全局 config 跳过内置插件自动安装：手动装两个作列表数据
  for (const dir of ['com.frond.base64', 'com.frond.qrcode']) {
    const r = await main.evaluate(
      (p) => window.api.launcher.installFromFolder(p),
      join(ROOT, 'plugins', dir)
    )
    expect(r.success).toBe(true)
  }
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')

  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('')
  await input.fill('插件中心')
  await expect
    .poll(async () => capsule.locator('.launcher-result').count(), {
      timeout: 15000,
      intervals: [300]
    })
    .toBeGreaterThanOrEqual(1)
  await expect(capsule.locator('.launcher-result').first()).toContainText('插件中心', {
    timeout: 15000
  })
  await input.press('Enter')

  // page action → 独立沉浸窗（url 含 /plugins-center）
  let page = null
  for (let i = 0; i < 50 && !page; i++) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('plugins-center')) page = w
      } catch {
        /* noop */
      }
    }
    if (!page) await new Promise((r) => setTimeout(r, 200))
  }
  expect(page).toBeTruthy()
  await page.waitForLoadState('domcontentloaded')

  // 列表渲染：两行 + 头部统计
  const list = page.locator('[data-testid="plugins-center-list"]')
  await expect
    .poll(async () => list.locator('.pc-item').count(), { timeout: 20000, intervals: [300] })
    .toBe(2)
  await expect(page.locator('.pc-title')).toContainText('插件中心')

  // 搜索过滤：「哈希」无命中 → 「Base64」剩一行
  await page.locator('input[placeholder*="搜索插件"]').fill('Base64')
  await expect
    .poll(async () => list.locator('.pc-item').count(), { timeout: 10000, intervals: [200] })
    .toBe(1)
  await expect(list.locator('.pc-item').first()).toContainText('Base64')
  await page.locator('input[placeholder*="搜索插件"]').fill('')

  // 启停：Base64 的开关切到停用 → 行上出现「已停用」徽章 → 统计联动（启用 1）
  const base64Row = list.locator('.pc-item').filter({ hasText: 'Base64' })
  await base64Row.locator('.pc-actions input[type="checkbox"], .pc-actions [role="switch"]').first().click()
  await expect(base64Row.locator('.pc-badge-off')).toHaveText('已停用', { timeout: 10000 })
  await expect(page.locator('.pc-sub')).toContainText('启用 1')
})
