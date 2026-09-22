/**
 * Leaf · E2E：胶囊窗按显示器记住位置（P-6⑤ 第一格）
 *
 * 两件事分开量：
 *  1. **记住**：用户挪过窗之后，隐藏再唤起要回到挪过的位置，而不是重新居中。
 *     退回改动前（`positionAtCursor()` 每次 show 重算居中）这一条必然红——
 *     判据是「第二次唤起的矩形 ≠ 默认落点且 = 用户挪过的那个」。
 *  2. **能挪**：frameless 窗没有标题栏，搜索行必须真的是拖拽把手；
 *     但把手不能把输入框吃掉（`-webkit-app-region` 覆盖到 input 上就打不了字），
 *     所以 drag / no-drag 的分工要落在计算样式上，而不是「CSS 里写了这两个词」。
 *
 * 用法：先 `npx electron-vite build`，再 `pnpm exec playwright test e2e/capsule-position-memory.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const findCapsule = async () => {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('launcher.html')) return w
      } catch {
        /* 窗口可能已关闭 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `找不到胶囊窗：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        const u = w.url()
        if (/\/index\.html/.test(u) && !/launcher\.html/.test(u)) return w
      } catch {
        /* 尚未就绪 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `找不到主窗：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
}

/**
 * 等显入动画跑完再量（P-6⑤ 的动画会让窗口有 ~90ms 在落点上方 12px 处）。
 * 不等就是拿中间帧当落点断言——那条红不代表记忆坏了。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const settleCapsule = async () => {
  await expect
    .poll(
      async () =>
        app.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Launcher'))
          return win ? win.getOpacity() : -1
        }),
      { timeout: 5000 }
    )
    .toBe(1)
}

/** 胶囊窗自己的矩形 + 它所在显示器的工作区（用来确认「默认落点」确实是居中） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const capsuleGeometry = () =>
  app.evaluate(({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Launcher'))
    if (!win) return null
    const b = win.getBounds()
    const d = screen.getDisplayNearestPoint({ x: b.x + Math.round(b.width / 2), y: b.y + 10 })
    return { bounds: b, workArea: d.workArea, displayId: d.id }
  })

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-capsule-position')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 90000 })

test('1. 搜索行是拖拽把手，但输入框不吃 drag', async () => {
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await findCapsule()
  await expect
    .poll(async () => capsule.evaluate(() => !!document.querySelector('.launcher-search')), {
      timeout: 20000
    })
    .toBe(true)

  const regions = await capsule.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
    const cs = (sel) => {
      const el = document.querySelector(sel)
      // 计算样式里 app-region 的键名各引擎写法不同，两个都读
      const s = el ? getComputedStyle(el) : null
      return s
        ? s.getPropertyValue('-webkit-app-region') || s.getPropertyValue('app-region')
        : 'none'
    }
    return { bar: cs('.launcher-search'), input: cs('.launcher-search-input') }
  })
  expect(regions.bar).toBe('drag')
  expect(regions.input).toBe('no-drag')

  // 「能拖」不能以「不能打字」为代价：真的往输入框里敲一次
  await capsule.locator('.launcher-search-input').click()
  await capsule.keyboard.type('po')
  await expect(capsule.locator('.launcher-search-input')).toHaveValue('po')
})

test('2. 挪过窗之后，隐藏再唤起回到挪过的位置而不是重新居中', async () => {
  const main = await getMainWindow()
  await main.evaluate(() => window.api.launcher.show())
  await findCapsule()

  await settleCapsule()
  const first = await capsuleGeometry()
  expect(first).not.toBeNull()
  // 默认落点：水平居中（±1px 容差给 round）
  expect(
    Math.abs(first.bounds.x - (first.workArea.x + (first.workArea.width - first.bounds.width) / 2))
  ).toBeLessThanOrEqual(1)

  const moved = {
    x: first.workArea.x + 40,
    y: first.workArea.y + 30,
    width: first.bounds.width,
    height: first.bounds.height
  }
  await app.evaluate(({ BrowserWindow }, m) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Launcher'))
    win.setBounds(m)
  }, moved)
  // 写库是攒一下的（拖拽连发），等过 debounce 再隐藏
  await new Promise((r) => setTimeout(r, 900))

  await main.evaluate(() => window.api.launcher.hide())
  await new Promise((r) => setTimeout(r, 300))
  await main.evaluate(() => window.api.launcher.show())
  await settleCapsule()
  const back = await capsuleGeometry()
  expect(back.bounds).toEqual(moved)
  // 这条断言才是「记住」而不是「夹回界内」：默认落点在正中间，两者必须不同
  expect(back.bounds.x).not.toBe(first.bounds.x)
})
