/**
 * Leaf · E2E：修饰键二级动作直触（P-1.2）
 *
 * 断言全部落在真实副作用上，不看「界面像不像响应了」：
 *  - ⌘⌫ → 主进程 `find:reveal` 计数 +1（证据来自 LEAF_E2E 专用探针，见 src/main/e2eProbe.ts）
 *  - ⌘⌫ 不得顺带打开 ⌘K 面板（那是另一条入口）
 *  - 在**没有** reveal 动作的行上，⌘⌫ 必须被吃掉且不改动查询词（保留组合）
 *
 * 用法：先 `pnpm build`，再
 * `pnpm exec playwright test e2e/capsule-actions.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
// 与 file-index.spec 共用 playwright.config 里的 LEAF_FILE_INDEX_SCOPES 目录
const SCOPE_DIR = join(ROOT, 'test-results', 'file-index-scopes')
const RUN = `e2e${Date.now().toString(36)}`
const UNIQUE = `reveal-probe-${RUN}`

let app = null

// 自建索引（FSEvents 后端）macOS 专属；Windows 侧未实机验证
const isMac = process.platform === 'darwin'
test.skip(!isMac, '文件索引 Windows 后端未实机验证')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/Leaf/.test(await w.title())) return w
      } catch {
        /* 窗口可能已关闭 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return app.firstWindow()
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const getCapsuleWindow = async () => {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('launcher.html')) return w
      } catch {
        /* noop */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

/** 主进程探针快照：{ [channel]: 调用次数 } */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const probeCounts = (capsule) => capsule.evaluate(() => window.api.e2e.probeCounts())

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const rowsOf = (capsule) => capsule.locator('.launcher-result')
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const titleAt = async (capsule, i) =>
  (await rowsOf(capsule).nth(i).locator('.launcher-result-title').innerText()).trim()
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const badgeAt = async (capsule, i) =>
  (
    (await rowsOf(capsule).nth(i).locator('.launcher-result-badge').first().textContent()) ?? ''
  ).trim()
