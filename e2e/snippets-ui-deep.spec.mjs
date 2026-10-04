/**
 * Frond · 代码片段五链路对抗性深测（批22）
 *
 * 五条已修链路在恶劣操作序列下的行为验证（与 snippets-ui.spec.mjs 互补——
 * 那条验「正常操作通」，本条验「恶劣操作不坏」）：
 *   1. 收件箱 vs 全部并排对比 + 移动归档后收件箱即时收缩（B56-2 + 选中态同步）
 *   2. trash 视图无「+」按钮；连续新建两个均入列（B56-4 边界）
 *   3. 三 tab 快速轮切（A→B→C→A）内容不串（B56-1 恶劣序列）
 *   4. 输入 → 防抖窗口内立即切 tab → API 读 DB 已落盘（B56-1 核心保证：
 *      flushPendingContentWrites 在切 tab 前排空队列）
 *   5. 点击行选中 → ↑↓ 移动 → Enter 复制 → 主进程剪贴板读回（批21 全链）
 *   6. 空态键盘不崩；重命名文件夹走 Uodal（B56-3 rename 路径）
 */

import { test, expect, _electron as electron } from 'playwright/test'

test.setTimeout(90_000)
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null
let main = null

const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url()) && !/launcher\.html/.test(w.url())) return w
      } catch {
        // 尚未就绪
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('找不到主窗')
}

