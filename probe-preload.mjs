import { _electron as electron } from 'playwright'
import { join } from 'node:path'

const ROOT = '/Users/xiaoye/Desktop/electron-tools'
const app = await electron.launch({
  args: [join(ROOT, 'out/main/index.js')],
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '',
    LEAF_USER_DATA_DIR: join(ROOT, 'test-results', 'probe-userdata')
  }
})
const ctx = app.context()
ctx.on('page', (p) => {
  p.on('console', (m) => console.log('[c]', p.url().slice(-28), m.type(), m.text().slice(0, 400)))
  p.on('pageerror', (e) => console.log('[e]', p.url().slice(-28), String(e).slice(0, 600)))
})
await new Promise((r) => setTimeout(r, 6000))
for (const p of ctx.pages()) {
  const info = await p
    .evaluate(() => ({ t: document.title, api: typeof window.api }))
    .catch((e) => ({ err: String(e).slice(0, 80) }))
  console.log('PAGE', p.url().slice(-40), JSON.stringify(info))
}
await app.close()
