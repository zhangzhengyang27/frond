/**
 * Frond · E2E：重型模块独立小窗（B59b）
 *
 * 用户反馈「片段/番茄钟/录屏窗口太大」——此前这些模块开独立窗吃
 * createWindow 的 1450×950 全局默认。B59b 起按 HEAVY_MODULE_WINDOW_SIZES
 * 取紧凑尺寸，且 launcher:openModule（片段页 ⌘↵ / 动作面板入口）不再挤主窗。
 *
 * 断言（全部落在真实窗口属性上）：
 *   1. create-new-window 开 /snippets → 新窗尺寸 ≈ 1040×660（非 1450×950）
 *   2. launcher:openModule(snippets) → 独立窗（≠主窗），尺寸同上
 *   3. 独立窗加载的是 /snippets 路由（?immersive=1）
 *
 * 用法：先 npx electron-vite build，再 pnpm exec playwright test e2e/heavy-module-window.spec.mjs
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null
let main = null

const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url()) && !/launcher\.html/.test(w.url())) return w
      } catch {
        // 尚未就绪
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('找不到主窗')
}

test.beforeAll(async () => {
  const userData = join(ROOT, 'test-results', 'e2e-userdata-heavy-window')
  rmSync(userData, { recursive: true, force: true })
  const env = { ...process.env, FROND_USER_DATA_DIR: userData }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })

  main = await getMainWindow()
  await main.getByText('跳过引导').first().click({ timeout: 30000 })
  await main.evaluate(async () => {
    await window.api.preferences.setOnboardingCompleted()
  })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

/** 找 /snippets 路由的独立窗（主窗是 /settings 或空 hash） */
const findSnippetWindow = async () => {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html#\/snippets/.test(w.url())) return w
      } catch {
        /* 窗口可能已关 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

test('1. create-new-window 开片段 → 紧凑尺寸独立窗（非 1450×950）', async () => {
  await main.evaluate(async () => {
    await window.api.createNewWindow('/snippets?immersive=1')
  })
  const win = await findSnippetWindow()
  expect(win).toBeTruthy()
  if (!win) return

  const bounds = await win.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    route: window.location.hash
  }))
  // 视口 ≤ 窗口外框，留出余量断言紧凑（1450×950 的视口必然 >1200×750）
  expect(
    bounds.w,
    `视口宽 ${bounds.w} 超过紧凑窗预期（B59b 尺寸表 1040×660）`
  ).toBeLessThanOrEqual(1200)
  expect(bounds.h, `视口高 ${bounds.h} 超过紧凑窗预期`).toBeLessThanOrEqual(750)
  expect(bounds.route).toContain('/snippets')
  await win.close()
})

test('2. launcher:openModule(snippets) → 独立小窗（≠主窗），主窗不被挤占', async () => {
  const mainBefore = main.url()
  await main.evaluate(async () => {
    // 直接走主进程通道（胶囊片段页 ⌘↵ / 动作面板同款）
    await window.api.launcher.openModule('snippets', '/snippets')
  })
  const win = await findSnippetWindow()
  expect(win, 'launcher:openModule 应开出 /snippets 独立窗').toBeTruthy()
  if (!win) return

  // 独立窗不是主窗
  expect(win !== main).toBe(true)

  // 主窗没有被导航到 /snippets（B59b 前会被挤占路由）
  expect(main.url()).toBe(mainBefore)

  const bounds = await win.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight
  }))
  expect(bounds.w).toBeLessThanOrEqual(1200)
  expect(bounds.h).toBeLessThanOrEqual(750)
  await win.close()
})