/** 唤起胶囊并把查询词设为 term（等结果首行真的变成 term 再返回） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const searchInCapsule = async (main, term) => {
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('')
  await input.fill(term)
  return { capsule, input }
}

test.beforeAll(async () => {
  // 播种要在 app 启动做初始扫描之前
  mkdirSync(SCOPE_DIR, { recursive: true })
  writeFileSync(join(SCOPE_DIR, `${UNIQUE}-a.txt`), 'reveal probe a\n')
  writeFileSync(join(SCOPE_DIR, `${UNIQUE}-b.txt`), 'reveal probe b\n')
  writeFileSync(join(SCOPE_DIR, `${UNIQUE}.txt`), 'reveal probe\n')

  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-capsule-actions')
  env.LEAF_E2E = '1'
  // 每次从干净 userData 起：本目录会被历史跑残留（曾有 spec 往文件索引里加过「/」作用域，
  // 于是 'Safari' 的前 20 行全被 System/Library 的文件行占满，应用行根本进不了列表，
  // 表现就是「绕 4 圈没遇到应用行」——不是排序问题，是这台实例的索引范围被污染了）
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
  rmSync(SCOPE_DIR, { recursive: true, force: true })
})

test('文件行按 ⌘⌫ → 主进程 reveal 恰好一次，且不打开动作面板', async () => {
  test.slow() // 等自建索引就绪
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  await main.reload()
  await main.waitForLoadState('domcontentloaded')

  // 唯一文件名：行序确定为第 1 条（不靠 locale、不与其他命令抢位）
  const { capsule, input } = await searchInCapsule(main, UNIQUE)
  const firstBadge = capsule.locator('.launcher-result').first().locator('.launcher-result-badge')
  await expect(firstBadge).toHaveText('文件', { timeout: 40000 })

  const before = (await probeCounts(capsule))['find:reveal'] ?? 0
  await input.press('Meta+Backspace')

  await expect
    .poll(async () => (await probeCounts(capsule))['find:reveal'] ?? 0, { timeout: 10000 })
    .toBe(before + 1)
  await expect(capsule.locator('[data-testid=action-panel]')).toHaveCount(0)
})

test('⌘⇧K 切换 keep-open：键位到主进程一条不漏，指示点跟随生效值', async () => {
  const main = await getMainWindow()
  const { capsule, input } = await searchInCapsule(main, '三模式')
  await expect(capsule.locator('.launcher-result').first()).toBeVisible()

  // 为什么不断言「失焦就隐藏」：e2e 里 Leaf 不是前台应用，胶囊 show()+focus()
  // 拿不到真正的 key 状态，blur 事件压根不触发（试过 bringToFront 与另开真窗口抢
  // focus，两种都拿不到）。所以「钉住 → blur 不隐藏」由 shouldHideOnBlur 的 4 条
  // 单测覆盖，这里只钉住「键位 → 主进程生效 → 界面反馈」这一段真链路。
  const before = (await probeCounts(capsule))['launcher:setPinned'] ?? 0

  await input.press('Meta+Shift+K')
  await expect
    .poll(async () => (await probeCounts(capsule))['launcher:setPinned'] ?? 0, { timeout: 5000 })
    .toBe(before + 1)
  await expect(capsule.locator('[data-testid=pinned-indicator]')).toHaveCount(1)

  await input.press('Meta+Shift+K')
  await expect
    .poll(async () => (await probeCounts(capsule))['launcher:setPinned'] ?? 0, { timeout: 5000 })
    .toBe(before + 2)
  await expect(capsule.locator('[data-testid=pinned-indicator]')).toHaveCount(0)
})

test('⌘⇧F 收藏任意条目：落库 + 重查置顶 + 再按取消回到原位', async () => {
  test.slow()
  const main = await getMainWindow()
  const { capsule, input } = await searchInCapsule(main, UNIQUE)

  // 必须等三个播种文件都进索引再取目标：索引未热时第 2 行会是命令行而非文件行，
  // 收藏对象不稳定（第一次跑就是这么挂的）
  await expect(async () => {
    let files = 0
    for (let i = 0; i < Math.min(await rowsOf(capsule).count(), 8); i++) {
      if ((await badgeAt(capsule, i)) === '文件') files++
    }
    expect(files).toBeGreaterThanOrEqual(3)
  }).toPass({ timeout: 40000 })

  // 取第二条作为收藏对象（第一条天然在前，置顶效果必须换个目标才看得出来）
  const target = await titleAt(capsule, 1)
  const before = (await capsule.evaluate(() => window.api.usage.getFavorites())).length

  await input.press('ArrowDown')
  await input.press('Meta+Shift+F')
  await expect
    .poll(() => capsule.evaluate(() => window.api.usage.getFavorites()), { timeout: 5000 })
    .toHaveLength(before + 1)

  // 重查同一词：被收藏的那条必须排到第一（置顶是真效果，不是只进了表）
  await input.fill('')
  await input.fill(UNIQUE)
  await expect(rowsOf(capsule).first().locator('.launcher-result-title')).toContainText(
    target.split('\n')[0],
    { timeout: 10000 }
  )

  // 取消收藏：回到原位，且库里干净
  await input.press('Meta+Shift+F')
  await expect
    .poll(() => capsule.evaluate(() => window.api.usage.getFavorites()), { timeout: 5000 })
    .toHaveLength(before)
})

test('键盘选中应用行 → 详情面板异步出现包元数据（函数型 detail 真被调用）', async () => {
  test.slow() // 应用列表冷扫描 5-15s
  const main = await getMainWindow()
  const { capsule, input } = await searchInCapsule(main, 'Safari')

  // 不猜行号、不数着按：一步一按，每按一次读**当前高亮行**的徽标，直到它是「应用」。
  // 两个旧写法躲不开的坑：① 结果列表在应用/文件源陆续热起来的过程中会长，
  // 按「进循环时读到的行数」走一圈会漏掉后来才出现的应用行（表现就是详情面板永远等不到
  // Bundle ID，而单跑一次过、套跑就红——套跑时磁盘上的索引更热，行数变化更快）；
  // ② 分组渲染后 DOM 序 ≠ results 扁平序，nth(i) 本就不等价于第 i 个结果。
  // 所以每按一次都重新数行、只认 .launcher-result.selected（那才是回车会作用的行）。
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
  const selectedBadge = async () =>
    (
      (await capsule
        .locator('.launcher-result.selected .launcher-result-badge')
        .first()
        .textContent()) ?? ''
    ).trim()

  await expect(async () => {
    expect(await rowsOf(capsule).count(), '查询 "Safari" 没有任何结果').toBeGreaterThan(0)
    let landed = false
    // 上限 240 步：P-6④ 把封顶从 20 放宽到 50 之后，80 步只够绕 1.6 圈（表现是套跑时
    // 列表更长、应用行落在圈外）。240 = 50 行绕近 5 圈，列表边长边绕也不漏（moveSelection 是绕圈的）
    for (let i = 0; i < 240 && !landed; i++) {
      await input.press('ArrowDown')
      landed = (await selectedBadge()) === '应用'
    }
    if (!landed) {
      const rows = await capsule.locator('.launcher-result').evaluateAll((els) =>
        els.map((el) => {
          const b = el.querySelector('.launcher-result-badge')
          const t = el.querySelector('.launcher-result-title')
          return `${b ? b.textContent.trim() : '-'}/${t ? t.textContent.trim() : '?'}`
        })
      )
      throw new Error(`绕圈没遇到应用行，当前列表：${rows.join(' , ')}`)
    }
    // 只走键盘、不 hover：hover 路径会掩盖 watch 没接好这种问题
    const panel = capsule.locator('[data-testid=detail-panel]')
    await expect(panel).toContainText('Bundle ID', { timeout: 8000 })
    await expect(panel).toContainText('路径：')
  }).toPass({ timeout: 60000 })
})

test('没有 reveal 动作的行上 ⌘⌫ 被吃掉：不触发 IPC、不清空查询词', async () => {
  const main = await getMainWindow()
  const { capsule, input } = await searchInCapsule(main, '三模式')
  await expect(capsule.locator('.launcher-result').first()).toBeVisible({ timeout: 15000 })

  const before = (await probeCounts(capsule))['find:reveal'] ?? 0
  await input.press('Meta+Backspace')
  await new Promise((r) => setTimeout(r, 800))

  expect((await probeCounts(capsule))['find:reveal'] ?? 0).toBe(before)
  // 保留组合的意义：⌘⌫ 不穿透成输入框的「删到行首」
  await expect(input).toHaveValue('三模式')
})
