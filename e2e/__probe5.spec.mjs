import { test, _electron as electron } from 'playwright/test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'
const ROOT = '/Users/xiaoye/Desktop/publish/frond'
test('probe market ui', async () => {
  const env = { ...process.env, FROND_E2E: '1', FROND_SKIP_BUILTIN_PLUGINS: '1' }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'probe5-userdata')
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  const app = await electron.launch({ args: [join(ROOT, 'out/main/index.js')], env })
  const win = await (async () => {
    for (let i = 0; i < 150; i++) {
      const w = app.windows().find((x) => /\/index\.html/.test(x.url()))
      if (w) return w
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('no main window')
  })()
  await win.getByText('跳过引导').first().click()
  await win.evaluate(async () => { await window.api.preferences.setOnboardingCompleted(); window.location.hash = '#/launcher' })
  await win.getByText('插件市场').first().waitFor({ timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1500))
  const sec = win.locator('section').filter({ has: win.getByText('插件市场', { exact: true }) })
  const txt = await sec.innerText().catch((e) => 'ERR ' + e.message)
  console.log('P5 section:', String(txt).replace(/\s+/g, ' ').slice(0, 400))
  const list = await win.evaluate(() => window.api.launcher.marketList())
  console.log('P5 api list:', list.length, JSON.stringify(list[0] ?? {}).slice(0, 200))
  await app.close()
})
