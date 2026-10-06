/**
 * Frond · E2E：胶囊片段页 B58 批C（轻路径 + 多块 + 粘贴接线）
 *
 * 与 snippets-ui-*.spec（主窗）互补，覆盖胶囊内 SnippetsPage：
 *   1. 轻路径索引：页面能加载（getIndex），空查询显示最近片段；内容全文匹配
 *      走 quickSearch（搜正文子串可命中——旧实现只有首块 80 字符预览可搜）
 *   2. 多块：详情块 chips 渲染，⌘→ 切块后 Enter 复制的是活动块（读真实剪贴板）
 *   3. 粘贴接线：pasteToForeground 对不存在 id 返回结构化错误
 *      （真实 ⌘V 注入会打进测试机前台应用，不在 e2e 驱动范围）
 *
 * 用法：先 npx electron-vite build，再 pnpm exec playwright test e2e/snippets-capsule-b58c.spec.mjs
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

/** 唤起胶囊并进入「搜片段」页（直接点击命令行，避免选中行排序抖动） */
const openSnippetsPage = async () => {
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('')
  await input.fill('搜片段')
  const row = capsule.locator('.launcher-result', { hasText: '搜片段' }).first()
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.click()
  await expect(capsule.locator('.snip-page')).toBeVisible({ timeout: 10000 })
  return { capsule, input }
}

test.beforeAll(async () => {
  const userData = join(ROOT, 'test-results', 'e2e-userdata-snippets-capsule')
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

const seedSnippet = async (name, blocks) =>
  main.evaluate(
    async ({ name, blocks }) => {
      return window.api.snippet.addSnippet({
        name,
        description: '',
        contents: blocks.map((value, i) => ({
          id: '',
          label: `块 ${i + 1}`,
          value,
          language: 'plaintext'
        })),
        tagIds: [],
        isDeleted: false,
        isFavorites: false,
        folderId: null
      })
    },
    { name, blocks }
  )

test('1. 内容全文可搜（quickSearch 下沉）+ 空查询展示最近片段', async () => {
  await seedSnippet('胶囊页-搜正文', ['UNIQUE-CAPSULE-BODY-7f3d', ''])
  await seedSnippet('胶囊页-普通', ['plain body'])
  const { capsule, input } = await openSnippetsPage()

  // 搜正文子串：旧实现列表副标题只有 80 字符首块预览，轻路径后靠 SQL search_text
  await input.fill('UNIQUE-CAPSULE-BODY-7f3d')
  await expect(capsule.locator('.snip-item', { hasText: '胶囊页-搜正文' }).first()).toBeVisible({
    timeout: 10000
  })

  // 清空查询 → 空查询回最近列表，多块片段带 ×N 徽标
  await input.fill('')
  await expect(capsule.locator('.snip-item', { hasText: '胶囊页-搜正文' }).first()).toBeVisible({
    timeout: 10000
  })
  await input.press('Escape')
})

test('2. 多块片段：⌘→ 切块，Enter 复制活动块（读真实剪贴板）', async () => {
  await seedSnippet('胶囊页-双块', ['CAPSULE-BLOCK-A', 'CAPSULE-BLOCK-B'])
  const { capsule, input } = await openSnippetsPage()

  await input.fill('胶囊页-双块')
  const row = capsule.locator('.snip-item', { hasText: '胶囊页-双块' }).first()
  await expect(row).toBeVisible({ timeout: 10000 })

  // 块 chips 渲染且默认第一块
  const chips = capsule.locator('[data-testid="snip-blocks"] .snip-block-chip')
  await expect(chips).toHaveCount(2, { timeout: 10000 })
  await expect(capsule.locator('[data-testid="snip-detail-code"]')).toContainText('CAPSULE-BLOCK-A')

  // ⌘→ 切到第二块，详情预览跟着切
  await input.press('Meta+ArrowRight')
  await expect(capsule.locator('[data-testid="snip-detail-code"]')).toContainText(
    'CAPSULE-BLOCK-B',
    { timeout: 5000 }
  )

  // Enter 复制活动块（真实剪贴板读回验证）
  await input.press('Enter')
  await expect
    .poll(async () => app.evaluate(({ clipboard }) => clipboard.readText()), {
      timeout: 10000
    })
    .toBe('CAPSULE-BLOCK-B')
})

test('3. pasteToForeground 接线：不存在 id 返回结构化错误（不注入）', async () => {
  const res = await main.evaluate(async () => window.api.snippet.pasteToForeground('no-such-id'))
  expect(res?.ok).toBe(false)
  expect(res?.error).toContain('not found')
})
