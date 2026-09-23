/**
 * Frond · E2E：React 视图协议闭环（#11）
 *
 * 导入 example-react（manifest api:'react'）→ 打开插件 → SDK renderView 提交视图树 →
 * 主进程 parsePluginView 归一 → 胶囊原生渲染 List → 触发 callbackId →
 * Callback 钩子回传 → SDK 分发 → nav.push(Detail) → 新视图渲染。
 * 第二用例覆盖 M2：List 动作 → nav.push(Form) → 填值 ⌘↵ → 值回传 onSubmit → Detail。
 *
 * 用法：先 pnpm build；example-react/dist 已提交（导入不需要构建）。
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
const getMainWindow = async () => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      try {
        if (/Frond/.test(await w.title())) return w
      } catch {
        /* noop */
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return app.firstWindow()
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
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
  const env = { ...process.env }
  env.FROND_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-react-view')
  // 每次跑都从干净目录起：本文件把插件装进 userData，留着旧目录 = 用的是**上一次那份 manifest**
  // （改了 example-react/plugin.json 之后会出现「改了没生效」的假象）
  rmSync(env.FROND_USER_DATA_DIR, { recursive: true, force: true })
  delete env.ELECTRON_RUN_AS_NODE
  env.FROND_E2E = '1' // 插件导入确认闸旁路（Playwright 无法点原生对话框）
  app = await electron.launch({ args: [MAIN_ENTRY], env })
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test('React 视图协议：渲染 → 回调 → 导航详情', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')

  // 跳过 onboarding
  await main.evaluate(async () => {
    if (window.api?.preferences?.setOnboardingCompleted) {
      await window.api.preferences.setOnboardingCompleted()
    }
  })

  // 导入 react 示例插件（幂等）
  const install = await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )
  expect(install.success).toBe(true)

  // 打开插件（胶囊进入插件交互）
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react'))
  const capsule = await getCapsuleWindow()
  expect(capsule).toBeTruthy()
  await capsule.waitForLoadState('domcontentloaded')

  // SDK renderView → 归一后的列表被胶囊原生渲染
  const item = capsule.locator('.plist-item', { hasText: 'frond/launcher' })
  await expect(item).toBeVisible({ timeout: 20000 })
  await expect(capsule.locator('.plist-item', { hasText: 'frond/plugin-sdk' })).toBeVisible()

  // 触发首个动作（callbackId）→ Callback 钩子 → SDK 分发 onAction → nav.push(Detail)
  await capsule.evaluate(() => window.api.launcher.runPluginAction('com.frond.example-react', 0, 0))

  // 详情视图渲染（detail 视图降级为占位条目 + markdown 正文）
  await expect
    .poll(
      async () => {
        const state = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return (state.declaredList ?? []).some((i) =>
          (i.detail ?? '').includes('由回调推入的详情视图')
        )
          ? 'detail-arrived'
          : 'pending'
      },
      { timeout: 15000, intervals: [1000, 2000] }
    )
    .toBe('detail-arrived')
  await expect(capsule.locator('text=由回调推入的详情视图')).toBeVisible({ timeout: 15000 })
})

test('M2 表单：渲染 → ⌘↵ 提交 → 值回传 onSubmit → 详情', async () => {
  const main = await getMainWindow()
  const capsule = await getCapsuleWindow()

  // 上一用例已把视图栈推到 detail：关闭并重开插件 → 插件页重建，回到列表
  await capsule.evaluate(() => window.api.launcher.closePlugin())
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react'))
  await expect(capsule.locator('.plist-item', { hasText: 'frond/launcher' })).toBeVisible({
    timeout: 20000
  })

  // 触发动作「提交反馈」→ nav.push(Form) → 表单视图（与列表互斥，存 declaredForm）
  await capsule.evaluate(() => window.api.launcher.runPluginAction('com.frond.example-react', 0, 1))
  await expect
    .poll(
      async () => {
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st.declaredForm ? 'form-set' : 'none'
      },
      { timeout: 15000, intervals: [500, 1000] }
    )
    .toBe('form-set')
  await expect(capsule.locator('.form-input').first()).toBeVisible({ timeout: 15000 })

  // 填值后 ⌘↵ 提交：值必须真回到插件的 onSubmit（marker 出现在回推的详情正文里）
  const marker = `回传-${Date.now()}`
  await capsule.locator('#ff-1').fill(marker)
  await capsule.locator('#ff-1').press('Meta+Enter')
  await expect
    .poll(
      async () => {
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return (st.declaredList ?? []).some((i) => (i.detail ?? '').includes(marker))
          ? 'values-returned'
          : 'pending'
      },
      { timeout: 15000, intervals: [1000, 2000] }
    )
    .toBe('values-returned')
})