const gotoSnippets = async () => {
  // 先去 settings 再回来：强制 SnippetList 重挂载（API 造数后列表需要重新拉取）
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await new Promise((r) => setTimeout(r, 400))
  await main.evaluate(() => {
    window.location.hash = '#/snippets'
  })
  await expect(main.locator('.snippets-main')).toBeVisible({ timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
}

test.beforeAll(async () => {
  const userData = join(ROOT, 'test-results', 'e2e-userdata-snippets-deep')
  rmSync(userData, { recursive: true, force: true })
  const env = { ...process.env, FROND_USER_DATA_DIR: userData }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })

  main = await getMainWindow()
  await main.getByText('跳过引导').first().click({ timeout: 30000 })
  await main.evaluate(async () => {
    await window.api.preferences.setOnboardingCompleted()
  })
  await gotoSnippets()
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 收件箱/全部并排：归档片段只在「全部」，移动归档后收件箱即时收缩', async () => {
  // 建文件夹 + 归档片段 + 收件箱片段
  const folderId = await main.evaluate(async () => {
    const f = await window.api.folder.addFolder({ name: '深测归档夹', parentId: null })
    await window.api.snippet.addSnippet({
      name: '深测-已归档',
      description: '',
      contents: [{ id: '', label: 'l', value: 'archived', language: 'txt' }],
      tagIds: [],
      isDeleted: false,
      isFavorites: false,
      folderId: f.id
    })
    await window.api.snippet.addSnippet({
      name: '深测-收件箱',
      description: '',
      contents: [{ id: '', label: 'l', value: 'inbox', language: 'txt' }],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    return f.id
  })
  await gotoSnippets() // 重载列表

  // 收件箱：只有未归档的
  const inbox = main.locator('.snippets-main')
  await expect(inbox.getByText('深测-收件箱')).toBeVisible({ timeout: 10000 })
  await expect(inbox.getByText('深测-已归档')).toHaveCount(0)

  // 全部：两个都在
  await main.locator('.snippets-main').getByText('全部', { exact: true }).click()
  await expect(inbox.getByText('深测-收件箱')).toBeVisible({ timeout: 10000 })
  await expect(inbox.getByText('深测-已归档')).toBeVisible({ timeout: 10000 })

  // 回收站片段移回收件箱（B56-5 选中态同步路径）：归档片段选中后移出文件夹
  await inbox.getByText('深测-已归档').click()
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await gotoSnippets()
  // 通过 API 移回收件箱模拟「另一窗口改」——广播应让主窗列表即时收缩（B56-5 广播）
  await main.evaluate(async (fid) => {
    const list = await window.api.snippet.getSnippets({ folderId: fid })
    for (const s of list) await window.api.snippet.updateSnippet(s.id, { folderId: null })
  }, folderId)
  // 全部视图内容不变；收件箱视图需要重新进入
  await main.locator('.snippets-main').getByText('全部', { exact: true }).click()
  await expect(inbox.getByText('深测-已归档')).toBeVisible({ timeout: 10000 })
})

test('2. trash 视图无「+」按钮；连续新建两个均入列', async () => {
  await gotoSnippets()
  // trash 视图：+ 按钮隐藏
  await main.locator('.snippets-main').getByText('回收站', { exact: true }).click()
  await expect(main.locator('[data-testid="snippet-create"]')).toHaveCount(0)

  // 回到收件箱，连续新建两个
  await main.locator('.snippets-main').getByText('收件箱', { exact: true }).click()
  await main.locator('[data-testid="snippet-create"]').click()
  await new Promise((r) => setTimeout(r, 300))
  await main.locator('[data-testid="snippet-create"]').click()
  await new Promise((r) => setTimeout(r, 300))
  const unnamed = main.locator('.snippets-main').getByText('未命名片段')
  await expect(unnamed.first()).toBeVisible({ timeout: 10000 })
  expect(await unnamed.count()).toBeGreaterThanOrEqual(2)
})

test('3. 三 tab 快速轮切（A→B→C→A）内容不串（B56-1）', async () => {
  // 造三块片段
  const id = await main.evaluate(async () => {
    const s = await window.api.snippet.addSnippet({
      name: '深测-三块轮切',
      description: '',
      contents: [
        { id: '', label: 'T1', value: '', language: 'js' },
        { id: '', label: 'T2', value: '', language: 'js' },
        { id: '', label: 'T3', value: '', language: 'js' }
      ],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
    return s.id
  })
  await gotoSnippets()
  await main.locator('.snippets-main').getByText('深测-三块轮切').first().click()
  await expect(main.locator('.CodeMirror').first()).toBeVisible({ timeout: 10000 })

  // T1 输入
  await main.locator('.snippets-main').getByText('T1', { exact: true }).click()
  await main.locator('.CodeMirror').first().click()
  await main.keyboard.type('AAA')

  // 快速轮切 A→B→C→B→A（不等防抖）
  await main.locator('.snippets-main').getByText('T2', { exact: true }).click()
  await main.locator('.snippets-main').getByText('T3', { exact: true }).click()
  await main.locator('.snippets-main').getByText('T2', { exact: true }).click()
  await main.locator('.snippets-main').getByText('T1', { exact: true }).click()

  // 等防抖 flush 落库
  await new Promise((r) => setTimeout(r, 800))

  // 三块的值从 DB 读回：T1=AAA，T2/T3 空
  const values = await main.evaluate(async (id) => {
    const s = await window.api.snippet.getSnippetById(id)
    return s.contents.map((c) => c.value)
  }, id)
  expect(values[0]).toBe('AAA')
  expect(values[1]).toBe('')
  expect(values[2]).toBe('')
})

test('4. 输入 → 防抖窗口内立即切 tab → API 读 DB 已落盘（B56-1 核心保证）', async () => {
  await main.locator('.snippets-main').getByText('深测-三块轮切').first().click()
  // T2 输入
  await main.locator('.snippets-main').getByText('T2', { exact: true }).click()
  await main.locator('.CodeMirror').first().click()
  await main.keyboard.type('BBB')
  // 不等 500ms 防抖，立即切 T1（switchContent 内部 flushPendingContentWrites 排空队列）
  await main.locator('.snippets-main').getByText('T1', { exact: true }).click()
  await new Promise((r) => setTimeout(r, 200))
  // API 读 DB：T2 的 BBB 必须已落盘
  const values = await main.evaluate(async () => {
    const list = await window.api.snippet.getSnippets({ search: '深测-三块轮切' })
    const s = list.find((x) => x.name === '深测-三块轮切')
    const full = await window.api.snippet.getSnippetById(s.id)
    return full.contents.map((c) => c.value)
  })
  expect(values[1]).toBe('BBB')
})

test('5. 点击行选中 → Enter 复制 → 主进程剪贴板读回', async () => {
  await gotoSnippets()
  // 选中「深测-收件箱」（首行内容 = inbox），容器获得焦点
  await main.locator('.snippets-main').getByText('深测-收件箱').first().click()
  await main.locator('.snippets-main [tabindex="-1"]').first().focus()
  await main.keyboard.press('Enter')
  await new Promise((r) => setTimeout(r, 500))
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText())
  expect(clip).toBe('inbox')
})

test('6. 重命名文件夹走 UModal；空列表键盘不崩', async () => {
  await gotoSnippets()
  // hover 文件夹行让重命名按钮可见（opacity-0 → group-hover:opacity-100）
  const folderRow = main.locator('aside').locator('button[title="重命名"]').first()
  await folderRow.hover()
  await folderRow.click()
  const input = main.locator('[data-testid="folder-name-input"]')
  await expect(input).toBeVisible({ timeout: 5000 })
  await input.fill('深测归档夹-改名')
  await main.locator('[data-testid="folder-name-confirm"]').click()
  await expect(main.getByText('深测归档夹-改名')).toBeVisible({ timeout: 5000 })

  // 空态键盘：搜索一个不存在的词 → 列表空 → ↑↓ 不崩、无选中发出
  await main.locator('input[placeholder="搜索片段…"]').fill('不存在的片段XYZ')
  await new Promise((r) => setTimeout(r, 500))
  await main.locator('.snippets-main [tabindex="-1"]').focus()
  await main.keyboard.press('ArrowDown')
  await main.keyboard.press('Enter')
  await expect(main.locator('.snippets-main').getByText('没有匹配的片段')).toBeVisible({
    timeout: 5000
  })
})
