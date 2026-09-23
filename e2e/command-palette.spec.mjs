/**
 * Frond · E2E：主窗 ⌘K 面板与胶囊共用同一个命令源（P-7② 合一）
 *
 * 这一格要钉的不是「面板能打开」，而是**两个界面的行是同一批行**：
 * 合一之前主窗自己拼四份清单，胶囊走 Registry + 去重合并，
 * 结果面板看不到只在 provider 里的行（`ai:chat`「AI 对话」就是那条），
 * 而胶囊能看到——同一台机器上两个搜索框答案不一样，还没人去报错。
 *
 * 五条断言：
 *  1. 空查询那一屏仍是模块 / 系统页 / 动作那批行（重构没改首屏）；
 *  2. 一条命令只有一行（音量五档、显示桌面 —— 两份文案并存的直接后遗）；
 *  3. 面板能搜到 Registry 独有的行 `ai:chat`（**合一之前这条是红的**）；
 *  4. 列表里 `data-palette-key` 不出现重复 key（去重守卫在真界面上生效）；
 *  5. 回车真的执行了那一行——胶囊窗被唤起（行存在但点了没反应不算通过）。
 *
 * 用法：先 `npx electron-vite build`，再 `pnpm exec playwright test e2e/command-palette.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        const u = w.url()
        // 按 URL 认窗：主窗与胶囊窗的 title 都含 Frond，按 title 会认错（见项目记忆）
        if (/\/index\.html/.test(u) && !/launcher\.html/.test(u)) return w
      } catch {
        /* 尚未就绪 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `找不到主窗：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-command-palette')
  env.FROND_E2E = '1'
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 90000 })

test('⌘K 面板的行与胶囊同源：能搜到 Registry 独有的行，且没有重复 key', async () => {
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()

  await main.keyboard.press('Meta+k')
  const input = main.locator('[data-testid="command-palette"] input')
  await expect(input).toBeVisible({ timeout: 15000 })

  // ① 首屏还是那批静态行（模块 / 系统页 / 动作），徽标筛选与迁移前同源
  await expect
    .poll(async () => main.locator('[data-palette-key="module:launcher"]').count(), {
      timeout: 25000
    })
    .toBe(1)
  await expect(main.locator('[data-palette-key="page:settings"]')).toBeVisible()
  await expect(main.locator('[data-palette-key="firstparty:focus"]')).toBeVisible()

  // ② 一条命令一行：音量五档曾在界面上是十行（provider 写「音量设为 0%」、
  //    元数据表写「音量 0%」，标题不同 => 去重器捞不到）
  await input.fill('音量')
  await expect
    .poll(async () => main.locator('[data-palette-key]').count(), { timeout: 20000 })
    .toBeGreaterThan(0)
  const volumeKeys = await main
    .locator('[data-palette-key]')
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-palette-key')).filter((k) => /volume/.test(k ?? ''))
    )
  expect(volumeKeys.sort()).toEqual(
    [
      'system:volume0',
      'system:volume25',
      'system:volume50',
      'system:volume75',
      'system:volume100'
    ].sort()
  )
  // 「显示桌面」/「隐藏所有窗口」是同一条命令的两份文案留下的另一对（现在只剩显示桌面那一条）
  await input.fill('显示桌面')
  await expect
    .poll(async () => main.locator('[data-palette-key]').count(), { timeout: 20000 })
    .toBe(1)
  expect(await main.locator('[data-palette-key]').first().getAttribute('data-palette-key')).toBe(
    'system:showDesktop'
  )

  // ③ Registry 独有的行：合一之前面板拼的是旧的静态清单，这一条找不到
  await input.fill('AI 对')
  await expect
    .poll(async () => main.locator('[data-palette-key="ai:chat"]').count(), { timeout: 20000 })
    .toBe(1)

  // ④ 界面上不许出现同一个 key 两行（v-for 的 key 撞了 React/Vue 会直接错乱）
  const keys = await main
    .locator('[data-palette-key]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-key')))
  expect(keys.length).toBeGreaterThan(0)
  expect(new Set(keys).size).toBe(keys.length)

  // ⑤ 回车真的执行：firstParty 动作会把胶囊窗唤起来并打开对应页
  await main.keyboard.press('Enter')
  await expect
    .poll(
      async () =>
        app.windows().filter((w) => {
          try {
            return w.url().includes('launcher.html')
          } catch {
            return false
          }
        }).length,
      { timeout: 15000 }
    )
    .toBeGreaterThan(0)
})