test('P-2.2 Action 命令（mode:"action"）：不挂插件视图、跑完自关', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  // 导入幂等：本 spec 前两用例已装过，这里保证单独跑这一条也能起来
  await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )

  // 前面用例把插件界面留着了：此时胶囊搜索框是插件副输入框、结果列表不渲染，
  // 必须先关干净再建「根列表」基线，否则这条用例在套跑里必然抢跑
  await expect
    .poll(
      async () => {
        await main.evaluate(() => window.api.launcher.closePlugin())
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st.open
      },
      { timeout: 10000, intervals: [500, 1000] }
    )
    .toBe(false)

  // 胶囊先停在根搜索结果上——「没被插件接管」要有可比较的基线
  await main.evaluate(() => window.api.launcher.show())
  const capsule = await getCapsuleWindow()
  await capsule.waitForLoadState('domcontentloaded')
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('三模式')
  await expect(capsule.locator('.launcher-result').first()).toBeVisible()

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
  const notifyCount = async () =>
    (await capsule.evaluate(() => window.api.e2e.probeCounts()))['plugapi:notify'] ?? 0
  const before = await notifyCount()

  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react', 'ping'))

  // 1) 真副作用：插件确实执行了逻辑并发出通知（Action 命令的「有用」就在这）
  await expect.poll(notifyCount, { timeout: 15000, intervals: [500, 1000] }).toBeGreaterThan(before)

  // 2) 胶囊界面没被插件接管：无插件副输入标识、根结果列表还在原地
  //    （注意：查询词此刻已被清空——渲染端打开任何插件都会清词，Action 命令
  //    应当例外，那一格记在 RAYCAST_PARITY_PLAN_V5 的 P-1.6b 家族里）
  await expect(capsule.locator('.launcher-search-plugin')).toHaveCount(0)
  await expect(capsule.locator('.launcher-result').first()).toBeVisible()

  // 3) 插件自己 close 走得通（从未挂载的视图上关插件不得炸 removeBrowserView）
  await expect
    .poll(
      async () => {
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st.open ? 'open' : 'closed'
      },
      { timeout: 10000, intervals: [500, 1000] }
    )
    .toBe('closed')
})

test('P-2.2 Action 命令真做出视图时升级为可见（promoteToVisible）', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )
  await expect
    .poll(
      async () => {
        await main.evaluate(() => window.api.launcher.closePlugin())
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st.open
      },
      { timeout: 10000, intervals: [500, 1000] }
    )
    .toBe(false)

  // ping-view 声明了 mode:'action'，但插件走了 start(<App/>) 提交列表
  // —— 规则是「无界面是缺省，做出 UI 就给你」，所以这条必须升级为可见
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react', 'ping-view'))
  const capsule = await getCapsuleWindow()
  await capsule.waitForLoadState('domcontentloaded')
  await expect(capsule.locator('.launcher-search-plugin')).toBeVisible({ timeout: 15000 })
  await expect(capsule.locator('.plist-item', { hasText: 'frond/launcher' }).first()).toBeVisible({
    timeout: 20000
  })
})

test('P-2.2 Action 命令确实未挂视图，且不自关时被宿主兜底回收', async () => {
  test.slow() // 等 ACTION_COMMAND_TIMEOUT_MS（20s）兜底回收
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )
  await expect
    .poll(
      async () => {
        await main.evaluate(() => window.api.launcher.closePlugin())
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st?.open
      },
      { timeout: 10000, intervals: [500, 1000] }
    )
    .toBe(false)

  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react', 'ping-hold'))

  // 判据取宿主真状态而不是 DOM：headless=true 且 attached=false 才是「视图没挂上窗」。
  // （只看 DOM 无法区分「未挂载」与「挂载了但没推快照」——那正是这格要防的自欺）
  await expect
    .poll(
      async () => {
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st?.open && st.headless && !st.attached ? 'headless-running' : 'other'
      },
      { timeout: 8000, intervals: [250, 500] }
    )
    .toBe('headless-running')

  // 插件不自关 → 到点由宿主回收，不得留下常驻视图
  await expect
    .poll(
      async () => {
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st?.open ? 'open' : 'recycled'
      },
      { timeout: 26000, intervals: [1000, 2000] }
    )
    .toBe('recycled')
})

