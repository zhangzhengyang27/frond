import { test, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

test('scratch settings', async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-scratch2')
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
    return
  }
  await page.getByText('跳过引导').first().click()
  await new Promise((r) => setTimeout(r, 1500))
  console.log('[HASH AFTER SKIP]', await page.evaluate(() => location.hash))
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await new Promise((r) => setTimeout(r, 2000))
  console.log('[HASH AFTER GOTO]', await page.evaluate(() => location.hash))
  const info = await page.evaluate(() => ({
    buttons: Array.from(document.querySelectorAll('nav button')).map(
      (b) => '[' + (b.textContent || '').trim() + ']'
    ),
    text: (document.body.innerText || '').slice(0, 260).replace(/\n+/g, ' | ')
  }))
  console.log('[NAV BUTTONS]', JSON.stringify(info.buttons))
  console.log('[TEXT]', info.text)
  await app.close()
}, 90000)
