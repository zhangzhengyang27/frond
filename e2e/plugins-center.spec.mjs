/**
 * Frond · E2E：胶囊内嵌插件中心页（2026-10-06）
 *
 * 搜「插件中心」→ 回车进页 → 已装插件列表渲染（内置插件自动安装）→
 * 副输入框过滤 → ESC 返回。选择器沿用 capsule-actions 惯例
 * （.launcher-search-input / .launcher-result）。
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

test('搜「插件中心」→ 页面渲染已装插件列表 → 过滤', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  // 全局 config 跳过了内置插件自动安装：手动装两个作列表数据（base64 + 二维码）
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

  // 命令表就绪后「插件中心」命令行出现在搜索结果里
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

  // 页面渲染：内置插件自动安装（21 个），列表非空
  const list = capsule.locator('[data-testid="plugins-center-list"]')
  await expect
    .poll(async () => list.locator('.pc-item').count(), {
      timeout: 20000,
      intervals: [300]
    })
    .toBeGreaterThanOrEqual(1)

  // 过滤：胶囊搜索框接管为过滤输入，「二维码」只剩一行
  await input.fill('二维码')
  await expect
    .poll(async () => list.locator('.pc-item').count(), {
      timeout: 10000,
      intervals: [200]
    })
    .toBe(1)
  await expect(list.locator('.pc-item').first()).toContainText('二维码')
})
