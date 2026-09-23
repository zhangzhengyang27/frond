/**
 * Frond · E2E：插件登记自己的定时任务（P-2③ 受限排程通道）
 *
 * 真跑的一条链：插件页调 SDK → preload → plugapi handler（认 sender 身份 + 权限）
 * → Automation 存储的四道闸 → 落 pref → 设置页看得见 → 「立刻跑一次」→ 引擎 detached 起插件。
 * 载体是 example-react 的 `schedule-selftest` 探针命令：它把三道闸的结果原样渲染出来，
 * 所以「被拒的理由有没有回到插件」这件事在界面上可读，而不是只看单测里我怎么写断言。
 *
 * 用法：先重建 SDK 与 example-react（`cd packages/frond-plugin-sdk && npm run build`、
 * `cd example-react && npm run build`），再 `npx electron-vite build`，
 * 最后 `pnpm exec playwright test e2e/plugin-schedule.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const PLUGIN_ID = 'com.frond.example-react'

let app = null

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
  throw new Error(`找不到主窗：${app.windows().map((w) => w.url()).join(' | ')}`)
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const getCapsuleWindow = async () => {
  const deadline = Date.now() + 20000
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
  throw new Error('找不到胶囊窗')
}

/** 本插件在宿主侧的任务（从主窗读，与设置页同一份数据源） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const myTasks = async (main) =>
  (await main.evaluate(() => window.api.ai.automationList())).filter((t) => t.owner === `plugin:${PLUGIN_ID}`)

test.beforeAll(async () => {
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-plugin-schedule')
  env.FROND_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  const install = await main.evaluate(
    (dir) => window.api.launcher.installFromFolder(dir),
    join(ROOT, 'example-react')
  )
  expect(install.success).toBe(true)
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 120000 })

test('① 三道闸的结果在插件侧读得到：收下的回 id，被拒的回宿主原话', async () => {
  const main = await getMainWindow()
  await main.evaluate(
    (id) => window.api.launcher.openPlugin(id, 'schedule-selftest'),
    PLUGIN_ID
  )
  const capsule = await getCapsuleWindow()
  // 探针渲染的是 Detail 正文（action 命令真做出视图 → 宿主升级为可见，P-2.2 那条）
  await expect(capsule.locator('text=排程探针').first()).toBeVisible({ timeout: 25000 })
  // 频率闸：一天 1440 次，宿主连「约每 15 分钟一次」的换算是给插件看的原话
  await expect(capsule.locator('text=dense=太密了：一天 1440 次').first()).toBeVisible()
  // mode 闸：视图命令不该能在没人看着的时候弹界面
  await expect(capsule.locator('text=view=只能排').first()).toBeVisible()
  // 收下的那条只有一条（labels 里不该出现被拒的那两条的名字）
  await expect(capsule.locator('text=count=1').first()).toBeVisible()
  await expect(capsule.locator('text=labels=e2e 排程').first()).toBeVisible()

  const tasks = await myTasks(main)
  expect(tasks).toHaveLength(1)
  expect(tasks[0]).toMatchObject({
    owner: `plugin:${PLUGIN_ID}`,
    cron: '*/15 * * * *',
    label: 'e2e 排程',
    enabled: true
  })
  expect(tasks[0].action.type).toBe('plugin')
})

test('② 到点真跑：活跃视图占着槽时跳过，关掉插件后才投给插件', async () => {
  const main = await getMainWindow()
  const capsule = await getCapsuleWindow()
  const [task] = await myTasks(main)
  expect(task, '① 排的那条要在').toBeTruthy()

  // 探针自己的视图还开着（活跃槽只有一个）：这一次必须跳过，而不是把用户手上的插件挤掉
  const busy = await main.evaluate((id) => window.api.ai.automationRunNow(id), task.id)
  expect(busy.ok).toBe(false)
  expect(busy.error).toContain('正有插件在用')

  await main.evaluate(() => window.api.launcher.closePlugin())
  await expect
    .poll(async () => (await capsule.evaluate(() => document.body.innerText)).includes('排程探针'), {
      timeout: 15000
    })
    .toBe(false)

  const ran = await main.evaluate((id) => window.api.ai.automationRunNow(id), task.id)
  expect(ran).toMatchObject({ ok: true })
  // 历史写回任务：设置页那一格靠它显示「已交给插件」
  await expect
    .poll(
      async () => {
        const [t] = await myTasks(main)
        return t.lastOk === true && t.lastFiredAt ? 'ok' : `pending:${t.lastOk}:${t.lastError}`
      },
      { timeout: 15000 }
    )
    .toBe('ok')
})

test('③ 设置页看得见是谁安排的，卸载插件时任务一起清掉', async () => {
  const main = await getMainWindow()
  await main.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await main.getByRole('button', { name: '高级' }).first().click()
  await expect(main.getByText('定时任务', { exact: true })).toBeVisible({ timeout: 15000 })
  const row = main.locator('[data-testid="automation-row"]').filter({ hasText: 'e2e 排程' })
  await expect(row).toBeVisible()
  // 后台会跑的东西必须看得见是谁安排的
  await expect(row.getByText(`来自插件 ${PLUGIN_ID}`)).toBeVisible()
  // 「成功」是替插件撒谎：宿主只知道投递到了插件
  await expect(row.getByText('已交给插件')).toBeVisible({ timeout: 15000 })

  const removed = await main.evaluate((id) => window.api.launcher.removePlugin(id), PLUGIN_ID)
  expect(removed.success).toBe(true)
  await expect
    .poll(async () => (await main.evaluate(() => window.api.ai.automationList())).length, {
      timeout: 15000
    })
    .toBe(0)
})
