/**
 * Leaf · E2E：BYOM 多 provider（P-4①）
 *
 * 真起一个本机 http 服务当「本地模型端点」，走完 UI → IPC → 端点守卫 → fetch → 解析 → 回填：
 *  - 点 provider 芯片要把 Base URL / 模型填对（Ollama 那条要带 ../api/tags 能回退的形态）
 *  - 「探测端点」成功后模型清单要真的变成可点的芯片，点一下回填模型名
 *  - 连不上时必须说实话（含「本地端点没起来？」这类可执行的提示），不能显示 0 个模型当成功
 *
 * 允许回环 http 是这一格的刻意设计（Ollama / LM Studio 场景），
 * 与「插件 fetch 全内网封锁」「市场远程索引 https-only」是两套策略，别互相套用。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/ai-byom.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null
let server = null
let origin = ''

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

test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    if ((req.url ?? '') === '/v1/models') {
      res.end(JSON.stringify({ data: [{ id: 'zephyr-7b' }, { id: 'alpha-4b' }] }))
    } else {
      res.end(JSON.stringify({ data: [] }))
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`

  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-ai-byom')
  env.LEAF_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
  if (server) server.close()
})

test('1. 进入设置 → AI，provider 芯片把表填对', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  await expect(page.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await page.getByText('跳过引导').first().click()
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  // AppIcon 的 <title> 会进可访问名，所以按名字定位不能用 exact
  await page.getByRole('button', { name: 'AI' }).first().click()

  const baseUrlInput = page.getByPlaceholder('https://api.openai.com/v1')
  const modelInput = page.getByPlaceholder('gpt-4o-mini')
  await expect(baseUrlInput).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'OpenRouter' }).click()
  await expect(baseUrlInput).toHaveValue('https://openrouter.ai/api/v1')
  await expect(modelInput).toHaveValue('openai/gpt-4o-mini')

  await page.getByRole('button', { name: 'Ollama（本地）' }).click()
  await expect(baseUrlInput).toHaveValue('http://127.0.0.1:11434/v1')
  await expect(page.getByText('本地端点不需要 API Key')).toBeVisible()
})

test('2. 探测本机端点：模型清单回来并可点选回填', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  const baseUrlInput = page.getByPlaceholder('https://api.openai.com/v1')
  await baseUrlInput.fill(`${origin}/v1`)
  await page.getByRole('button', { name: '探测端点' }).click()

  await expect(page.getByTestId('ai-probe-msg')).toContainText('连上了，2 个模型', {
    timeout: 20000
  })
  // 清单按字典序给出，点一个就把模型名回填进输入框
  await expect(page.getByRole('button', { name: 'alpha-4b', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'alpha-4b', exact: true }).click()
  await expect(page.getByPlaceholder('gpt-4o-mini')).toHaveValue('alpha-4b')
})

test('3. 连不上要说实话，不能拿空清单当成功', async () => {
  if (!app) throw new Error('app not launched')
  const page = await getMainWindow()
  // 一个确定没人监听的端口（本用例的 server 端口 +1，close 之后同理）
  await page.getByPlaceholder('https://api.openai.com/v1').fill('http://127.0.0.1:1/v1')
  await page.getByRole('button', { name: '探测端点' }).click()
  const msg = page.getByTestId('ai-probe-msg')
  await expect(msg).toContainText('连不上', { timeout: 20000 })
  await expect(msg).toContainText('本地端点没起来')
  await expect(page.getByRole('button', { name: 'alpha-4b', exact: true })).toHaveCount(0)
})
