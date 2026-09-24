/**
 * Frond · E2E：文件索引启动期补偿（#9）
 *
 * 覆盖的缺口：FSEvents 只报「开始监听之后」的变更，进程停机期间的增删改名
 * 会永久留在索引外（旧行为：只能靠手动重建）。启动时按 dirs 目录水位补一趟。
 *
 * 真跑形态：同 userData 启动两次，中间在 scope 目录里加文件（此时 app 没在跑）。
 * 断言两路：fileIndex.status().files（纯 DB 计数，不受检索回退影响）+
 * fileSearch 响应的 source === 'index'（排除「其实是 mdfind 回退捞到的」这一混淆）。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const SCOPE_DIR = join(ROOT, 'test-results', 'file-index-catchup-scopes')
const USER_DATA = join(ROOT, 'test-results', 'e2e-userdata-file-index-catchup')

const RUN = `e2ecatch${Date.now().toString(36)}`
const isMac = process.platform === 'darwin'
// 同上：Windows 后端未实机验证
test.skip(!isMac, '文件索引 Windows 后端未实机验证')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
async function launch() {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = USER_DATA
  env.FROND_FILE_INDEX_SCOPES = SCOPE_DIR
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  env.FROND_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: [MAIN_ENTRY], env })

  // 按 url 匹配主窗口：title 匹配会连胶囊窗 "Frond Launcher" 一起命中。
  const main = await (async () => {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      for (const w of app.windows()) {
        try {
          if (/\/index\.html/.test(w.url())) return w
        } catch {
          /* 窗口尚未就绪 */
        }
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('30s 内没等到主窗口（out/renderer/index.html）')
  })()
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  return { app, main }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const indexStatus = (main) => main.evaluate(async () => await window.api.fileIndex.status())

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const indexFiles = async (main) => (await indexStatus(main)).files

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
async function waitReady(main) {
  await expect
    .poll(() => main.evaluate(async () => (await window.api.fileIndex.status()).status), {
      timeout: 30000,
      intervals: [500, 1000, 2000]
    })
    .toBe('ready')
}

test('停机期间的变更在重启后按目录水位回补', async () => {
  rmSync(SCOPE_DIR, { recursive: true, force: true })
  rmSync(USER_DATA, { recursive: true, force: true })
  mkdirSync(join(SCOPE_DIR, 'sub'), { recursive: true })
  writeFileSync(join(SCOPE_DIR, 'sub', `${RUN}-seed.md`), 'seed')

  // 第一趟：全量扫描建立水位
  let { app, main } = await launch()
  await waitReady(main)
  const baseline = await indexFiles(main)
  expect(baseline).toBeGreaterThan(0)
  await app.close()
  app = null

  // 「停机期间」：app 已退出、watcher 不存在，此时的变更 FSEvents 回溯不到
  const added = [`${RUN}-down1.md`, `${RUN}-down2.md`]
  for (const name of added) writeFileSync(join(SCOPE_DIR, 'sub', name), name)
  // 目录水位是**秒级** epoch（scanner dirEpoch 拍板：够用且跨平台一致）——上一趟扫描
  // 与新文件同秒就会被判「未变」。真实停机总以分钟计，但测试跑得快会撞上这一秒，
  // 这里显式把 mtime 拉开，避免把产品边界当成 flake
  const bumped = new Date(Date.now() + 5000)
  utimesSync(join(SCOPE_DIR, 'sub'), bumped, bumped)

  // 第二趟：DB 非空 → 不走全量，只靠启动期补偿把 2 个新文件收进索引
  ;({ app, main } = await launch())
  await waitReady(main)
  // 判别：lastFullScan 只在真跑过全量后置值（内存字段，重启即 null）——
  // 非 null 说明这趟走了全量扫描，那 files 增长就与补偿无关，测试是空的
  expect(await indexStatus(main)).toMatchObject({ lastFullScan: null })
  await expect
    .poll(() => indexFiles(main), { timeout: 30000, intervals: [500, 1000, 2000] })
    .toBeGreaterThanOrEqual(baseline + added.length)

  // 命中的来源必须是自建索引——否则可能是 mdfind 回退把它捞出来的，与补偿无关
  const resp = await main.evaluate(
    async (q) => await window.api.fileSearch.query(q, 20, { mode: 'name' }),
    `${RUN}-down1`
  )
  expect(resp.source).toBe('index')
  expect((resp.items ?? []).map((h) => h.name)).toContain(`${RUN}-down1.md`)
  await app.close()
  rmSync(SCOPE_DIR, { recursive: true, force: true })
  rmSync(USER_DATA, { recursive: true, force: true })
})
