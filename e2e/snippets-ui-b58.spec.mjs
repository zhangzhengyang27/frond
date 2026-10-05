/**
 * Frond · 代码片段模块 UI E2E —— B58 断头路收口（批A/批B）
 *
 * 与 snippets-ui.spec.mjs（B56 五链路）互补，本条覆盖 B58 的产品级闭环：
 *   1. 标签筛选：侧栏点标签 → 列表只剩打了该标的片段（此前标签只写不读）
 *   2. 触发词冲突：两个片段同触发词，编辑器输入实时提示冲突方
 *   3. 文件夹默认语言：对话框设默认语言 → 文件夹内新建片段自动套用（此前死字段）
 *   4. 编辑器删除入口：详情页直接移入回收站（此前必须回列表右键）
 *   5. 导入/导出入口：列表头按钮存在（原生对话框无法在 e2e 内驱动，只验入口）
 *
 * 用法：先 npx electron-vite build，再 pnpm exec playwright test e2e/snippets-ui-b58.spec.mjs
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
  const userData = join(ROOT, 'test-results', 'e2e-userdata-snippets-b58')
  rmSync(userData, { recursive: true, force: true })
  const env = { ...process.env, FROND_USER_DATA_DIR: userData }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })

  main = await getMainWindow()
  await main.getByText('跳过引导').first().click({ timeout: 30000 })
  await main.evaluate(async () => {
    await window.api.preferences.setOnboardingCompleted()
    window.location.hash = '#/snippets'
  })
  await expect(main.locator('.snippets-main').first()).toBeVisible({ timeout: 15000 })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

const seedSnippet = async (name, opts = {}) =>
  main.evaluate(
    async ({ name, opts }) => {
      return window.api.snippet.addSnippet({
        name,
        description: '',
        contents: [{ id: '', label: '代码 1', value: `body of ${name}`, language: 'plaintext' }],
        tagIds: opts.tagIds ?? [],
        trigger: opts.trigger,
        folderId: opts.folderId ?? null,
        isDeleted: false,
        isFavorites: false
      })
    },
    { name, opts }
  )

/** 切走再切回 /snippets，强制三栏重挂载（API 造的数在挂载时拉取） */
const remount = async () => {
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await main.waitForTimeout(400)
  await main.evaluate(() => {
    window.location.hash = '#/snippets'
  })
  await expect(main.locator('.snippets-main').first()).toBeVisible({ timeout: 15000 })
}

test('1. 标签筛选：侧栏点标签 → 列表只剩打标片段（B58）', async () => {
  const tag = await main.evaluate(async () => window.api.tag.addTag('E2E标签'))
  await seedSnippet('标签筛选-有标', { tagIds: [tag.id] })
  await seedSnippet('标签筛选-无标', {})
  await remount()

  // B59a：窗口标题跟随路由（此前 SettingsView 的「设置」跨路由滞留，
  // 且首版 watcher 踩 TDZ 静默失效——此断言就是钉这两个坑）
  await expect.poll(async () => main.title(), { timeout: 5000 }).toBe('代码片段')

  const sidebar = main.locator('aside')
  const tagButton = sidebar.getByText('E2E标签', { exact: true }).first()
  await expect(tagButton).toBeVisible({ timeout: 10000 })
  await tagButton.click()

  const list = main.locator('.snippets-main')
  await expect(list.getByText('标签筛选-有标').first()).toBeVisible({ timeout: 10000 })
  await expect(list.getByText('标签筛选-无标')).toHaveCount(0)
  // 列表标题切到标签名
  await expect(list.getByText('E2E标签', { exact: true }).first()).toBeVisible()

  // 再点一次取消筛选，两条都回来
  await sidebar.getByText('E2E标签', { exact: true }).first().click()
  await expect(list.getByText('标签筛选-无标').first()).toBeVisible({ timeout: 10000 })
})

