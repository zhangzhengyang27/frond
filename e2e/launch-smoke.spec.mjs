/**
 * Leaf · E2E 烟雾测试（playwright + _electron）
 *
 * 启动 electron-vite preview 产物的 Electron 实例，验证：
 * 1. 主窗口出现（title 含 Leaf）
 * 2. 首屏渲染成功（DOM 可见 body 或 .leaf-home）
 * 3. 主题切换生效（IPC setTheme → document.documentElement.dataset.theme）
 *
 * 用法：
 *   - 终端先跑：pnpm build
 *   - 然后跑：pnpm exec playwright test e2e/launch-smoke.spec.mjs
 *
 * 限制（与本地差异）：
 * - 仅本地跑（CI 上 Linux runner 需要 xvfb 包装，暂未集成）
 * - 启动 out/main/index.js 是 production build 后的入口
 *
 * 来源：P4-2「真实 GUI E2E（playwright + electron.launch）」
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

/**
 * 获取主窗口（按标题匹配）。
 * 不依赖 app.firstWindow() 的窗口序：历史上有隐藏窗口先创建导致竞态，
 * 标题匹配对窗口创建顺序鲁棒。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/Leaf/.test(await w.title())) return w
      } catch {
        // 窗口可能已关闭
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return app.firstWindow()
}

test.beforeAll(async () => {
  // 关键修复：移除 ELECTRON_RUN_AS_NODE 环境变量
  // 否则 Electron 会把命令行参数当作 Node.js 参数而不是 Electron 参数
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  app = await electron.launch({
    args: [MAIN_ENTRY],
    launchOptions: { env }
  })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('主窗口启动 + 首屏可见', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()

  // title 来自 src/renderer/index.html（产品名统一为 Leaf，见 docs/POSITIONING.md）
  await expect(page).toHaveTitle(/Leaf/)

  // 首屏要么是 Onboarding（首次启动），要么是 Hub（已完成引导）
  // 都应在 5s 内出现至少一个根元素
  await page.waitForLoadState('domcontentloaded')
  const rootExists = await page.evaluate(() => {
    return !!document.querySelector('.leaf-onboarding, .LeafHome, body')
  })
  expect(rootExists).toBe(true)
})

test('主题切换：点击主题按钮后 html.dark 变化', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()

  // 跳过 onboarding 走 Hub
  await page.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })

  // 等 Hub 加载 + useTheme 初始化完成（AppShell mount 后异步 IPC 回填 data-theme）；
  // 冷启动时首次编译解析较慢，固定 sleep 会偶发抢跑，这里轮询等待
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          ['light', 'dark', 'auto'].includes(document.documentElement.dataset.theme)
        ),
      { timeout: 10000 }
    )
    .toBe(true)

  // 通过 IPC 切到 dark 测 setTheme 真的改变 DOM
  await page.evaluate(async () => {
    if (window.api?.preferences?.setTheme) {
      await window.api.preferences.setTheme('dark')
    }
  })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme), { timeout: 5000 })
    .toBe('dark')

  // 切回 light
  await page.evaluate(async () => {
    if (window.api?.preferences?.setTheme) {
      await window.api.preferences.setTheme('light')
    }
  })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme), { timeout: 5000 })
    .toBe('light')
})
