/**
 * Leaf · E2E：插件市场远程索引（P-3.1）+ 校验和诚实标（P-3.3）
 *
 * 走的是真 IPC 往返（渲染端 → 主进程 → SQLite 偏好 → 回读），不是把纯函数再测一遍：
 *  - 明文 http 地址必须被**主进程**拒掉，且配置里落不下（前端拦一道不算数）
 *  - 合法 https 地址能存进配置；拉取失败时**打包索引条目不能被清空**（旧缓存/旧列表保留）
 *  - 打包索引条目按真话标「未校验」（内置插件走本地目录形态，给不出包体哈希）
 *
 * 用法：先 `pnpm build`（改过 SDK / 插件要先重建），再
 * `pnpm exec playwright test e2e/market-index.spec.mjs`
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

/** 主窗口（管理页所在） */
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
const indexInput = (page) =>
  page.getByPlaceholder('远程索引 https://…/plugins.json（留空 = 只用打包索引）')

/** 市场 section：页面上有别的「保存」按钮，按钮必须按在这个块里找 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const marketSection = (page) =>
  page.locator('section').filter({ has: page.getByText('插件市场', { exact: true }) })

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-market-index')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 进入启动器管理页，市场区块与远程索引输入框在位', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  // 独立 userData 每次都是首启实例：先等引导页真的渲染出来再点跳过。
  // （更早的写法在应用启动完成前就改 hash，改完立刻被启动时的重定向覆盖，
  // 表现是「插件市场」找不到——不是界面没有，是根本没走到那一屏）
  await expect(page.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await page.getByText('跳过引导').first().click()
  await page.evaluate(async () => {
    await window.api.preferences.setOnboardingCompleted()
    window.location.hash = '#/launcher'
  })
  await expect(page.getByText('插件市场').first()).toBeVisible({ timeout: 20000 })
  await expect(indexInput(page)).toBeVisible({ timeout: 20000 })
})

test('2. 打包索引条目如实标「未校验」（内置插件是本地目录形态，没有包体哈希）', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  const list = await page.evaluate(() => window.api.launcher.marketList())
  expect(list.length).toBeGreaterThan(0)
  // 界面文案与数据必须同向：有 sha256 才标「sha256 校验」，否则标「未校验」
  const labelled = list.some((e) => !!e.sha256)
  await expect(page.getByText(labelled ? 'sha256 校验' : '未校验').first()).toBeVisible()
})

test('3. 明文 http 索引地址被主进程拒绝，配置里落不下', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await indexInput(page).fill('http://mirror.example.com/plugins.json')
  await marketSection(page).getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('只支持 https 索引地址').first()).toBeVisible({ timeout: 10000 })
  // 关键判据：拒的是主进程侧的持久化，不只是界面提示
  const saved = await page.evaluate(() => window.api.launcher.marketIndexInfo())
  expect(saved.remoteUrl).toBe('')
})

test('4. 合法 https 地址可保存；拉取失败不清空打包索引', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  const url = 'https://leaf-e2e-nonexistent.invalid/plugins.json'
  await indexInput(page).fill(url)
  await marketSection(page).getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('已保存远程索引地址').first()).toBeVisible({ timeout: 10000 })
  const saved = await page.evaluate(() => window.api.launcher.marketIndexInfo())
  expect(saved.remoteUrl).toBe(url)

  const before = await page.evaluate(() => window.api.launcher.marketList())
  expect(before.length).toBeGreaterThan(0)

  await marketSection(page).getByRole('button', { name: '拉取' }).click()
  await expect(page.getByText('拉取失败').first()).toBeVisible({ timeout: 40000 })
  const after = await page.evaluate(() => window.api.launcher.marketList())
  // 拉取失败绝不能把已有市场清空：条目集合必须一模一样
  expect(after.map((e) => e.id)).toEqual(before.map((e) => e.id))
  const info = await page.evaluate(() => window.api.launcher.marketIndexInfo())
  expect(info.remoteCount).toBe(0)
  expect(info.remoteFetchedAt).toBeNull()
}, 60000)

test('5. 清空地址后回到「只有打包索引」', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await indexInput(page).fill('')
  await marketSection(page).getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('已清除远程索引').first()).toBeVisible({ timeout: 10000 })
  const info = await page.evaluate(() => window.api.launcher.marketIndexInfo())
  expect(info.remoteUrl).toBe('')
  await expect(page.getByText('索引：打包 plugins.json')).toBeVisible({ timeout: 10000 })
})
