/**
 * Leaf · E2E：胶囊显/隐动画（P-6⑤）
 *
 * 动画本身不好断言（帧是 15ms 的事），但有三条**能被观察的因果**是硬要求：
 *  1. `show()` 不能被动画拖慢——窗口在动画第一帧之前就已经可见（性能基线里
 *     热唤起 < 200ms 那条预算也不该被这格吃掉）；
 *  2. 动画必须**落到位**：不透明度最终回到 1，矩形最终正好是落点（停在半路比没动画更糟）；
 *  3. 隐藏是「淡出后再真 hide」：IPC 返回那一刻窗口还在，几十毫秒后才消失。
 *
 * 第 1、3 条依赖系统「减弱动态效果」：开着的时候产品就该瞬现瞬隐，
 * 所以先读系统设置，动画断言按它分支——不是把断言写成永远为真。
 *
 * 用法：先 `npx electron-vite build`，再 `pnpm exec playwright test e2e/capsule-animation.spec.mjs`
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const capsuleState = () =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Launcher'))
    if (!win) return null
    return { visible: win.isVisible(), opacity: win.getOpacity(), bounds: win.getBounds() }
  })

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-capsule-animation')
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

test('1. 动画不拖慢唤起，且一定落到位', async () => {
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  const reduced = await app.evaluate(({ systemPreferences }) =>
    systemPreferences.getAnimationSettings()
  )
  const animated =
    (process.platform === 'darwin' || process.platform === 'win32') && !reduced.prefersReducedMotion

  const t0 = Date.now()
  await main.evaluate(() => window.api.launcher.show())
  // ① show 的 IPC 回来时窗口已经可见（动画是在可见之后推的，不是先藏起来再放）
  expect(Date.now() - t0).toBeLessThan(1500)
  expect((await capsuleState()).visible).toBe(true)
  await findCapsule()

  // ② 不透明度最终是 1，且矩形与落点一致（动画没有把窗口留在半路）
  await expect.poll(async () => (await capsuleState())?.opacity ?? -1, { timeout: 3000 }).toBe(1)
  const st = await capsuleState()
  const work = await app.evaluate(
    ({ screen }) => screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  )
  expect(st.bounds.width).toBe(750)
  expect(st.bounds.x).toBe(Math.round(work.x + (work.width - 750) / 2))
  if (animated) {
    // 淡入确实跑过：动画期间至少有一刻不透明度 < 1。
    // **必须在主进程里采样**——从测试侧每次 getOpacity 都是一个 IPC 往返，
    // 整套用例并跑时机器忙，90ms 的动画能一次都没采到（实测单跑绿、套跑红）。
    await main.evaluate(() => window.api.launcher.hide())
    await new Promise((r) => setTimeout(r, 400))
    const sampling = app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Launcher'))
      if (!win) return -1
      return new Promise((resolve) => {
        let min = 1
        const t0 = Date.now()
        const id = setInterval(() => {
          min = Math.min(min, win.getOpacity())
          if (Date.now() - t0 > 600) {
            clearInterval(id)
            resolve(min)
          }
        }, 4)
      })
    })
    const showP = main.evaluate(() => window.api.launcher.show())
    const minOpacity = await sampling
    await showP
    expect(minOpacity).toBeLessThan(1)
    await expect.poll(async () => (await capsuleState())?.opacity ?? -1, { timeout: 3000 }).toBe(1)
  }
})

test('2. 隐藏是淡出后才真的 hide（不是瞬隐）', async () => {
  const reduced = await app.evaluate(({ systemPreferences }) =>
    systemPreferences.getAnimationSettings()
  )
  const animated =
    (process.platform === 'darwin' || process.platform === 'win32') && !reduced.prefersReducedMotion
  await getMainWindow()
  const main = await getMainWindow()
  await main.evaluate(() => window.api.launcher.show())
  await findCapsule()
  await new Promise((r) => setTimeout(r, 300))

  await main.evaluate(() => window.api.launcher.hide())
  if (animated) expect((await capsuleState()).visible).toBe(true)
  await expect
    .poll(async () => (await capsuleState())?.visible ?? true, { timeout: 2000 })
    .toBe(false)
})

/**
 * 3. 改高度不许掐断在飞的淡出 / 淡入（P-6⑤ 审查轮）
 *
 * 收窗（Compact Mode、参数槽态）与显隐用的是同一根动画计时器。旧写法在改高之前
 * 无条件 stopAnim()，于是淡出被掐断 = `finishHide()` 永远不执行：
 * 窗停在 opacity 0 的「可见」态——看着像消失了，其实还占着焦点、关不掉，
 * 插件也收不到 onHide。这类状态用眼睛看不出来，只能把两个 IPC 挤进同一帧窗口里量。
 */
test('3. 淡出/淡入在飞时来一次改高：淡出仍要真 hide，淡入仍要落到 opacity 1', async () => {
  const reduced = await app.evaluate(({ systemPreferences }) =>
    systemPreferences.getAnimationSettings()
  )
  const animated =
    (process.platform === 'darwin' || process.platform === 'win32') && !reduced.prefersReducedMotion
  // 减弱动态效果开着就没有淡出可掐，断言会恒真——那种环境下这条不成立，直接跳过
  test.skip(!animated, '系统开着「减弱动态效果」：瞬现瞬隐，没有动画可打断')
  const main = await getMainWindow()

  // ① 淡出在飞 + 改高 → 仍然必须真的 hide
  await main.evaluate(() => window.api.launcher.show())
  await findCapsule()
  await new Promise((r) => setTimeout(r, 400))
  await main.evaluate(async () => {
    await window.api.launcher.hide()
    await window.api.launcher.setCompact(true, 120)
  })
  await expect
    .poll(async () => (await capsuleState())?.visible ?? true, { timeout: 3000 })
    .toBe(false)

  // ② 淡入在飞 + 改高 → 不透明度仍要落到 1，且那次改高没被丢掉（补做到了位）
  await main.evaluate(async () => {
    await window.api.launcher.show()
    await window.api.launcher.setCompact(true, 140)
  })
  await findCapsule()
  await expect.poll(async () => (await capsuleState())?.opacity ?? -1, { timeout: 3000 }).toBe(1)
  await expect
    .poll(async () => (await capsuleState())?.bounds.height ?? -1, { timeout: 3000 })
    .toBe(140)

  await main.evaluate(() => window.api.launcher.setCompact(false, 520))
})