test('2. 触发词冲突实时提示（B58）', async () => {
  await seedSnippet('冲突-占坑', { trigger: ';e2edup' })
  await seedSnippet('冲突-检测方', {})
  await remount()

  // 选中无触发词的片段
  const row = main.locator('.snippets-main').getByText('冲突-检测方').first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.click()
  await expect(main.locator('.CodeMirror').first()).toBeVisible({ timeout: 10000 })

  // 输入与「冲突-占坑」相同的触发词 → 300ms 防抖后提示
  const triggerInput = main.locator('[data-testid="snippet-trigger-input"]')
  await triggerInput.fill(';e2edup')
  const conflict = main.locator('[data-testid="trigger-conflict"]')
  await expect(conflict).toBeVisible({ timeout: 5000 })
  await expect(conflict).toContainText('冲突-占坑')

  // 改成独有触发词 → 提示消失
  await triggerInput.fill(';unique-trig')
  await expect(conflict).toBeHidden({ timeout: 5000 })
})

test('3. 文件夹默认语言：对话框设置 → 新建片段继承（B58）', async () => {
  // 走 UI 建文件夹并选默认语言（对话框的 USelect 直通原生 select）
  await main.locator('[title="新建文件夹"]').click()
  const nameInput = main.locator('[data-testid="folder-name-input"]')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.fill('E2E默认语言夹')
  await main.locator('[data-testid="folder-language-select"]').selectOption('python')
  await main.locator('[data-testid="folder-name-confirm"]').click()
  await expect(main.locator('aside').getByText('E2E默认语言夹')).toBeVisible({ timeout: 5000 })

  // 进入该文件夹视图再新建
  await main.locator('aside').getByText('E2E默认语言夹').click()
  await main.locator('[data-testid="snippet-create"]').click()
  await expect(main.locator('.snippets-main').getByText('未命名片段').first()).toBeVisible({
    timeout: 10000
  })
  // 语言下拉（工具条第一个 select）应为 python
  const langSelect = main.locator('.snippets-main select').first()
  await expect(langSelect).toHaveValue('python', { timeout: 10000 })

  // DB 真值核验
  const lang = await main.evaluate(async () => {
    const list = await window.api.snippet.getSnippets({ isDeleted: false })
    const created = list.find((s) => s.name === '未命名片段')
    return created?.contents?.[0]?.language ?? null
  })
  expect(lang).toBe('python')
})

test('4. 编辑器删除入口：移入回收站（B58）', async () => {
  await seedSnippet('删除入口-目标', {})
  await remount()
  const row = main.locator('.snippets-main').getByText('删除入口-目标').first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await row.click()
  await expect(main.locator('[data-testid="snippet-trash"]')).toBeVisible({ timeout: 5000 })
  await main.locator('[data-testid="snippet-trash"]').click()

  // 确认弹窗（useConfirm → 「移入回收站」按钮）
  const confirmBtn = main.getByRole('button', { name: '移入回收站' }).last()
  await expect(confirmBtn).toBeVisible({ timeout: 5000 })
  await confirmBtn.click()

  // 列表不再显示、编辑器回到空态
  await expect(main.locator('.snippets-main').getByText('删除入口-目标')).toHaveCount(0, {
    timeout: 10000
  })
  const inTrash = await main.evaluate(async () => {
    const list = await window.api.snippet.getSnippets({ isDeleted: true })
    return list.some((s) => s.name === '删除入口-目标')
  })
  expect(inTrash).toBe(true)
})

test('5. 导入/导出入口存在（B58；原生对话框不在 e2e 驱动范围）', async () => {
  await expect(main.locator('[data-testid="snippet-export"]')).toBeVisible({ timeout: 5000 })
  await expect(main.locator('[data-testid="snippet-import"]')).toBeVisible()
  // 回收站视图不显示
  await main.locator('aside').getByText('回收站').click()
  await expect(main.locator('[data-testid="snippet-export"]')).toHaveCount(0)
  await expect(main.locator('[data-testid="snippet-import"]')).toHaveCount(0)
  await main.locator('aside').getByText('收件箱').click()
})
