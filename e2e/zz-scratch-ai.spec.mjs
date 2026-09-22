import { test, _electron as electron } from 'playwright/test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

test('scratch ai byom', async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'zephyr-7b' }, { id: 'alpha-4b' }] }))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`

  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-scratch-ai')
  env.LEAF_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  const app = await electron.launch({ args: [join(ROOT, 'out/main/index.js')], env })
  let page = null
  for (let i = 0; i < 60 && !page; i++) {
    await new Promise((r) => setTimeout(r, 200))
    page = app.windows().find((w) => /\/index\.html/.test(w.url())) ?? null
  }
  if (!page) {
    console.log('[ERR] no window')
    server.close()
    return
  }
  page.on('console', (m) => console.log('[RENDERER]', m.type(), m.text().slice(0, 200)))
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 300)))

  await page.getByText('跳过引导').first().click()
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await page.getByRole('button', { name: 'AI' }).first().click()
  await new Promise((r) => setTimeout(r, 800))

  const setRes = await page.evaluate(
    async (url) => await window.api.ai.setConfig({ enabled: true, baseUrl: url, model: 'm', apiKey: '' }),
    `${origin}/v1`
  )
  console.log('[SET]', JSON.stringify(setRes).slice(0, 200))
  const list = await page.evaluate(async () => await window.api.ai.listModels())
  console.log('[LISTMODELS]', JSON.stringify(list))

  await page.getByRole('button', { name: '探测端点' }).click()
  await new Promise((r) => setTimeout(r, 3000))
  const msg = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ai-probe-msg"]')
    return el ? el.textContent : '[no element]'
  })
  console.log('[MSG]', msg)
  console.log(
    '[HAS BUTTON]',
    await page.getByRole('button', { name: '探测端点' }).count(),
    '[TESTID COUNT]',
    await page.locator('[data-testid=ai-probe-msg]').count()
  )
  await app.close()
  server.close()
}, 120000)
