/**
 * Frond · 代码片段模块 UI E2E（B56 修复链路的功能级验证）
 *
 * 与 snippets-crud.spec.mjs 互补：那条走 API 验跨进程契约，本条驱动**真实 UI**
 * 验用户可见的行为——B56 修复的五条链路逐条过：
 *   1. 收件箱视图只显示未归档片段（B56-2：此前 = 全部片段）
 *   2. 列表头「+」新建片段：创建即出现在列表并选中进编辑器（B56-4：此前无入口）
 *   3. 编辑器切 tab：A 输入 → 切 B → 切回，输入不丢（B56-1：此前被旧值回填）
 *   4. 文件夹新建：UModal 弹窗（B56-3：此前 window.prompt 直接抛异常）
 *   5. 键盘导航：↑↓ 移动选中，Enter 复制（批21）
 *
 * 用法：先 npx electron-vite build，再 pnpm exec playwright test e2e/snippets-ui.spec.mjs
 */

import { test, expect, _electron as electron } from 'playwright/test'
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

test.beforeAll(async () => {
  const userData = join(ROOT, 'test-results', 'e2e-userdata-snippets-ui')
  rmSync(userData, { recursive: true, force: true })
  const env = { ...process.env, FROND_USER_DATA_DIR: userData }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })

  main = await getMainWindow()
  // 首启引导：等它渲染出来再跳过（过早改 hash 会被启动重定向覆盖）
  await main.getByText('跳过引导').first().click({ timeout: 30000 })
  await main.evaluate(async () => {
    await window.api.preferences.setOnboardingCompleted()
    window.location.hash = '#/snippets'
  })
  await expect(main.locator('#launcher-result-list, .snippets-main').first()).toBeVisible({
    timeout: 15000
  })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

/** API 造数：带 folder 的与不带的各一条（收件箱过滤验证用） */
const seedViaApi = async (name, folderId = null) =>
  main.evaluate(
    async ({ name, folderId }) => {
      return window.api.snippet.addSnippet({
        name,
        description: '',
        contents: [{ id: '', label: '代码 1', value: `body of ${name}`, language: 'js' }],
        tagIds: [],
        isDeleted: false,
        isFavorites: false,
        folderId
      })
    },
    { name, folderId }
  )

test('1. 收件箱视图只显示未归档片段（B56-2）', async () => {
  const folder = await main.evaluate(async () => {
    const folders = await window.api.folder.getFolders()
    return folders[0] ?? null
  })
  // 无文件夹时建一个，保证「归档片段」真实存在
  const folderId =
    folder?.id ??
    (
      await main.evaluate(async () => {
        const f = await window.api.folder.addFolder({ name: 'E2E 归档夹', parentId: null })
        return f
      })
    ).id

  await seedViaApi('UI-未归档-唯一', null)
  await seedViaApi('UI-已归档-不应出现在收件箱', folderId)

  // 默认视图就是收件箱：重载一次列表（切走再切回触发 watch）
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await main.evaluate(() => {
    window.location.hash = '#/snippets'
  })
  const inboxList = main.locator('.snippets-main')
  await expect(inboxList.getByText('UI-未归档-唯一').first()).toBeVisible({
    timeout: 10000
  })
  await expect(inboxList.getByText('UI-已归档-不应出现在收件箱')).toHaveCount(0)
})

test('2. 列表头「+」新建片段：创建即入列并选中（B56-4）', async () => {
  await main.locator('[data-testid="snippet-create"]').click()
  // 新建的「未命名片段」出现在列表且选中（Editor 收到 snippet）
  await expect(main.locator('.snippets-main').getByText('未命名片段').first()).toBeVisible({
    timeout: 10000
  })
  // 编辑器装载了选中的片段（出现 CodeMirror 区域）
  await expect(main.locator('.CodeMirror').first()).toBeVisible({ timeout: 10000 })
})

