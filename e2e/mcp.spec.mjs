/**
 * Frond · E2E：MCP 客户端最小面（P-4②）
 *
 * 真跑：设置页保存配置 → 主进程 spawn 一个真的 node 子进程当 MCP 服务器 →
 * 握手 → 列工具 → 零参数工具点「调用」拿到文本结果。
 * 命令用 `process.execPath`（跑 Playwright 的那个 node 绝对路径），
 * 这样用例不依赖 GUI 进程的 PATH 能不能找到 `node`。
 *
 * 断言的是界面真话：非法工具条目要报「N 个已忽略」（静默少几个最难查），
 * 有必填参数的工具不给「调用」按钮（本期没有参数表单）。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/mcp.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const FIXTURE = join(ROOT, 'src/main/services/mcp/__tests__/fixtures/fixture-server.mjs')

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
const openAiSettings = async (page) => {
  await expect(page.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await page.getByText('跳过引导').first().click()
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  // AppIcon 的 <title> 会进可访问名，按名字定位不能用 exact
  await page.getByRole('button', { name: 'AI' }).first().click()
  await expect(page.getByText('MCP 服务器', { exact: true })).toBeVisible({ timeout: 15000 })
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-mcp')
  env.FROND_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 保存配置 → 连接真子进程 → 工具清单与「忽略数」一起显示', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await openAiSettings(page)

  const saved = await page.evaluate(
    async ([cmd, fixture]) =>
      await window.api.ai.mcpSetServers([
        { id: 'fixture', label: '夹具服务器', command: cmd, args: [fixture] }
      ]),
    [process.execPath, FIXTURE]
  )
  expect(saved.servers.map((s) => s.id)).toEqual(['fixture'])
  expect(saved.rejected).toEqual([])
  // 公开形态不许带 env 值
  expect(JSON.stringify(saved)).not.toContain('secret')

  // 配置是绕过后端写的，界面得重新读一次才会出现这一行（走用户能点的同一个按钮）
  await page.getByRole('button', { name: '重新读取' }).click()
  await expect(page.locator('[data-testid="mcp-server-row"]')).toHaveCount(1, {
    timeout: 15000
  })

  await page.getByRole('button', { name: '连接' }).first().click()
  const row = page.locator('[data-testid="mcp-server-row"]').first()
  await expect(row.getByText('已连接 · 2 个工具')).toBeVisible({ timeout: 20000 })
  await expect(row.getByText('3 个非法工具条目已忽略')).toBeVisible()
  await expect(row.getByText('fixture-mcp')).toHaveCount(0) // 服务器自报名只在消息里出现
  await expect(page.getByTestId('mcp-msg')).toContainText('2 个工具')
})

test('2. 零参数工具点「调用」拿到文本；有必填参数的不给按钮', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  const row = page.locator('[data-testid="mcp-server-row"]').first()
  await expect(row.getByText('已连接 · 2 个工具')).toBeVisible({ timeout: 20000 })

  const pingRow = row
    .locator('div')
    .filter({ hasText: /^ping_no_args/ })
    .first()
  await expect(pingRow.getByText('无必填参数')).toBeVisible()
  await pingRow.getByRole('button', { name: '调用' }).click()
  await expect(page.getByTestId('mcp-call-result').first()).toContainText('echo:-', {
    timeout: 20000
  })
  // 服务器回了一段 image：界面要如实说忽略了 1 段，而不是把文本当全部
  await expect(page.getByTestId('mcp-call-result').first()).toContainText('忽略了 1 段')

  // echo 有 msg 属性但没有 required → 也给调用（空参数由服务器自己兜底）
  await expect(row.getByText('需参数：')).toHaveCount(0)
})

test('3. 停止后回到未连接；非法配置带原因回来', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await page
    .locator('[data-testid="mcp-server-row"]')
    .first()
    .getByRole('button', { name: '停止' })
    .click()
  await expect(
    page.locator('[data-testid="mcp-server-row"]').first().getByText('未连接')
  ).toBeVisible({ timeout: 10000 })

  const bad = await page.evaluate(
    async ([cmd, fixture]) =>
      await window.api.ai.mcpSetServers([
        { id: 'fixture', command: cmd, args: [fixture] },
        { id: 'Bad ID', command: cmd },
        { id: 'shellish', command: `${cmd} ${fixture}` }
      ]),
    [process.execPath, FIXTURE]
  )
  expect(bad.servers.map((s) => s.id)).toEqual(['fixture'])
  expect(bad.rejected.map((r) => r.index)).toEqual([1, 2])

  await page.getByTestId('mcp-json').fill('[{"id": "Bad ID", "command": "node"}]')
  await page.getByRole('button', { name: '保存并生效' }).click()
  await expect(page.getByTestId('mcp-msg')).toContainText('拒绝 1 个', { timeout: 10000 })
  await expect(page.getByTestId('mcp-msg')).toContainText('id 非法')
})
