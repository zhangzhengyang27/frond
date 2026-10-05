/**
 * Frond · E2E：插件 showHud 轻提示全链路（2026-10-05 spec 3.3）
 *
 * 导入 example-react → 打开 mode:'action' 的 hud 命令 → 插件调 SDK showHud →
 * plugapi:hud（主进程计数 +e2e 探针）→ launcher:plugin-hud 推送 → 胶囊 PluginHud
 * 组件渲染 .plugin-hud（1.5s 自动淡出，断言窗口内轮询）。
 *
 * 用法：先 pnpm build（global-setup 会重建 SDK/example-react 插件产物）。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

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

test.beforeAll(async () => {
  rmSync(join(ROOT, 'test-results', 'e2e-userdata-plugin-hud'), {
    recursive: true,
    force: true
  })
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-plugin-hud')
  env.FROND_E2E = '1' // 插件导入确认闸旁路（Playwright 无法点原生对话框）+ e2e 探针启用
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('showHud 全链路：通道计数 + 胶囊 HUD 渲染', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')

  // 跳过 onboarding
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })

  // 导入 react 示例插件（幂等，与 react-view.spec 同一导入 API）
  const install = await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )
  expect(install.success).toBe(true)

  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')
  const before =
    (await capsule.evaluate(() => window.api.e2e.probeCounts()))['plugapi:hud'] ?? 0

  // 触发 mode:'action' 的 hud 命令：插件调 SDK showHud → 主进程 → 胶囊 HUD
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react', 'hud'))

  // 通道断言（硬）：plugapi:hud 到达主进程
  await expect
    .poll(
      async () =>
        ((await capsule.evaluate(() => window.api.e2e.probeCounts()))['plugapi:hud'] ?? 0) - before,
      { timeout: 10_000, intervals: [200, 400] }
    )
    .toBeGreaterThanOrEqual(1)

  // 渲染断言（窗口轮询）：HUD 在 1.5s 生命周期内出现
  await expect
    .poll(async () => capsule.locator('.plugin-hud').count(), {
      timeout: 3_000,
      intervals: [60]
    })
    .toBeGreaterThanOrEqual(1)
  const text = await capsule.locator('.plugin-hud').first().textContent()
  expect(text ?? '').toContain('HUD 探针')
})
