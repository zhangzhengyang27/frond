/**
 * Frond · 代码片段 CRUD E2E 测试
 *
 * 覆盖行为层此前零覆盖的主链路：新建 → 列表 → 更新 → 软删 → 回收站 →
 * 恢复 → 复制 → 彻底删除，以及统计口径。
 *
 * 为什么用 e2e 而不是单测：这条链路的价值在**跨进程契约**——
 * 渲染端 `window.api.snippet.*` → preload → IPC 通道名 → 主进程 typedHandle →
 * SnippetDataStore → SnippetRepository → SQLite。任何一环的名字/形状漂了，
 * 单测（只测 repo）都发现不了，只有真机跑一遍才暴露。
 *
 * 两条经验直接用上（来自 pomodoro.spec.mjs 的教训）：
 *   1. 窗口按 url 匹配 /index.html —— 不用 firstWindow()，它会拿到
 *      electron-screenshots 上游的截图覆盖层窗口（没有 window.api）；
 *      也不用 title，胶囊窗 title "Frond Launcher" 同样匹配 /Frond/。
 *   2. 断言走 expectIpcOk() —— 先卡掉 { error }，否则「IPC 全挂」也能全绿。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null
let mainPage = null

/** 用例 1 建的片段，后续用例串在这上面 */
let snippetId = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  if (mainPage && !mainPage.isClosed()) return mainPage

  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) {
          mainPage = w
          return w
        }
      } catch {
        // 窗口可能已关闭
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('30s 内没等到主窗口（out/renderer/index.html）')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
function expectIpcOk(res, label) {
  expect(res, `${label}：IPC 没有返回`).toBeDefined()
  expect(res?.error, `${label}：IPC 报错`).toBeUndefined()
  return res
}

/** 在渲染进程里读 snippet 统计（多条用例都要用，单独抽出来） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const readStats = (page) =>
  page.evaluate(async () => {
    try {
      return await window.api.snippet.getStatistics()
    } catch (e) {
      return { error: e.message }
    }
  })

/** 在渲染进程里读主列表 / 回收站列表 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const readList = (page, filters) =>
  page.evaluate(async (f) => {
    try {
      return await window.api.snippet.getSnippets(f)
    } catch (e) {
      return { error: e.message }
    }
  }, filters)

test.beforeAll(async () => {
  const env = { ...process.env }
  const userData = join(ROOT, 'test-results', 'e2e-userdata-snippets')
  // 清空：本 spec 的统计断言是「相对变化」，残留数据会让绝对量漂
  rmSync(userData, { recursive: true, force: true })
  env.FROND_USER_DATA_DIR = userData
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE

  // env 必须是顶层选项（HANDOFF §5）：写成 launchOptions.env 会被静默丢弃
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  await getMainWindow()
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 新建片段：返回 id，且能按 id 读回同样的内容', async () => {
  const page = await getMainWindow()
  const name = 'E2E 片段-' + Date.now()

  const created = await page.evaluate(async (n) => {
    try {
      return await window.api.snippet.addSnippet({
        name: n,
        description: '由 e2e 创建',
        contents: [{ id: '', label: '默认', value: 'console.log(1)', language: 'javascript' }],
        tagIds: [],
        isDeleted: false,
        isFavorites: false
      })
    } catch (e) {
      return { error: e.message }
    }
  }, name)

  expectIpcOk(created, 'snippet.addSnippet')
  expect(created.id).toBeTruthy()
  expect(created.name).toBe(name)
  snippetId = created.id

  const fetched = await page.evaluate(async (id) => {
    try {
      return await window.api.snippet.getSnippetById(id)
    } catch (e) {
      return { error: e.message }
    }
  }, snippetId)

  expectIpcOk(fetched, 'snippet.getSnippetById')
  expect(fetched.name).toBe(name)
  // 内容在库里是加密存的（encryptText），读回必须解回原文
  expect(fetched.contents[0].value).toBe('console.log(1)')
  expect(fetched.contents[0].language).toBe('javascript')
})

test('2. 新建的片段出现在主列表里', async () => {
  const page = await getMainWindow()

  const list = await readList(page)
  expectIpcOk(list, 'snippet.getSnippets')
  expect(Array.isArray(list)).toBe(true)
  expect(list.map((s) => s.id)).toContain(snippetId)
})

test('3. 更新：改名字后读回是新值', async () => {
  const page = await getMainWindow()
  const newName = 'E2E 片段已改名-' + Date.now()

  const updated = await page.evaluate(
    async ({ id, name }) => {
      try {
        return await window.api.snippet.updateSnippet(id, { name })
      } catch (e) {
        return { error: e.message }
      }
    },
    { id: snippetId, name: newName }
  )

  expectIpcOk(updated, 'snippet.updateSnippet')
  expect(updated.name).toBe(newName)

  const fetched = await page.evaluate(async (id) => {
    try {
      return await window.api.snippet.getSnippetById(id)
    } catch (e) {
      return { error: e.message }
    }
  }, snippetId)
  expect(fetched.name).toBe(newName)
})

test('4. 软删：从主列表消失，但进回收站列表；统计口径跟着变', async () => {
  const page = await getMainWindow()

  const before = await readStats(page)
  expectIpcOk(before, 'snippet.getStatistics(before)')

  const delOk = await page.evaluate(async (id) => {
    try {
      return await window.api.snippet.deleteSnippet(id)
    } catch (e) {
      return { error: e.message }
    }
  }, snippetId)
  expectIpcOk(delOk, 'snippet.deleteSnippet')
  expect(delOk).toBe(true)

  const mainList = await readList(page)
  expect(mainList.map((s) => s.id)).not.toContain(snippetId)

  const trashList = await readList(page, { isDeleted: true })
  expectIpcOk(trashList, 'snippet.getSnippets({ isDeleted: true })')
  expect(trashList.map((s) => s.id)).toContain(snippetId)

  const after = await readStats(page)
  expectIpcOk(after, 'snippet.getStatistics(after)')
  expect(after.trash).toBe(before.trash + 1)
  expect(after.total).toBe(before.total - 1)
})

test('5. 恢复：回到主列表，回收站计数回落', async () => {
  const page = await getMainWindow()

  const before = await readStats(page)

  const ok = await page.evaluate(async (id) => {
    try {
      return await window.api.snippet.restoreSnippet(id)
    } catch (e) {
      return { error: e.message }
    }
  }, snippetId)
  expectIpcOk(ok, 'snippet.restoreSnippet')
  expect(ok).toBe(true)

  const mainList = await readList(page)
  expect(mainList.map((s) => s.id)).toContain(snippetId)

  const after = await readStats(page)
  expect(after.total).toBe(before.total + 1)
  expect(after.trash).toBe(before.trash - 1)
})

test('6. 复制：产生新 id 的新片段，原片段不受影响', async () => {
  const page = await getMainWindow()

  const copy = await page.evaluate(async (id) => {
    try {
      return await window.api.snippet.duplicateSnippet(id)
    } catch (e) {
      return { error: e.message }
    }
  }, snippetId)

  expectIpcOk(copy, 'snippet.duplicateSnippet')
  expect(copy.id).toBeTruthy()
  expect(copy.id).not.toBe(snippetId)

  const list = await readList(page)
  const ids = list.map((s) => s.id)
  expect(ids).toContain(snippetId)
  expect(ids).toContain(copy.id)

  // 清理副本，避免污染后续统计断言
  const purged = await page.evaluate(async (id) => {
    try {
      await window.api.snippet.deleteSnippet(id)
      return await window.api.snippet.permanentlyDeleteSnippet(id)
    } catch (e) {
      return { error: e.message }
    }
  }, copy.id)
  expectIpcOk(purged, 'snippet.permanentlyDeleteSnippet(copy)')
  expect(purged).toBe(true)
})

test('7. 彻底删除：按 id 查不到，主列表与回收站都没有', async () => {
  const page = await getMainWindow()

  const purged = await page.evaluate(async (id) => {
    try {
      await window.api.snippet.deleteSnippet(id)
      return await window.api.snippet.permanentlyDeleteSnippet(id)
    } catch (e) {
      return { error: e.message }
    }
  }, snippetId)
  expectIpcOk(purged, 'snippet.permanentlyDeleteSnippet')
  expect(purged).toBe(true)

  const fetched = await page.evaluate(async (id) => {
    try {
      return await window.api.snippet.getSnippetById(id)
    } catch (e) {
      return { error: e.message }
    }
  }, snippetId)
  // 主进程返回 undefined。注意不能用 expectIpcOk —— 它会把 undefined 判成
  // 「没返回」；而若 IPC 报错这里会拿到 { error }，那条断言同样会失败，判别性在。
  expect(fetched).toBeUndefined()

  const mainList = await readList(page)
  expect(mainList.map((s) => s.id)).not.toContain(snippetId)

  const trashList = await readList(page, { isDeleted: true })
  expect(trashList.map((s) => s.id)).not.toContain(snippetId)
})

test('8. 统计口径：字段为数字且不为负', async () => {
  const page = await getMainWindow()

  const stats = await readStats(page)
  expectIpcOk(stats, 'snippet.getStatistics')
  expect(typeof stats.total).toBe('number')
  expect(typeof stats.trash).toBe('number')
  expect(stats.total).toBeGreaterThanOrEqual(0)
  expect(stats.trash).toBeGreaterThanOrEqual(0)
})
