/**
 * Frond · 番茄钟 E2E 测试
 *
 * 通过 Playwright 直接控制 Electron 窗口测试番茄钟功能。
 *
 * ══════════════════════════════════════════════════════════════════════
 * 本文件原先有**两层**假绿，2026-09-23 一并修掉：
 *
 * 【第一层：测错了窗口】
 * 原来 8 条用例都用 `app.firstWindow()`。但 `firstWindow()` 返回的是**第一个
 * 被创建的**窗口，而本应用启动时会先冒出 `electron-screenshots` 上游库的截图
 * 覆盖层窗口（`react-screenshots/dist/electron.html`，title "Rsbuild App"），
 * 它没有 preload 注入的 `window.api`。
 *
 * 也就是说：这条 spec 从诞生起，8 条断言**全部对着一个与番茄钟毫无关系的
 * 第三方覆盖层页面**跑。其他 spec 早已统一改用 `getMainWindow()`（见
 * launch-smoke / density），只有本文件漏改。
 *
 * 【第二层：断言放过了失败】
 * 每条的写法都是
 *     const r = await page.evaluate(async () => {
 *       try { return await window.api.xxx() } catch (e) { return { error: e.message } }
 *     })
 *     expect(r).toBeDefined()
 * 在选错窗口的前提下，`window.api` 是 undefined，每条 IPC 都抛
 * `Cannot read properties of undefined`，被 catch 吞成 `{ error }` ——
 * 而 `{ error: '...' }` 同样 `toBeDefined()`。两层叠加的结果是：
 * **8 条全绿，实际覆盖率为零。**
 *
 * 现在：窗口按 url 精确选主窗口（选不到直接抛错，不再回退到 firstWindow），
 * 断言统一走 `expectIpcOk()` 先卡掉 error 再校验返回形状。
 * ══════════════════════════════════════════════════════════════════════
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
let mainPage = null

/**
 * 取主窗口。
 *
 * 按 url 精确匹配 `out/renderer/index.html` —— 不用 title，因为胶囊窗的 title
 * 是 "Frond Launcher"，同样匹配 `/Frond/`，窗口创建顺序一变就会选错。
 *
 * 刻意**不**回退到 `app.firstWindow()`：那个 fallback 正是本文件原来的病根，
 * 找不到主窗口就应该响亮地失败。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getMainWindow = async () => {
  if (mainPage && !mainPage.isClosed()) return mainPage

  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/\/index\.html/.test(w.url())) {
          mainPage = w
          return w
        }
      } catch {
        // 窗口可能已关闭
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('30s 内没等到主窗口（out/renderer/index.html）')
}

/**
 * 「IPC 必须成功」前置断言 —— 返回原值方便继续断言形状。
 *
 * 单列一个 helper 而不是每条重复两行，是为了让「调用失败」和「返回形状不对」
 * 在失败信息里一眼可辨：前者说明通道/主进程有问题，后者说明契约漂了。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
function expectIpcOk(res, label) {
  expect(res, `${label}：IPC 没有返回`).toBeDefined()
  expect(res?.error, `${label}：IPC 报错`).toBeUndefined()
  return res
}

test.beforeAll(async () => {
  console.log('[Pomodoro E2E] 启动 Electron...')
  // 关键修复：移除 ELECTRON_RUN_AS_NODE 环境变量
  // 否则 Electron 会把命令行参数当作 Node.js 参数而不是 Electron 参数
  const env = { ...process.env }
  // 隔离 userData：本 spec 的用例 4 会真的写入番茄钟任务，不得落到用户真实库
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-pomodoro')
  env.FROND_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE

  // env 必须是**顶层**选项（HANDOFF §5）。Playwright 的 Electron.launch 实现是
  // `const env = options.env ? envArrayToObject(options.env) : process.env`
  // —— 写成 `launchOptions: { env }` 时上面那两条覆盖会被**静默丢弃**，
  // 回退到 playwright.config.mjs 设的公共 e2e-userdata，本 spec 的独立目录形同虚设。
  app = await electron.launch({
    args: [MAIN_ENTRY],
    env
  })
  console.log('[Pomodoro E2E] Electron 已启动')

  // 预热：把主窗口解析出来（同时把「窗口还没起来」这段等待挪出用例计时）
  await getMainWindow()
}, 120000)

test.afterAll(async () => {
  if (app) {
    console.log('[Pomodoro E2E] 关闭 Electron...')
    await app.close()
  }
})

test('1. 跳过 onboarding 进入 Hub', async () => {
  const page = await getMainWindow()

  // 原写法把调用藏在 `if (window.api?.preferences?.setOnboardingCompleted)` 里，
  // api 缺失时静默什么都不做 —— 后续用例会以「页面结构不对」的形式失败，
  // 掩盖真正的病因。这里明确断言桥方法存在。
  const skipped = await page.evaluate(async () => {
    if (!window.api?.preferences?.setOnboardingCompleted) return false
    await window.api.preferences.setOnboardingCompleted()
    return true
  })
  expect(skipped, 'preferences.setOnboardingCompleted 不存在，onboarding 无法跳过').toBe(true)

  // ⚠ 必须 reload。渲染端的 onboardingState 是 router 模块里的单例
  // （src/renderer/src/router/index.ts），启动时 beforeEach 已经把它查成并缓存
  // 成 false（那一刻主进程里还没写）。只调 setOnboardingCompleted 只改了主进程，
  // 这个缓存不会跟着变 —— 于是后续任何非 onboarding 路由都会被守卫
  // `next({ path: '/onboarding', replace: true })` 推回来。
  // 这正是「跳过引导后仍然进不去番茄钟」的原因。
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  console.log('[Pomodoro E2E] 已跳过 onboarding 并重载')
})

test('2. 导航到番茄钟页面', async () => {
  const page = await getMainWindow()

  // 走应用自己的 hash 路由（vue-router createWebHashHistory）——旧写法先
  // dispatchEvent('frond:navigate')（渲染端无监听者，空放）再 goto 到 vite dev
  // server:5173，等于把这条用例挂在「本机是否开着 pnpm dev」上
  await page.evaluate(() => {
    window.location.hash = '#/pomodoro'
  })

  await expect(page.locator('.zf-root')).toBeVisible({ timeout: 15000 })
})

test('3. 获取任务列表：必须是数组', async () => {
  const page = await getMainWindow()

  const tasks = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getTasks()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取任务列表:', tasks)
  expectIpcOk(tasks, 'pomodoro.getTasks')
  expect(Array.isArray(tasks)).toBe(true)
})

test('4. 添加任务：标题必须原样回写', async () => {
  const page = await getMainWindow()

  const title = 'E2E 测试任务-' + Date.now()
  const result = await page.evaluate(async (t) => {
    try {
      return await window.api.pomodoro.addTask(t)
    } catch (e) {
      return { error: e.message }
    }
  }, title)

  console.log('[Pomodoro E2E] 添加任务结果:', result)
  // 原写法：`if (result && !result.error) expect(result.title)...` —— 出错即静默跳过。
  // 现在出错直接失败，标题断言无条件执行。
  expectIpcOk(result, 'pomodoro.addTask')
  expect(result.title).toBe(title)
  expect(result.id).toBeTruthy()
})

test('5. 统计数据：today / week / month 三段齐全', async () => {
  const page = await getMainWindow()

  const stats = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getStatistics()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取统计数据:', stats)
  expectIpcOk(stats, 'pomodoro.getStatistics')
  expect(typeof stats.today.total).toBe('number')
  expect(typeof stats.week.total).toBe('number')
  expect(typeof stats.month.total).toBe('number')
  // 不断言具体数值：会随运行环境漂，只锁字段类型
})

test('6. 设置：workDuration 必须是正数', async () => {
  const page = await getMainWindow()

  const settings = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getSettings()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取设置:', settings)
  expectIpcOk(settings, 'pomodoro.getSettings')
  expect(typeof settings.workDuration).toBe('number')
  expect(settings.workDuration).toBeGreaterThan(0)
})

test('7. 今日记录：必须是数组', async () => {
  const page = await getMainWindow()

  const records = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.getTodayRecords()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取今日记录:', records)
  expectIpcOk(records, 'pomodoro.getTodayRecords')
  expect(Array.isArray(records)).toBe(true)
})

test('8. 通知模式：必须在三档白名单内', async () => {
  const page = await getMainWindow()

  const mode = await page.evaluate(async () => {
    try {
      return await window.api.pomodoro.integration.getMode()
    } catch (e) {
      return { error: e.message }
    }
  })

  console.log('[Pomodoro E2E] 获取通知模式:', mode)
  expectIpcOk(mode, 'pomodoro.integration.getMode')
  expect(['normal', 'strong', 'silent']).toContain(mode)
})