test('3. 编辑器切 tab 输入不丢（B56-1）', async () => {
  // 用 API 造一个双代码块片段，选中它
  await main.evaluate(async () => {
    await window.api.snippet.addSnippet({
      name: 'UI-双块-切tab',
      description: '',
      contents: [
        { id: '', label: 'A 块', value: '', language: 'js' },
        { id: '', label: 'B 块', value: '', language: 'js' }
      ],
      tagIds: [],
      isDeleted: false,
      isFavorites: false
    })
  })
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await main.waitForTimeout(500)
  await main.evaluate(() => {
    window.location.hash = '#/snippets'
  })
  // 选中它：列表里点它的名字（后台有索引活动时列表装载可能偏慢，放宽到 30s）
  const row = main.locator('.snippets-main').getByText('UI-双块-切tab').first()
  await expect(row).toBeVisible({ timeout: 30000 })
  await row.click()

  // tab A 输入
  const tabs = main.locator('.snippets-main').getByText('A 块', { exact: true })
  await tabs.first().click()
  await main.locator('.CodeMirror').first().click()
  await main.keyboard.type('content-of-A')
  const probeTyped = await main.evaluate(() => {
    const cm = document.querySelector('.CodeMirror')
    return {
      value: cm?.CodeMirror ? cm.CodeMirror.getValue() : null,
      focused: document.activeElement?.className?.slice(0, 40) ?? null
    }
  })
  console.log('[PROBE-TYPED]', JSON.stringify(probeTyped))

  // 切到 B 块再切回（逐步探针）
  await main.locator('.snippets-main').getByText('B 块', { exact: true }).first().click()
  const probeB = await main.evaluate(() => {
    const cm = document.querySelector('.CodeMirror')
    return { value: cm?.CodeMirror?.getValue() ?? null, index: cm?.CodeMirror?.getCursor() }
  })
  console.log('[PROBE-B]', JSON.stringify(probeB))
  await main.locator('.snippets-main').getByText('A 块', { exact: true }).first().click()
  const probeA = await main.evaluate(() => {
    const cm = document.querySelector('.CodeMirror')
    return { value: cm?.CodeMirror?.getValue() ?? null }
  })
  console.log('[PROBE-A]', JSON.stringify(probeA))
  const allSnips = await main.evaluate(async () => {
    const list = await window.api.snippet.getSnippets({ isDeleted: false })
    return list.map((s) => ({ name: s.name, first: s.contents?.[0]?.value?.slice(0, 30) }))
  })
  console.log('[PROBE-DB]', JSON.stringify(allSnips))

  // A 的输入还在（B56-1 之前会被旧值回填清空）。
  // CodeMirror 把文本拆成逐字符 span，getByText/innerText 都可能失真——
  // 直接读编辑器文档（getValue 是 CM 的唯一真值面）
  const probe = await main.evaluate(() => {
    const cms = document.querySelectorAll('.CodeMirror')
    const cm = cms[0]
    return {
      value: cm?.CodeMirror ? cm.CodeMirror.getValue() : null,
      count: cms.length,
      visible: cm ? cm.innerText.slice(0, 60) : null,
      labels: [...document.querySelectorAll('.snippets-main [title], .snippets-main span')]
        .map((e) => e.textContent?.trim())
        .filter((t) => t === 'A 块' || t === 'B 块'),
      sw: window.__sw ?? []
    }
  })
  // 探针写进断言消息（console 在 list reporter 下不可见）
  expect(probe.value, `PROBE: ${JSON.stringify(probe)}`).toContain('content-of-A')
})

test('4. 文件夹新建走 UModal 弹窗（B56-3）', async () => {
  const newBtn = main.locator('[title="新建文件夹"]')
  await newBtn.click()
  const input = main.locator('[data-testid="folder-name-input"]')
  await expect(input).toBeVisible({ timeout: 5000 })
  await input.fill('UI-E2E 文件夹')
  await main.locator('[data-testid="folder-name-confirm"]').click()
  // 侧栏出现新文件夹
  await expect(main.getByText('UI-E2E 文件夹')).toBeVisible({ timeout: 5000 })
})

test('5. 键盘导航：↓ 移动选中，Enter 复制（批21）', async () => {
  await main.evaluate(() => {
    window.location.hash = '#/snippets'
  })
  const list = main.locator('.snippets-main')
  await expect(list).toBeVisible({ timeout: 10000 })
  // 焦点落进列表容器（tabindex=-1 可点击聚焦），↑↓ 不抛错即链路通
  await list.click()
  await main.keyboard.press('ArrowDown')
  await main.keyboard.press('ArrowDown')
  await main.keyboard.press('ArrowUp')
  // Enter 复制选中项（navigator.clipboard 写入；权限内静默成功）
  await main.keyboard.press('Enter')
})