test('P-2.6 列表加载态与插件自定义空态文案（两个稳定态，不用计时器切换）', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 返回类型
  const ensureClosed = async () => {
    await expect
      .poll(
        async () => {
          await main.evaluate(() => window.api.launcher.closePlugin())
          const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
          return st?.open
        },
        { timeout: 10000, intervals: [300, 600] }
      )
      .toBe(false)
  }
  const capsule = await getCapsuleWindow()
  await capsule.waitForLoadState('domcontentloaded')
  const empty = capsule.locator('[data-testid=plugin-list-empty]')

  await ensureClosed()
  await main.evaluate(() =>
    window.api.launcher.openPlugin('com.frond.example-react', 'list-loading')
  )
  await expect(empty).toHaveText('加载中…', { timeout: 15000 })

  await ensureClosed()
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react', 'list-empty'))
  await expect(empty).toHaveText('还没有数据，先同步一次', { timeout: 15000 })
})

test('P-2.6 Detail.actions：详情级动作降级到占位条目并可触发', async () => {
  const main = await getMainWindow()
  await main.waitForLoadState('domcontentloaded')
  await expect
    .poll(
      async () => {
        await main.evaluate(() => window.api.launcher.closePlugin())
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st?.open
      },
      { timeout: 10000, intervals: [300, 600] }
    )
    .toBe(false)

  await main.evaluate(() =>
    window.api.launcher.openPlugin('com.frond.example-react', 'detail-actions')
  )
  // 先等「带动作的详情」真的落地，再触发（runPluginAction 按当前声明视图取索引）
  await expect
    .poll(
      async () => {
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return st?.declaredList?.[0]?.actions?.length ?? 0
      },
      { timeout: 20000, intervals: [500, 1000] }
    )
    .toBe(1)

  await main.evaluate(() => window.api.launcher.runPluginAction('com.frond.example-react', 0, 0))
  await expect
    .poll(
      async () => {
        const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
        return (st?.declaredList ?? []).some((i) =>
          (i.detail ?? '').includes('来自详情动作的下一层')
        )
          ? 'action-fired'
          : 'pending'
      },
      { timeout: 15000, intervals: [1000, 2000] }
    )
    .toBe('action-fired')
})

/**
 * P-2.5 三格平台能力的端到端判据（探针在 example-react 的 `platform` 命令里）。
 * 都不留副作用：偏好取声明的默认值；open(url) 的两道闸分开量——
 * 主进程里的 `shell.openExternal` 临时换成记录器，于是「被接受的那条」看得见，
 * 却不会真在 CI 上开浏览器（清单声明了 net，file: 才是被**协议白名单**挡下的）。
 */
test('P-2.5 平台能力：一次读全偏好 + open(url) 的两道闸', async () => {
  const main = await getMainWindow()
  // 把系统交出去那一步换成记录器：这样「被接受的 URL 真的走到了 openExternal」
  // 能在 e2e 里量，而不会在 CI 机器上真开一个浏览器标签
  await app.evaluate(({ shell }) => {
    const g = globalThis
    g.__frondOpenedUrls = []
    if (!g.__frondRealOpenExternal) g.__frondRealOpenExternal = shell.openExternal
    shell.openExternal = async (url) => {
      g.__frondOpenedUrls.push(url)
      return true
    }
  })
  const install = await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )
  expect(install.success).toBe(true)
  const capsule = await getCapsuleWindow()
  await capsule.evaluate(() => window.api.launcher.closePlugin())
  await main.evaluate(() => window.api.launcher.openPlugin('com.frond.example-react', 'platform'))

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
  const detailText = async () => {
    const st = await main.evaluate(async () => await window.api.launcher.getPluginState())
    return (st.declaredList ?? []).map((i) => i.detail ?? '').join('\n')
  }
  await expect
    .poll(async () => (await detailText()).includes('平台能力探针'), { timeout: 25000 })
    .toBe(true)
  const detail = await detailText()
  // 偏好走 plugapi:listPreferences：没设过 → 落 manifest 声明的默认值
  // （这条同时证明 readManifest 真的收下了 preferences——清洗器一挡就会变 null）
  expect(detail).toContain('who=frond')
  expect(detail).toContain('theme=dark')
  /**
   * open(url) 的两道闸**分开量**（清单声明了 net，第二条才有意义）：
   *  - `https:` 过闸 → true，且 URL 真的走到了 openExternal；
   *  - `file:` 被协议白名单挡下 → false，且**没有**走到 openExternal。
   * 少了这个区分，「两条都 false」看起来像测了白名单，其实都停在权限门上。
   */
  expect(detail).toContain('https=true')
  expect(detail).toContain('file=false')
  const opened = await app.evaluate(() => globalThis.__frondOpenedUrls ?? [])
  expect(opened).toEqual(['https://example.com/frond-e2e'])
  // 换回去：这个 app 实例后面还有用例，别让它们在一个假 openExternal 上跑
  await app.evaluate(({ shell }) => {
    const g = globalThis
    if (g.__frondRealOpenExternal) shell.openExternal = g.__frondRealOpenExternal
  })
})
