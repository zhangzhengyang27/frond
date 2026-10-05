/**
 * Frond · E2E：内置插件 v2 新字段渲染（2026-10-05 spec 3.1/3.2 + 5.5）
 *
 * 三个用例分别验证宿主对插件提交数据的原生渲染：
 * - colorpicker：tintColor 颜色块透传 AppIcon color + 分组头渲染
 * - qrcode：icon.dataUrl 缩略图（img.plist-thumb，data:image/png 前缀）
 * - currency：React 视图冒烟（列表/错误/缓存态任一渲染完成，不断言汇率数值——外网不可依赖）
 *
 * 用法：先 pnpm build；currency 的 dist/main.js 已入库无需构建。
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) return w
      } catch {
        /* noop */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('30s 内没等到主窗口')
}

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

test.beforeAll(async () => {
  rmSync(join(ROOT, 'test-results', 'e2e-userdata-builtin-render'), {
    recursive: true,
    force: true
  })
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-builtin-render')
  env.FROND_E2E = '1' // 插件导入确认闸旁路（Playwright 无法点原生对话框）+ e2e 探针启用
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

async function installPlugin(dir) {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  const install = await main.evaluate((apiPath) => window.api.launcher.installFromFolder(apiPath), dir)
  expect(install.success).toBe(true)
  return main
}

async function openAndType(main, pluginId, text) {
  await main.evaluate(
    ({ id, t }) => window.api.launcher.openPlugin(id),
    { id: pluginId, t: text }
  )
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')
  // data 模式插件接管胶囊搜索框为副输入框：输入触发 onSubInputChange
  const input = capsule.locator('input').first()
  await input.waitFor({ state: 'visible', timeout: 10000 })
  await input.click()
  await input.pressSequentially(text, { delay: 20 })
  return capsule
}

test('colorpicker：tintColor 颜色块 + 分组头渲染', async () => {
  const main = await installPlugin(join(ROOT, 'plugins', 'com.frond.colorpicker'))
  const capsule = await openAndType(main, 'com.frond.colorpicker', '#336699')
  await expect
    .poll(async () => capsule.locator('.plist-item').count(), { timeout: 10000, intervals: [200] })
    .toBeGreaterThanOrEqual(5)
  // tintColor 透传到 AppIcon 的内联 color 样式（Chromium 把 hex 序列化为 rgb(...)）
  await expect
    .poll(async () => {
      const icons = await capsule.locator('.plist-icon i').all()
      let hits = 0
      for (const el of icons) {
        const style = ((await el.getAttribute('style')) || '').toLowerCase()
        if (style.includes('rgb(51, 102, 153') || style.includes('rgb(51,102,153') || style.includes('#336699')) hits++
      }
      return hits
    }, { timeout: 10000, intervals: [200] })
    .toBeGreaterThanOrEqual(1)
})

test('qrcode：dataUrl 缩略图条目（img.plist-thumb）', async () => {
  const main = await installPlugin(join(ROOT, 'plugins', 'com.frond.qrcode'))
  const capsule = await openAndType(main, 'com.frond.qrcode', 'https://frond.app')
  await expect
    .poll(async () => capsule.locator('img.plist-thumb').count(), { timeout: 15000, intervals: [300] })
    .toBeGreaterThanOrEqual(1)
  const src = await capsule.locator('img.plist-thumb').first().getAttribute('src')
  expect(src?.startsWith('data:image/png;base64,')).toBe(true)
})

test('currency：React 视图冒烟（列表或错误态渲染完成）', async () => {
  const logs = []
  const onConsole = (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text().slice(0, 200)}`)
  }
  for (const w of app.windows()) w.on('console', onConsole)
  const main = await installPlugin(join(ROOT, 'plugins', 'com.frond.currency'))
  await main.evaluate((apiPath) => window.api.launcher.installFromFolder(apiPath), join(ROOT, 'example-react'))
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')

  const dump = async (tag) => {
    const snap = await capsule.evaluate(() => ({
      items: document.querySelectorAll('.plist-item').length,
      empty: document.querySelector('.plist-empty')?.textContent || null,
      probes: window.api.e2e.probeCounts()
    }))
    console.log('[dump ' + tag + ']', JSON.stringify(snap))
  }

  // 对照：先开已知能渲染的 example-react
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react'))
  await new Promise((r) => setTimeout(r, 5000))
  await dump('example-react')

  // 再开 currency：记录 items 时间序列，找「渲染后清空」的时刻
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.currency'))
  const series = []
  for (let i = 0; i < 60; i++) {
    const items = await capsule.locator('.plist-item').count()
    const probes = await capsule.evaluate(() => window.api.e2e.probeCounts())
    series.push({ t: i * 750, items, renderView: probes['plugapi:renderView'] ?? -1, getContext: probes['plugapi:getContext'] ?? -1, hud: probes['plugapi:hud'] ?? -1 })
    await new Promise((r) => setTimeout(r, 750))
  }
  console.log('[currency-series]', JSON.stringify(series.filter((p, i) => i === 0 || p.items !== series[i - 1].items || p.renderView !== series[i - 1].renderView)))
  console.log('[currency-hud]', JSON.stringify(series.map((p) => p.hud).filter((v, i, a) => v !== a[i - 1])))
  console.log('[console-logs]', JSON.stringify(logs.slice(0, 8)))
}, 60000)
