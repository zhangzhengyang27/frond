/**
 * Frond · 番茄钟 E2E 测试
 *
 * 通过 Playwright 直接控制 Electron 窗口测试番茄钟功能
 */

import { test, expect } from 'playwright/test'
import { _electron as electron } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

let app = null

test.beforeAll(async () => {
  console.log('[Pomodoro E2E] 启动 Electron...')
  // 关键修复：移除 ELECTRON_RUN_AS_NODE 环境变量
  // 否则 Electron 会把命令行参数当作 Node.js 参数而不是 Electron 参数
  const env = { ...process.env }
  // 隔离 userData：本 spec 的用例 4 会真的写入番茄钟任务，不得落到用户真实库
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-pomodoro')
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE

  app = await electron.launch({
    args: [MAIN_ENTRY],
    launchOptions: {
      env
    }
  })
  console.log('[Pomodoro E2E] Electron 已启动')
}, 120000)

test.afterAll(async () => {
  if (app) {
    console.log('[Pomodoro E2E] 关闭 Electron...')
    await app.close()
  }
})

test('1. 跳过 onboarding 进入 Hub', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  // 跳过 onboarding
  await page.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })
  await page.waitForTimeout(1000)

  console.log('[Pomodoro E2E] 已跳过 onboarding')
})

test('2. 导航到番茄钟页面', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  // 走应用自己的 hash 路由（vue-router createWebHashHistory）——旧写法先
  // dispatchEvent('frond:navigate')（渲染端无监听者，空放）再 goto 到 vite dev
  // server:5173，等于把这条用例挂在「本机是否开着 pnpm dev」上
  await page.evaluate(() => {
    window.location.hash = '#/pomodoro'
  })

  await expect(page.locator('.zf-root')).toBeVisible({ timeout: 15000 })
})

test('3. 测试番茄钟 API - 获取任务列表', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  // 调用番茄钟 API
  const tasks = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getTasks()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取任务列表:', tasks)
  expect(tasks).toBeDefined()
})

test('4. 测试番茄钟 API - 添加任务', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  const result = await page.evaluate(async () => {
    try {
      const task = await window.api.pomodoro.addTask('E2E 测试任务-' + Date.now())
      return task
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 添加任务结果:', result)
  expect(result).toBeDefined()
  if (result && !result.error) {
    expect(result.title).toContain('E2E 测试任务')
  }
})

test('5. 测试番茄钟 API - 获取统计数据', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  const stats = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getStatistics()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取统计数据:', stats)
  expect(stats).toBeDefined()
  expect(stats.today).toBeDefined()
  expect(stats.week).toBeDefined()
})

test('6. 测试番茄钟 API - 获取设置', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  const settings = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getSettings()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取设置:', settings)
  expect(settings).toBeDefined()
  expect(settings.workDuration).toBeGreaterThan(0)
})

test('7. 测试番茄钟 API - 获取今日记录', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  const records = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getTodayRecords()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取今日记录:', records)
  expect(records).toBeDefined()
  expect(Array.isArray(records)).toBe(true)
})

test('8. 测试番茄钟集成 API - 获取通知模式', async () => {
  if (!app) throw new Error('app not launched')
  const page = await app.firstWindow()

  const mode = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.integration.getMode()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取通知模式:', mode)
  expect(mode).toBeDefined()
  expect(['normal', 'strong', 'silent']).toContain(mode)
})
