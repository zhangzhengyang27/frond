/**
 * Leaf · E2E：截图改由 electron-screenshots 接管（HANDOFF §11）
 *
 * 要钉住的四件事，缺一不可：
 *  1. `registerScreenshotHandlers()` 真的在启动序列里被调用（此前它全仓零调用方，
 *     于是 `screenshot:startCapture` 从来没注册过 —— 热键与按钮都是空响）；
 *  2. 起的是**上游那一层**（页面来自 react-screenshots 的预构建产物，不是我们那份移植副本），
 *     而且我们传进去的中文文案真的到了工具栏；
 *  3. 拖选 + 点「确定」之后图**落到截图库扫得到的目录并被索引到** —— 这条正是自研那套
 *     断掉的地方（它存 userData/screenshots，而 shot_index 只扫桌面 + 系统截图位置）；
 *  4. 点「取消」不落盘（否则每次 esc 都会往库里塞一张废图）。
 *
 * 用法：先 `npx electron-vite build`，再
 *   pnpm exec playwright test e2e/screenshot-upstream.spec.mjs
 * 前置：本机的屏幕录制授权要给到这个 Electron 二进制；没授权时第 1 步就失败，
 * 断言里直接把这条原因写出来，不拿它冒充「功能正常」。
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync, mkdirSync, readdirSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const SHOT_DIRS = join(ROOT, 'test-results', 'shot-dirs-screenshot-upstream')

let app = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const pages = () => {
  const out = []
  for (const w of app.windows()) {
    try {
      out.push(w.url())
    } catch {
      /* 尚未就绪 */
    }
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const u of pages()) {
      if (/index\.html/.test(u) && !/launcher\.html/.test(u) && !/screenshots/.test(u)) {
        return app.windows().find((w) => w.url() === u)
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`找不到主窗：${pages().join(' | ')}`)
}

/**
 * 覆盖层是「无边框窗 + legacy BrowserView」。上游用 `setBrowserView()` 挂上去，
 * Playwright 会把这个 view 的 webContents 一并列进 `electronApp.windows()`，
 * 所以直接拿它当 Page 用（能拖选、能点按钮），不必从主进程侧绕。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getOverlay = async () => {
  await expect
    .poll(() => pages().filter((u) => u.includes('react-screenshots')).length, {
      timeout: 20000,
      message: '覆盖层没起来：先确认本机屏幕录制授权给这个 Electron 二进制'
    })
    .toBeGreaterThan(0)
  return app.windows().find((w) => w.url().includes('react-screenshots'))
}

/**
 * 拖出一个选区：没有选区时工具栏不渲染，「确定」也就点不到。
 * 先等放大镜出现（`坐标:` 那条）再按下 —— 探针实测：capture 刚发出就 mousedown，
 * react-screenshots 还没接上图，选区起点会整个丢掉（只剩放大镜，没有尺寸）。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const selectRegion = async (overlay) => {
  // 放大镜（`坐标:` 来自我们传的 lang）出现 = 图已接上，可以按下了。
  // 每个轮询周期都要重发一次 mousemove：上一轮截图 endCapture 之后，页面要的是
  // **新的** mousemove 才刷新放大镜，光等不动手会一直读到空 body
  await expect
    .poll(
      async () => {
        await overlay.mouse.move(290, 290)
        await overlay.mouse.move(300, 300)
        return overlay.evaluate(() => document.body.innerText)
      },
      { timeout: 15000 }
    )
    .toMatch(/坐标:/)
  await overlay.mouse.down()
  await overlay.mouse.move(620, 480, { steps: 8 })
  await overlay.mouse.up()
  await expect
    .poll(() => overlay.evaluate(() => document.body.innerText), { timeout: 10000 })
    .toContain('320 × 180')
  return overlay.evaluate(() =>
    [...document.querySelectorAll('[title]')].map((el) => el.getAttribute('title'))
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const shotIndexTotal = async () => {
  const main = await getMainWindow()
  // 必须 await 再取字段：`status().total` 是在 Promise 上取属性，只会得到 undefined
  return main.evaluate(async () => (await window.api.shotIndex.status()).total)
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-screenshot-upstream')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  // 落盘目录与索引扫描目录一起换到 test-results 下：既不往真实桌面写图，
  // 也让「总量 > 0」只可能由这一次落盘贡献（空目录起步，反例天然成立）
  env.LEAF_SHOT_DIRS = SHOT_DIRS
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  rmSync(SHOT_DIRS, { recursive: true, force: true })
  mkdirSync(SHOT_DIRS, { recursive: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 120000 })

test('1. handler 真的注册上了（startCapture 不再报 No handler registered）', async () => {
  const main = await getMainWindow()
  const res = await main.evaluate(() => window.api.screenshot.startCapture())
  expect(res, JSON.stringify(res)).toEqual({ success: true })
})

test('2. 起来的是上游那一层（react-screenshots 的预构建页）', async () => {
  const overlay = await getOverlay()
  expect(overlay.url()).toContain('react-screenshots/dist/electron.html')
})

test('3. 拖选 + 点「确定」：图落进截图库扫得到的目录，并被索引到', async () => {
  const overlay = await getOverlay()
  const titles = await selectRegion(overlay)
  // 全部 11 个：这条同时证明 `lang` 选项真的送到了预构建页（缺省是英文）
  expect(titles).toEqual(
    expect.arrayContaining([
      '矩形',
      '椭圆',
      '箭头',
      '画笔',
      '文本',
      '马赛克',
      '撤销',
      '重做',
      '保存',
      '取消',
      '确定'
    ])
  )
  await overlay.getByTitle('确定').click()

  await expect.poll(shotIndexTotal, { timeout: 30000 }).toBeGreaterThan(0)

  // 正例 + 反例成对：只断「搜得到」的话，「搜索永远返回全部」那类 bug 也会通过
  const main = await getMainWindow()
  const ours = await main.evaluate(() => window.api.shotIndex.search('name:Leaf-'))
  expect(ours.success).toBe(true)
  expect(ours.items.length, '按 name:Leaf- 过滤后一条都没有，说明查询没真生效').toBeGreaterThan(0)
  expect(ours.items.every((r) => r.filePath.includes('Leaf-'))).toBe(true)

  const none = await main.evaluate(() => window.api.shotIndex.search('name:zzz-绝对不存在-xyz'))
  expect(none.items).toEqual([])

  // 文件真的在那个目录里（而不只是 DB 里有一行）
  expect(readdirSync(SHOT_DIRS).filter((n) => n.startsWith('Leaf-')).length).toBeGreaterThan(0)
})

test('4. 点「取消」不落盘', async () => {
  const before = readdirSync(SHOT_DIRS).filter((n) => n.startsWith('Leaf-')).length
  const main = await getMainWindow()
  expect(await main.evaluate(() => window.api.screenshot.startCapture())).toEqual({
    success: true
  })
  const overlay = await getOverlay()
  await selectRegion(overlay)
  await overlay.getByTitle('取消').click()
  // 给上游走完 endCapture 的时间；不写文件是因为我们的 handler 没挂 cancel ——
  // 这条防的是以后有人「顺手在 cancel 里也存一张」，那样每次 esc 都往库里塞废图
  await new Promise((r) => setTimeout(r, 2000))
  expect(readdirSync(SHOT_DIRS).filter((n) => n.startsWith('Leaf-')).length).toBe(before)
})
