/**
 * Leaf · E2E：胶囊玻璃档（P-6 浅色纯白那一格）
 *
 * 量的是胶囊根面板的**计算样式**，三件事缺一不可：
 *  1. 默认档必须与改动前完全一致（底色 alpha = 1、模糊为 blur(0px)）——
 *     这一格是加可选项，不是顺手改所有人的观感；
 *  2. 选「半透明」后底色真的带 alpha、模糊真的生效（而不是只存了个偏好值）；
 *  3. 切回「不透明」要**回到第 1 步那两个值**（改档靠推送生效，不是只在内存里记了一个值）。
 *
 * 断言只吃 alpha 数值，不吃颜色的字符串写法：Chromium 把 color-mix() 算成
 * `color(srgb 1 1 1 / 0.92)`，硬写 rgba 正则会假失败（见 alphaOf 注释）。
 *
 * 用法：先 `pnpm build`，再 `pnpm exec playwright test e2e/capsule-glass.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) return w
      } catch {
        /* 窗口可能已关闭 */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `找不到主窗，现有窗口：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
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

/**
 * 从计算色里取 alpha（没有 alpha 通道 = 1）。
 *
 * Chromium 把 `color-mix(in srgb, #ffffff 92%, transparent)` 算成
 * `color(srgb 1 1 1 / 0.92)` 而不是 `rgba(...)`——只认 rgba 的写法会在产品没错时假失败。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const alphaOf = (cssColor) => {
  const slash = /\/\s*([\d.]+)\s*\)?$/.exec(cssColor)
  if (slash) return Number(slash[1])
  const inner = /^[a-z]+\((.*)\)$/.exec(cssColor)?.[1]
  if (inner?.includes(',')) {
    const parts = inner.split(',').map((p) => p.trim())
    if (parts.length >= 4) return Number(parts[3])
  }
  return 1
}

/** 胶囊根元素（.launcher）的底色与模糊 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const readGlass = (capsule) =>
  capsule.evaluate(() => {
    const el = document.querySelector('.launcher')
    if (!el) return null
    const cs = getComputedStyle(el)
    return { bg: cs.backgroundColor, blur: cs.backdropFilter }
  })

/** 改档走设置页的按钮（不是直接调 API）：控件本身也要接上 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const pickGlass = async (main, value) => {
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await main.getByRole('button', { name: '启动器' }).first().click()
  await main.getByText('胶囊透明度').first().waitFor({ timeout: 15000 })
  await main.locator(`[data-glass-opt="${value}"]`).click()
  await expect
    .poll(async () => main.evaluate(() => window.api.preferences.getCapsuleGlass()), {
      timeout: 10000
    })
    .toBe(value)
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-capsule-glass')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('1. 默认档与改动前一致；切半透明再切回来，计算样式要回到原值', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  expect(await main.evaluate(() => window.api.preferences.getCapsuleGlass())).toBe('opaque')

  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  // 胶囊窗可能还在加载（getCapsuleWindow 只看 URL），先 poll 到根元素在再取值，
  // 否则同一份代码会时好时坏地报「胶囊根元素没找到」
  await expect.poll(async () => (await readGlass(capsule)) !== null, { timeout: 15000 }).toBe(true)
  const before = await readGlass(capsule)
  // 不透明档：底色是实色（alpha 1），模糊为零
  // （浅色 token 是 --launcher-blur: blur(0)，计算值就是 blur(0px)，不是 none——
  //   断言写成 'none' 会在产品没变的情况下假失败）
  expect(alphaOf(before.bg)).toBe(1)
  expect(['none', 'auto', 'blur(0px)']).toContain(before.blur)

  await pickGlass(main, 'soft')
  // 推送过来了，但底色要等样式重算；poll 到变了为止
  let soft = before
  await expect
    .poll(async () => {
      soft = await readGlass(capsule)
      return soft.bg !== before.bg || soft.blur !== before.blur
    })
    .toBe(true)
  expect(alphaOf(soft.bg)).toBeCloseTo(0.92, 2)
  expect(soft.blur).toMatch(/^blur\((1[0-9]|2[0-9]|3[0-9])px\)$/)

  await pickGlass(main, 'opaque')
  let back = soft
  await expect
    .poll(async () => {
      back = await readGlass(capsule)
      return back.bg === before.bg && back.blur === before.blur
    })
    .toBe(true)
})

test('2. 通透档比半透明更透', async () => {
  if (!app) throw new Error('app not launched')
  const main = await getMainWindow()
  const capsule = await getCapsuleWindow()
  if (!capsule)
    throw new Error(
      `找不到胶囊窗，现有窗口：${app
        .windows()
        .map((w) => w.url())
        .join(' | ')}`
    )
  await expect.poll(async () => (await readGlass(capsule)) !== null, { timeout: 15000 }).toBe(true)
  const opaque = await readGlass(capsule)
  await pickGlass(main, 'clear')
  let clear = null
  await expect
    .poll(async () => {
      clear = await readGlass(capsule)
      return alphaOf(clear.bg) < 0.9
    })
    .toBe(true)
  expect(alphaOf(clear.bg)).toBeCloseTo(0.78, 2)
  expect(clear.blur).toMatch(/blur\(2[0-9]px\)$/)
  // 档位之间必须是「更透」而不是换个颜色：通透 < 半透明 < 不透明
  expect(alphaOf(clear.bg)).toBeLessThan(alphaOf(opaque.bg))
})
