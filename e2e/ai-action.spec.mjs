/**
 * Frond · E2E：AI 进动作面板（P-4③）
 *
 * 断言的是「动作出现与否跟着真状态走」+「点了真会带着这条上下文去问」：
 *  - AI 未配置：面板里没有「问 AI」（摆一条按下去必失败的动作是噪音）
 *  - 配好本地端点后（面板打开会补读一次，生效在下次打开）：动作出现
 *  - 点它 → 进 AI 内联页，并把自己发出去的那句问题显示在消息列表里（不藏在系统提示后面）
 *
 * 端点是 127.0.0.1:9（discard，确定没人应答）：只要证明请求带着什么发出去了，
 * 不指望模型回话——AI 页随后会显示失败，那是预期的。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/ai-action.spec.mjs`
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
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

/**
 * 唤起胶囊并把查询词设为 term，等到目标行真的出现再返回。
 * 用「重填 + poll 计数」而不是「fill 后 assert 可见」：首启实例里结果要等
 * 别名/索引异步就绪，一次 fill 的时机太早会拿到空列表（capsule-search 就是这么写的）。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const searchInCapsule = async (main, term) => {
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await expect
    .poll(
      async () => {
        await input.fill('')
        await input.fill(term)
        await new Promise((r) => setTimeout(r, 150))
        return capsule.locator('.launcher-result', { hasText: term }).count()
      },
      { timeout: 20000 }
    )
    .toBeGreaterThan(0)
  return { capsule, input }
}

/** 当前高亮行的标题（回车/动作会作用在这一条上） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const selectedTitle = async (capsule) =>
  (
    (await capsule
      .locator('.launcher-result.selected .launcher-result-title')
      .first()
      .textContent()) ?? ''
  ).trim()

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-ai-action')
  env.FROND_E2E = '1'
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. AI 未配置时不出「问 AI」动作；配好后下一次打开就有', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  const { capsule } = await searchInCapsule(main, '录屏')
  const panel = capsule.locator('[data-testid=action-panel]')

  await capsule.locator('.launcher-search-input').press('Meta+k')
  await expect(panel).toBeVisible({ timeout: 5000 })
  // 判据只取面板自己报的标题：索引热起来的过程中结果会重排，
  // 拿「按 ⌘K 之前读到的那行」去等面板会造出一条与本用例无关的竞态断言
  const panelTitle = (await panel.locator('.launcher-actions-title').innerText()).trim()
  expect(panelTitle, '面板没报出条目标题').toBeTruthy()
  await expect(panel.getByText('问 AI：解释这条')).toHaveCount(0)

  // 真去配一个本地端点（enabled + baseUrl + model，本地免 key）
  await main.evaluate(async () => {
    await window.api.ai.setConfig({
      enabled: true,
      baseUrl: 'http://127.0.0.1:9/v1',
      model: 'probe-model',
      apiKey: ''
    })
  })
  // 面板打开时会补读一次 ai:isConfigured，生效在下一次打开——所以先用 ESC 确定地关掉再开
  await capsule.locator('.launcher-search-input').press('Escape')
  await expect(panel).toHaveCount(0, { timeout: 5000 })
  await expect(capsule.locator('.launcher-result').first()).toBeVisible({ timeout: 8000 })
  await capsule.locator('.launcher-search-input').press('Meta+k')
  await expect(panel.getByText('问 AI：解释这条')).toBeVisible({ timeout: 5000 })
})

test('2. 点「问 AI」带着这条结果去问，问题在消息列表里可见', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  // 自带前提：AI 配好（不依赖上一条用例留下的配置），并把可能残留的面板关掉
  await main.evaluate(async () => {
    await window.api.ai.setConfig({
      enabled: true,
      baseUrl: 'http://127.0.0.1:9/v1',
      model: 'probe-model',
      apiKey: ''
    })
    await window.api.launcher.closePlugin()
  })
  const { capsule } = await searchInCapsule(main, '录屏')
  const panel = capsule.locator('[data-testid=action-panel]')
  await expect(panel).toHaveCount(0)
  await capsule.locator('.launcher-search-input').press('Meta+k')
  await expect(panel).toBeVisible({ timeout: 5000 })
  // aiReady 是「面板打开后补读」，所以第一次打开可能还没有 AI 动作：关掉再开一次
  if ((await panel.getByText('问 AI：解释这条').count()) === 0) {
    await capsule.locator('.launcher-search-input').press('Escape')
    await expect(panel).toHaveCount(0)
    await capsule.locator('.launcher-search-input').press('Meta+k')
  }
  const panelTitle = (await panel.locator('.launcher-actions-title').innerText()).trim()
  const aiAction = panel.locator('.launcher-action').filter({ hasText: '问 AI：解释这条' })
  await expect(aiAction.first()).toBeVisible({ timeout: 5000 })
  await aiAction.first().click()

  // 进了 AI 内联页，且发出去的那句问题就在列表里（不是藏在系统提示里）
  await expect(capsule.locator('.ai-chat-page')).toBeVisible({ timeout: 8000 })
  const asked = (await capsule.locator('.ai-msg.user .ai-msg-content').first().innerText()).trim()
  // 问题里必须带着刚才那一条的标题：这才叫「对这条结果提问」，而不是凭空开了个对话
  expect(asked).toContain(panelTitle)
  expect(asked).toMatch(/解释|介绍|总结/)
})
