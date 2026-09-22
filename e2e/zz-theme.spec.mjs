import { test, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

test('scratch theme vars', async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-scratch-theme')
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
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await new Promise((r) => setTimeout(r, 800))
  const dump = async (tag) =>
    console.log(
      tag,
      JSON.stringify(
        await page.evaluate(() => {
          const el = document.querySelector('main .bg-surface-1')
          return {
            cls: document.documentElement.className,
            dataset: JSON.stringify(document.documentElement.dataset),
            varSurface1: getComputedStyle(document.documentElement).getPropertyValue('--surface-1'),
            elBg: el ? getComputedStyle(el).backgroundColor : 'no-el',
            elClass: el ? el.className.slice(0, 80) : '',
            sheets: Array.from(document.styleSheets).length
          }
        })
      )
    )
  await dump('[LIGHT]')
  await page.evaluate(() => window.api.preferences.setTheme('dark'))
  await new Promise((r) => setTimeout(r, 900))
  await dump('[DARK] ')
  await app.close()
}, 90000)
