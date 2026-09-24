/**
 * Frond · E2E：多参数命令全链路（P-2.7 dogfood + P-1.6 的参数预填）
 *
 * 链路：搜索「正则测试 \d+」→ 前缀命中参数化命令 → pluginarg 表单
 *      → 第一格已由查询尾部预填（argPrefill）→ 补测试文本 → ⌘↵
 *      → 插件 onEnter 收到 args → 渲染匹配结果。
 *
 * 为什么用 com.frond.regex：它是全仓第一个真声明 arguments 的内置插件
 * （此前 21 个零个用到，「多参数命令」这条能力一直没被 dogfood 过），
 * 而且它的 dropdown 参数能顺带验证「展示 title → 提交 value」的还原。
 *
 * 用法：先 pnpm build，再 pnpm exec playwright test e2e/plugin-args.spec.mjs
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const PLUGIN_DIR = join(ROOT, 'plugins', 'com.frond.regex')

let app = null

// 按 url 匹配主窗口（title 匹配会连胶囊窗 "Frond Launcher" 一起命中，见
// getCapsuleWindow 走的是 launcher.html）。
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
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
  throw new Error('30s 内没等到主窗口（out/renderer/index.html）')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
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
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-plugin-args')
  env.FROND_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  const install = await main.evaluate(
    (dir) => window.api.launcher.installFromFolder(dir),
    PLUGIN_DIR
  )
  expect(install.success).toBe(true)
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('带参数的查询能选中命令，表单首格预填、提交后参数真到插件', async () => {
  const main = await getMainWindow()
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')

  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('')
  // 「命令 + 尾部参数」：旧搜索规则下这条整条选不中标题，前缀命中才让它可选
  await input.fill('正则测试 \\d+')
  const topRow = capsule.locator('.launcher-result').first()
  await expect(topRow).toContainText('正则测试', { timeout: 15000 })

  await input.press('Enter')

  // 参数表单出现，第一格 = 查询里标题之外的部分（argPrefill 的真链路）
  const patternField = capsule.locator('#ff-0')
  await expect(patternField).toBeVisible({ timeout: 15000 })
  await expect(patternField).toHaveValue('\\d+')
  // dropdown 字段展示的是 title（value 提交时才还原）
  await expect(capsule.locator('.form-select option').first()).toContainText('g（全局）')

  await capsule.locator('#ff-1').fill('a1 b22 c333')
  await capsule.locator('#ff-1').press('Meta+Enter')

  // 参数真的进了插件 onEnter.args：结果由参数决定（3 个数字匹配），而不是剪贴板流程
  await expect(capsule.locator('.plist-item', { hasText: '匹配 3 处' }).first()).toBeVisible({
    timeout: 20000
  })
  // 正则与标志位也按声明传到位（flags dropdown 的 value 'g' 被还原）
  await expect(capsule.locator('.plist-item').first()).toContainText('/\\d+/g')
})

test('长尾查询靠前缀命中选中命令（拼写容错捞不动的那一段）', async () => {
  const main = await getMainWindow()
  // 上一条用例把插件界面留着了：先关干净，否则搜索框是插件副输入框
  await expect
    .poll(
      async () => {
        await main.evaluate(() => window.api.launcher.closePlugin())
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st?.open
      },
      { timeout: 10000, intervals: [500, 1000] }
    )
    .toBe(false)

  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  await capsule.waitForLoadState('domcontentloaded')
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('')
  // 尾部 12 个字符与标题差得超出容错预算（≤5 字容 1 错、6+ 字容 2 错），
  // 因此这条只能由「标题是查询前缀」命中——把前缀规则关掉，本用例必须转红
  const tail = 'zzzzqqqqwwww'
  await input.fill(`正则测试 ${tail}`)
  const topRow = capsule.locator('.launcher-result').first()
  await expect(topRow).toContainText('正则测试', { timeout: 15000 })

  await input.press('Enter')
  await expect(capsule.locator('#ff-0')).toHaveValue(tail, { timeout: 15000 })
})
