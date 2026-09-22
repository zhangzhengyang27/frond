/**
 * Leaf · E2E：文件自建索引链路（#9，M1 仅 macOS）
 *
 * 前置（playwright.config）：LEAF_FILE_INDEX_SCOPES 指向 test-results/file-index-scopes，
 * app 启动时对该目录做初始扫描 → FSEvents 增量。
 * 验收链路（设计文档 §6）：播种 → 名称/骨架词/内容命中 → 改名增量 → 排除目录不可见。
 *
 * 用法：先 pnpm build；Windows 上 skip（M1 仅 macOS）。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const SCOPE_DIR = join(ROOT, 'test-results', 'file-index-scopes')

const RUN = `e2e${Date.now().toString(36)}`
const UNIQUE = `e2e-index-${RUN}`
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const DOC_PATH = () => join(SCOPE_DIR, `${UNIQUE}.md`)

let app = null

const isMac = process.platform === 'darwin'
test.skip(!isMac, '文件索引 M1 仅 macOS')

test.beforeAll(async () => {
  // 播种要在 app 启动扫描之前完成
  rmSync(SCOPE_DIR, { recursive: true, force: true })
  mkdirSync(SCOPE_DIR, { recursive: true })
  mkdirSync(join(SCOPE_DIR, 'node_modules'), { recursive: true })
  writeFileSync(DOC_PATH(), `# 标题\n独特正文内容 ${RUN}\n`)
  writeFileSync(join(SCOPE_DIR, 'node_modules', 'x.js'), 'const x = 1')

  const env = { ...process.env }
env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-file-index')
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
  rmSync(SCOPE_DIR, { recursive: true, force: true })
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/Leaf/.test(await w.title())) return w
      } catch {
        /* noop */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return app.firstWindow()
}

/** 轮询索引就绪（初始全量完成后 status = ready） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
async function waitIndexReady(page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const s = await window.api.fileIndex.status()
          return s.status
        }),
      { timeout: 30000, intervals: [500, 1000, 2000] }
    )
    .toBe('ready')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const query = (page, q, mode = 'name') =>
  page.evaluate(
    async ({ q, mode }) => {
      const resp = await window.api.fileSearch.query(q, 20, { mode })
      return resp.items ?? []
    },
    { q, mode }
  )

test('索引链路：播种命中 → 内容命中 → 排除不可见 → 改名增量', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await waitIndexReady(main)

  // 1. 名称命中
  const byName = await query(main, UNIQUE)
  expect(byName.map((i) => i.name)).toContain(`${UNIQUE}.md`)

  // 2. 骨架词命中：UNIQUE 形如 e2e-index-abc123，用首字母段前缀 e2ei 搜
  const bySkeleton = await query(main, 'e2ei')
  expect(byName.length).toBeGreaterThan(0)
  expect(bySkeleton.length).toBeGreaterThan(0)

  // 3. 内容命中（v1 含内容搜索）
  const byContent = await query(main, `独特正文内容 ${RUN}`, 'content')
  expect(byContent.map((i) => i.name)).toContain(`${UNIQUE}.md`)

  // 4. 排除目录不可见（node_modules 剪枝）
  const excluded = await query(main, 'x.js')
  expect(excluded).toEqual([])

  // 5. 改名 → FSEvents 增量 → 旧名消失、新名可搜（含正文跟随）
  const renamed = `e2e-renamed-${RUN}.md`
  writeFileSync(join(SCOPE_DIR, renamed), `改名后的正文 ${RUN}`)
  rmSync(DOC_PATH(), { force: true })
  await expect
    .poll(
      async () => {
        const oldHits = await query(main, UNIQUE)
        const newHits = await query(main, 'e2e-renamed')
        return {
          oldGone: oldHits.length === 0,
          newFound: newHits.map((i) => i.name).includes(renamed)
        }
      },
      { timeout: 20000, intervals: [1000, 2000] }
    )
    .toEqual({ oldGone: true, newFound: true })
})

test('文件索引状态可用', async () => {
  const main = await getMainWindow()
  const status = await main.evaluate(async () => await window.api.fileIndex.status())
  expect(status.status).toBe('ready')
  expect(status.scopes).toEqual([join(ROOT, 'test-results', 'file-index-scopes')])
  expect(status.files).toBeGreaterThan(0)
  expect(existsSync(SCOPE_DIR)).toBe(true)
})
