/**
 * Leaf · E2E：截图覆盖层（恢复存证 · HANDOFF §10.5）
 *
 * 为什么单独有这条：事故后 `src/renderer/screenshot.html` 整页不存在，截图标注那条链
 * （入口页 + preload 桥 + 11 个操作组件 + iconfont）从未进过构建，更没真跑过。
 * 走 `startCapture()` 需要屏幕录制授权且会抢走整屏，所以这里**不碰真截屏**：
 * 用同一份 preload 打开构建产物 `out/renderer/screenshot.html`，按主进程的方式推
 * `SCREENSHOT:capture`，验的是「页mount上了、选区拖得出来、工具栏在、字形解析得出来、
 * 点工具真的切换了」这几件事本身。
 *
 * 用法：先 `npx electron-vite build`，再
 * `pnpm exec playwright test e2e/screenshot-overlay.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const PAGE_HTML = join(ROOT, 'out/renderer/screenshot.html')
const PRELOAD = join(ROOT, 'out/preload/index.js')

/** 与窗口内容尺寸一致的假显示器（覆盖层按 display 坐标排版，对不上就全是偏移） */
const DISPLAY = { id: 0, x: 0, y: 0, width: 900, height: 600, scaleFactor: 1 }
/** 1×1 红点 PNG，缩放后铺满假显示器足够验图像链路 */
const IMAGE_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let app = null
/** 覆盖层窗口的 webContents id（主进程往里推 capture） */
let shotId = -1

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getShotWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/screenshot\.html/.test(w.url())) return w
      } catch {
        /* 尚未就绪 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `找不到截图覆盖层：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-screenshot-overlay')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })

  // 等覆盖层自己发 SCREENSHOT:ready（onMounted 里挂好监听的信号），再按主进程的姿势推图
  const ready = app.evaluate(
    ({ ipcMain }) =>
      new Promise((resolve) => {
        ipcMain.once('SCREENSHOT:ready', (e) => resolve(e.sender.id))
      })
  )
  await app.evaluate(
    ({ BrowserWindow }, { html, preload, display }) => {
      const win = new BrowserWindow({
        width: display.width,
        height: display.height,
        x: 40,
        y: 40,
        show: true,
        webPreferences: { preload }
      })
      void win.loadFile(html)
    },
    { html: PAGE_HTML, preload: PRELOAD, display: DISPLAY }
  )
  shotId = await ready
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 90_000 })

test('1. 入口页真的 mount 了（有 DOM、有桥、有样式）', async () => {
  const shot = await getShotWindow()
  await expect(shot.locator('.screenshot-capture')).toHaveCount(1)
  // 无图时该在的是模式条：它同时证明 pinia 起来了、且不是「白屏看着像加载过」
  await expect(shot.locator('.capture-mode-bar').first()).toBeVisible()
  expect(await shot.evaluate(() => typeof (window.api?.screenshot?.startCapture ?? null))).toBe(
    'function'
  )
  // 样式确实进了这一页（事故后渲染层曾整片零样式，靠 token 变量解析判）
  expect(
    await shot.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--shot-accent').trim()
    )
  ).not.toBe('')
})

test('2. 推来的图进编辑器，拖选区后工具栏出现且字形解析得出来', async () => {
  const shot = await getShotWindow()
  await app.evaluate(
    ({ webContents }, { id, display, imageUrl }) => {
      webContents.fromId(id)?.send('SCREENSHOT:capture', display, imageUrl)
    },
    { id: shotId, display: DISPLAY, imageUrl: IMAGE_URL }
  )
  await expect(shot.locator('.screenshots-background-image')).toHaveAttribute('src', IMAGE_URL, {
    timeout: 20000
  })

  await shot.mouse.move(120, 120)
  await shot.mouse.down()
  await shot.mouse.move(520, 380, { steps: 8 })
  await shot.mouse.up()

  // 选区画布与工具栏都是 v-if="bounds"：拖不出来就说明选区链路是断的
  await expect(shot.locator('.screenshots-canvas')).toBeVisible({ timeout: 10000 })
  await expect(shot.locator('.screenshots-operations')).toBeVisible()
  // 工具条上至少 8 个按钮（11 个操作件都在，别只渲染出一半）
  await expect
    .poll(async () => shot.locator('.screenshots-button').count())
    .toBeGreaterThanOrEqual(8)
  // 图标字体：类名是恢复出来的 11 个 .icon-*，字形改用 remixicon —— 解析不出来就是空白方块
  const glyph = await shot.evaluate(() => {
    const el = document.querySelector('.icon-rectangle')
    if (!el) return null
    const s = getComputedStyle(el, '::before')
    return {
      family: s.fontFamily,
      // Chromium 把 content 解析成**真字符**（带引号），不是 `"\eb7f"` 那种转义文本
      char: (s.content.match(/^["']([\s\S]*)["']$/) ?? [])[1] ?? '',
      width: el.getBoundingClientRect().width
    }
  })
  expect(glyph, '工具栏里必须有一个 .icon-rectangle').not.toBeNull()
  expect(glyph.family).toContain('remixicon')
  const code = glyph.char.codePointAt(0) ?? 0
  expect(
    code >= 0xe000 && code <= 0xf8ff,
    `content 要落在私有区（实际 U+${code.toString(16)}）：Less 传参会把它吞成空串`
  ).toBe(true)
  // 空 content 的 span 宽 0 —— 这才是用户看到的「按钮上没有图标」
  expect(glyph.width).toBeGreaterThan(0)
})

test('3. 选中工具 → 画一个矩形 → 撤销真的解锁（走的是历史，不是选中态）', async () => {
  const shot = await getShotWindow()
  const rect = shot.locator('.screenshots-button[title="矩形"]')
  const undo = shot.locator('.screenshots-button[title="撤销"]')

  // 起点：还没有任何图形，撤销必须是禁用态
  await expect(undo.first()).toHaveClass(/screenshots-button-disabled/)

  await rect.first().click()
  await expect(rect.first()).toHaveClass(/screenshots-button-checked/)

  // 在选区内画一个矩形（选区是 120,120 → 520,380）
  await shot.mouse.move(200, 200)
  await shot.mouse.down()
  await shot.mouse.move(320, 300, { steps: 6 })
  await shot.mouse.up()

  // 图形进历史 → 撤销解锁。dispatcher 早先取的是 (store as any).dispatcher
  // （永远 undefined），于是 push/setOperation 全是空转，这一步会一直红
  await expect(undo.first()).not.toHaveClass(/screenshots-button-disabled/, { timeout: 8000 })

  await undo.first().click()
  await expect(undo.first()).toHaveClass(/screenshots-button-disabled/)
})
