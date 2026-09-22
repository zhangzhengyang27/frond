import { test, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const ROOT = join(dirname(__filename), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

test('scratch', async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-scratch')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  const app = await electron.launch({ args: [MAIN_ENTRY], env })
  await new Promise((r) => setTimeout(r, 4000))
  let page = null
  for (const w of app.windows()) {
    if (/\/index\.html/.test(w.url())) page = w
  }
  if (!page) {
    console.log('[ERR] no main window')
    await app.close()
    return
  }
  const list = await page.evaluate(() => window.api.launcher.marketList())
  console.log('[MARKET LIST]', list.length, JSON.stringify(list.slice(0, 2).map((e) => e.id)))
  const info = await page.evaluate(() => window.api.launcher.marketIndexInfo())
  console.log('[INDEX INFO]', JSON.stringify(info))
  // 走引导：点「跳过引导」
  try {
    await page.getByText('跳过引导').first().click({ timeout: 4000 })
    await new Promise((r) => setTimeout(r, 1200))
  } catch (e) {
    console.log('[SKIP CLICK ERR]', String(e).slice(0, 100))
  }
  console.log('[HASH AFTER SKIP]', await page.evaluate(() => location.hash))
  await page.evaluate(() => {
    window.location.hash = '#/launcher'
  })
  await new Promise((r) => setTimeout(r, 1500))
  console.log('[HASH AFTER GOTO]', await page.evaluate(() => location.hash))
  console.log(
    '[TEXT]',
    (await page.evaluate(() => (document.body.innerText || '').slice(0, 200).replace(/\n+/g, ' | ')))
  )
  await app.close()
}, 90000)
