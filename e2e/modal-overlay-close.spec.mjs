/**
 * Frond · E2E 弹窗/抽屉外点关闭回归钉（B61d）
 *
 * 背景：UModal/UDrawer 曾把 @click.self 挂在外层容器上，而真正的点击目标永远是
 * 铺满容器的遮罩背景子 div —— .self 永不命中，全 App 弹窗点外面关不掉。
 * 另：面板内按钮的 handler 可能在同一次点击派发里改掉 DOM（如 v-if 卸载），
 * contains() 查活体 DOM 会误判为外点 —— 守卫必须用派发时固定的 composedPath。
 *
 * 钉住三件事：
 * 1. UModal：外点关闭、面板内点击不误关
 * 2. UDrawer：外点关闭
 * 3. 计时环 svg 类名必须是 zf-arc 且无 box-shadow ——
 *    曾因 class="ring" 撞上 TW4 全局工具类 .ring（0 0 0 1px currentcolor 方框）
 *    在环外渲染出 1px 墨色方框（用户两轮「黑色边框」投诉的真凶）
 *
 * 用法：先 pnpm build，再 pnpm exec playwright test e2e/modal-overlay-close.spec.mjs
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const USER_DATA = join(ROOT, 'test-results', 'modal-overlay-close-userdata')

let app = null
let page = null

const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) return w
      } catch {
        // 窗口可能已关闭
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('30s 内没等到主窗口')
}

const dialogCount = () =>
  page.evaluate(() => document.querySelectorAll('[role="dialog"]').length)

/** 点窗口左缘的遮罩区（弹窗面板居中，左缘一定是外点） */
const clickOutside = async () => {
  const h = await page.evaluate(() => document.documentElement.clientHeight)
  await page.mouse.click(12, Math.round(h / 2))
}

/** 走 UI 真实链路建「项目+任务」，返回是否成功 */
const createTaskWithProjectViaUI = async () => {
  await page.getByRole('button', { name: /新建任务/ }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.locator('[role="dialog"] input[type="text"]').first().fill('回归钉任务')
  await page.locator('[role="dialog"] .link-btn').first().click()
  await page.locator('[role="dialog"] .new-project input').fill('回归钉项目')
  await page.locator('[role="dialog"] .new-project button.btn--ghost').click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await page.waitForTimeout(800)
  return page.evaluate(() => document.querySelectorAll('.task-row').length > 0)
}

test.beforeAll(async () => {
  rmSync(USER_DATA, { recursive: true, force: true })
  const env = { ...process.env, FROND_USER_DATA_DIR: USER_DATA }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  page = await getMainWindow()
  await page.getByText('跳过引导').first().click({ timeout: 30000 })
  await page.evaluate(async () => {
    await window.api.preferences.setOnboardingCompleted()
    window.location.hash = '#/pomodoro'
  })
  await page.waitForTimeout(2000)
})

test.afterAll(async () => {
  await app?.close()
})

test('计时环 svg 类名 zf-arc 且无 box-shadow（TW4 .ring 工具类碰撞钉）', async () => {
  const r = await page.evaluate(() => {
    const arc = document.querySelector('.zf-arc')
    const wrap = document.querySelector('.ring-wrap')
    if (!arc || !wrap) return null
    return {
      arcShadow: getComputedStyle(arc).boxShadow,
      wrapShadow: getComputedStyle(wrap).boxShadow,
      strayRing: document.querySelectorAll('svg.ring').length
    }
  })
  expect(r, '.zf-arc / .ring-wrap 未渲染').not.toBeNull()
  expect(r.arcShadow, 'svg 上出现 box-shadow = 又撞上 TW4 工具类了').toBe('none')
  expect(r.wrapShadow).toBe('none')
  expect(r.strayRing, 'svg 不允许再叫 .ring').toBe(0)
})

test('UModal 新建任务弹窗：外点关闭、内点不误关', async () => {
  await page.getByRole('button', { name: /新建任务/ }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  expect(await dialogCount(), '弹窗未打开').toBe(1)

  // 面板内点击（标题输入框）不误关
  await page.locator('[role="dialog"] input[type="text"]').first().click()
  await page.waitForTimeout(300)
  expect(await dialogCount(), '面板内点击把弹窗关了').toBe(1)

  // 外点关闭
  await clickOutside()
  await page.waitForTimeout(400)
  expect(await dialogCount(), '外点后弹窗未关闭').toBe(0)
})

test('UModal 面板内 v-if 卸载型按钮（新建项目→确定）不误触外点关闭', async () => {
  await page.getByRole('button', { name: /新建任务/ }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.locator('[role="dialog"] .link-btn').first().click()
  await page.locator('[role="dialog"] .new-project input').fill('回归钉项目')
  // 确定的 handler 会把 .new-project v-if 卸载——contains() 守卫在此误判外点
  await page.locator('[role="dialog"] .new-project button.btn--ghost').click()
  await page.waitForTimeout(400)
  expect(await dialogCount(), '面板内「确定」把弹窗关了（composedPath 守卫回归）').toBe(1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect(await dialogCount()).toBe(0)
})

test('UDrawer 任务详情抽屉：外点关闭', async () => {
  // 前置：清单里至少有一个任务（用 UI 建走真实链路：项目+任务）
  let ok = await page.evaluate(() => document.querySelectorAll('.task-row').length > 0)
  if (!ok) ok = await createTaskWithProjectViaUI()
  expect(ok, 'UI 建项目+任务失败，清单仍为空').toBe(true)

  await page.locator('.task-row .row-btn[title="查看详情"]').first().click()
  await page.waitForTimeout(700)
  const opened = await page.evaluate(() => {
    const el = document.querySelector('.drawer-header')
    return !!el && el.getBoundingClientRect().width > 0
  })
  expect(opened, '抽屉未打开').toBe(true)

  await clickOutside()
  await page.waitForTimeout(500)
  const closed = await page.evaluate(() => {
    const el = document.querySelector('.drawer-header')
    return !el || el.getBoundingClientRect().width === 0
  })
  expect(closed, '外点后抽屉未关闭').toBe(true)
})
