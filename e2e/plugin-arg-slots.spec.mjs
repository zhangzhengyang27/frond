/**
 * Leaf · E2E：搜索框内联参数槽（P-1.6b）
 *
 * Raycast 的行内补全：选中一条带参数的命令后，命令名变一颗不可编辑的 chip，
 * 参数一格一格排在后面，光标落在第一格，←/→ 换格，↵ 直接执行——**不跳表单页**。
 * 这条用例钉的就是「没跳页」：整段流程里不出现 FormPage，参数却真的到了插件。
 *
 * 载体是 example-react 的 `argsum`（两个文本参数，第一个必填）：
 * 内置插件 `com.leaf.regex` 是 3 参数含 dropdown，那条**按设计仍走表单页**
 * （`MAX_INLINE_SLOTS = 2`、含 dropdown 即排除），它由 `plugin-args.spec.mjs` 守着。
 *
 * 用法：先 `npx electron-vite build`，再 `pnpm exec playwright test e2e/plugin-arg-slots.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_ID = 'com.leaf.example-react'
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')

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
  throw new Error(
    `找不到主窗：${app
      .windows()
      .map((w) => w.url())
      .join(' | ')}`
  )
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

/** 槽态下当前聚焦格子的参数名（不在槽态就 null） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const focusedSlot = (capsule) =>
  capsule.evaluate(() => {
    const el = document.activeElement
    return el && el instanceof HTMLInputElement ? el.getAttribute('data-arg-slot') : null
  })

/**
 * 胶囊窗当前高度。
 * 槽态应当只占一栏的高度（结果列表整个藏掉）；量不到这一条，
 * 「槽态还是按列表高度撑开的空窗」就只能靠肉眼看。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const capsuleHeight = () =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Launcher'))
    return win ? win.getBounds().height : -1
  })

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const slotState = (capsule) =>
  capsule.evaluate(() => ({
    chip: document.querySelector('[data-arg-chip]')?.textContent?.trim() ?? null,
    slots: [...document.querySelectorAll('[data-arg-slot]')].map((el) => ({
      id: el.getAttribute('data-arg-slot'),
      value: /** @type {HTMLInputElement} */ (el).value,
      invalid: el.getAttribute('aria-invalid') === 'true'
    })),
    searchInput: !!document.querySelector('.launcher-search-input'),
    rows: document.querySelectorAll('.launcher-result').length,
    // 跳表单页 = 这次改动要消灭的东西；出现 FormPage 就说明退回老路径了
    formPage: !!document.querySelector('.form-page')
  }))

/**
 * 把高亮挪到标题含 `text` 的那一行，然后回车。
 *
 * 不直接盲按 Enter：查询变化会把选中位归 0，但**第 0 行是谁**取决于哪一路异步源先到
 * （应用扫描 5-15s、文件/浏览器标签、插件命令表靠推送刷新）。套跑时机器忙，
 * 盲按就作用在别人那行上（表现正是单跑绿、套跑红，红的还是同一条 chip 断言）。
 * 一步一按、每按读当前高亮行的标题——与 capsule-actions 量应用行同一套写法。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const selectedTitle = async (capsule) =>
  (
    (await capsule
      .locator('.launcher-result.selected .launcher-result-title')
      .first()
      .textContent()) ?? ''
  ).trim()

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const enterOnRow = async (capsule, input, text) => {
  await expect(
    async () => {
      let landed = false
      for (let i = 0; i < 60 && !landed; i++) {
        landed = (await selectedTitle(capsule)).includes(text)
        if (!landed) await input.press('ArrowDown')
      }
      if (!landed) {
        const rows = await capsule
          .locator('.launcher-result .launcher-result-title')
          .allInnerTexts()
        throw new Error(`绕 60 步没走到含「${text}」的行，当前：${rows.slice(0, 8).join(' , ')}`)
      }
    },
    { timeout: 30000 }
  ).toPass()
  await input.press('Enter')
}

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-arg-slots')
  env.LEAF_E2E = '1'
  env.LEAF_SKIP_BUILTIN_PLUGINS = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  const install = await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )
  expect(install.success).toBe(true)
  await main.evaluate(() => window.api.launcher.show())
  await getCapsuleWindow()
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 120000 })

test('回车进内联槽：chip + 两格、不跳表单页，填完回车参数真的到插件', async () => {
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('两格参数')
  await expect
    .poll(async () => capsule.locator('.launcher-result', { hasText: '两格参数' }).count(), {
      timeout: 25000
    })
    .toBeGreaterThan(0)
  await enterOnRow(capsule, input, '两格参数（内联槽）')

  // ① 进了槽态：chip 是命令名、两格都在、搜索输入框与列表都让位了、没有表单页
  await expect
    .poll(async () => (await slotState(capsule)).chip, { timeout: 10000 })
    .toBe('两格参数（内联槽）')
  let st = await slotState(capsule)
  expect(st.slots.map((s) => s.id)).toEqual(['a', 'b'])
  expect(st.searchInput).toBe(false)
  expect(st.rows).toBe(0)
  expect(st.formPage, '一两格的命令不该再跳 FormPage').toBe(false)
  // ② 光标落在第一格
  expect(await focusedSlot(capsule)).toBe('a')

  // ③ 必填格空着回车：只标红，不提交、也不退槽
  //   （标红读 aria-invalid：class 是样式，a11y 属性才是「屏幕阅读器会不会念出错」那份状态）
  await capsule.locator('[data-arg-slot="a"]').press('Enter')
  st = await slotState(capsule)
  expect(st.slots.find((s) => s.id === 'a')?.invalid, '空必填格回车要标出这一格').toBe(true)
  expect(st.chip).not.toBeNull()

  // ④ 填两格：←/→ 换格有效（第二格拿到焦点后键盘打字落得进去）
  await capsule.locator('[data-arg-slot="a"]').fill('X')
  await capsule.locator('[data-arg-slot="a"]').press('ArrowRight')
  expect(await focusedSlot(capsule)).toBe('b')
  await capsule.keyboard.type('Y')
  await expect
    .poll(async () => (await slotState(capsule)).slots.find((s) => s.id === 'b')?.value, {
      timeout: 5000
    })
    .toBe('Y')
  expect((await slotState(capsule)).slots.find((s) => s.id === 'a')?.invalid).toBe(false)

  // ⑤ 回车执行：插件按参数渲染出 a=X / b=Y
  await capsule.locator('[data-arg-slot="b"]').press('Enter')
  await expect
    .poll(
      async () => {
        const state = await getPluginStateViaMain()
        return (state?.declaredList ?? []).map((i) => i.detail ?? '').join('\n')
      },
      { timeout: 20000 }
    )
    .toContain('a=X')
  expect((await getPluginStateViaMain())?.pluginId).toBe('com.leaf.example-react')
  expect((await slotState(capsule)).chip, '提交后应退出槽态').toBeNull()

  // ⑥ 退槽：重新进槽态后按 Esc 回到搜索框（不是关窗）
  const main = await getMainWindow()
  await main.evaluate(() => window.api.launcher.closePlugin())
  await input.click()
  await input.fill('两格参数')
  await expect
    .poll(async () => capsule.locator('.launcher-result', { hasText: '两格参数' }).count())
    .toBeGreaterThan(0)
  await enterOnRow(capsule, input, '两格参数（内联槽）')
  await expect.poll(async () => (await slotState(capsule)).chip, { timeout: 10000 }).not.toBeNull()
  await capsule.locator('[data-arg-slot="a"]').press('Escape')
  await expect
    .poll(async () => (await slotState(capsule)).searchInput, { timeout: 5000 })
    .toBe(true)
  // 第一格已空时退格也退槽（用户在删自己打的字时不该退出，见空值判定）
  await input.click()
  await input.fill('两格参数')
  await expect
    .poll(async () => capsule.locator('.launcher-result', { hasText: '两格参数' }).count())
    .toBeGreaterThan(0)
  await enterOnRow(capsule, input, '两格参数（内联槽）')
  await expect.poll(async () => (await slotState(capsule)).chip, { timeout: 10000 }).not.toBeNull()
  await capsule.locator('[data-arg-slot="a"]').press('Backspace')
  await expect
    .poll(async () => (await slotState(capsule)).searchInput, { timeout: 5000 })
    .toBe(true)
})

/**
 * 槽态的三条边界——都是「列表态的行为漏进了槽态」这一类，光看界面看不出来：
 *  ① 整窗该收成一条栏的高度（列表藏掉了，窗还按列表高撑开就是一大片空窗）；
 *  ② 数字键是**参数内容**，不是根列表的「第 N 条直达」（那条会 preventDefault，
 *     字打不进格子，还顺手执行了另一条命令）；
 *  ③ 输入法组合态的 ↵ 属于输入法（选词），不该被当成提交。
 * 判据取「字进没进格子」「组合态按完还在不在槽里」这种可断言的副作用，不取截图。
 */
test('槽态边界：整窗一栏高、数字是内容、输入法 ↵ 不提交', async () => {
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('两格参数')
  await expect
    .poll(async () => capsule.locator('.launcher-result', { hasText: '两格参数' }).count(), {
      timeout: 25000
    })
    .toBeGreaterThan(0)
  // 基线：有结果列表时窗有多高（拿它跟槽态比，才知道「收成一栏」真的收了）
  const listHeight = await capsuleHeight()
  expect(listHeight, '量不到窗口高度就没有基线').toBeGreaterThan(0)

  await enterOnRow(capsule, input, '两格参数（内联槽）')
  await expect.poll(async () => (await slotState(capsule)).chip, { timeout: 10000 }).not.toBeNull()
  // ① 槽态只占一条栏的高度
  await expect
    .poll(async () => await capsuleHeight(), { timeout: 8000 })
    .toBeLessThan(listHeight - 40)

  // ② 数字是参数内容：字要进得去格子，槽态也不该被别的命令顶掉
  await capsule.locator('[data-arg-slot="a"]').press('1')
  await expect
    .poll(async () => (await slotState(capsule)).slots.find((s) => s.id === 'a')?.value, {
      timeout: 5000
    })
    .toBe('1')
  expect((await slotState(capsule)).chip, '数字快捷键把这条命令顶掉了').not.toBeNull()

  // ③ 组合态的 ↵：填齐两格后派发一个 isComposing 的 Enter——输入法在用 ↵ 选词，不是提交
  await capsule.locator('[data-arg-slot="b"]').fill('Z')
  await capsule.evaluate(() => {
    const el = document.querySelector('[data-arg-slot="a"]')
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'isComposing', { value: true })
    el?.dispatchEvent(ev)
  })
  await new Promise((r) => setTimeout(r, 300))
  expect((await slotState(capsule)).chip, '组合态的 ↵ 被当成提交了').not.toBeNull()

  // 真 ↵（非组合态）仍然照常提交：守卫不能把 Enter 一起挡了
  await capsule.locator('[data-arg-slot="a"]').press('Enter')
  await expect
    .poll(
      async () =>
        (await getPluginStateViaMain())?.declaredList?.map((i) => i.detail ?? '').join('\n') ?? '',
      { timeout: 20000 }
    )
    .toContain('a=1')
  expect(
    (await getPluginStateViaMain())?.declaredList.map((i) => i.detail ?? '').join('\n')
  ).toContain('b=Z')
  expect((await slotState(capsule)).chip, '提交后应退出槽态').toBeNull()

  const main = await getMainWindow()
  await main.evaluate(() => window.api.launcher.closePlugin())
})

test('装卸插件不必收起再唤起：命令表靠推送刷新', async () => {
  const main = await getMainWindow()
  const capsule = await getCapsuleWindow()
  // 起点：把胶囊放回到「可见 + 搜索态」（前两条用例可能停在插件视图里）
  await main.evaluate(() => window.api.launcher.closePlugin())
  await main.evaluate(() => window.api.launcher.hide())
  await main.evaluate(() => window.api.launcher.show())
  await new Promise((r) => setTimeout(r, 500))
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('两格参数')
  await expect
    .poll(async () => capsule.locator('.launcher-result', { hasText: '两格参数' }).count(), {
      timeout: 25000
    })
    .toBeGreaterThan(0)

  /**
   * ① 卸掉 → 这一行自己消失。
   * 全程**没有第二次唤起**：刷新只能来自 `launcher:plugin-table-changed` 那条推送。
   * （以前这条链只有 `launcher:shown` 一个触发点，于是「装完搜不到、收起再唤起才有」，
   * 满载套跑里 beforeAll 那一次 show 撞上主进程还没读到新插件时，测试会一直 0 行。）
   */
  const removed = await main.evaluate((id) => window.api.launcher.removePlugin(id), PLUGIN_ID)
  expect(removed.success).toBe(true)
  await expect
    .poll(async () => capsule.locator('.launcher-result', { hasText: '两格参数' }).count(), {
      timeout: 20000
    })
    .toBe(0)

  // ② 装回来 → 同样只靠推送回来
  const installed = await main.evaluate(
    (apiPath) => window.api.launcher.installFromFolder(apiPath),
    join(ROOT, 'example-react')
  )
  expect(installed.success).toBe(true)
  await expect
    .poll(async () => capsule.locator('.launcher-result', { hasText: '两格参数' }).count(), {
      timeout: 20000
    })
    .toBeGreaterThan(0)

  // 收尾：装回来的插件保持装着（后面的用例还要用同一份 userData）
  await main.evaluate(() => window.api.launcher.closePlugin())
})

/** 从设置窗那侧读插件状态：胶囊窗的 DOM 只能看到降级后的列表，状态以主进程为准 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
async function getPluginStateViaMain() {
  const main = await getMainWindow()
  return main.evaluate(async () => await window.api.launcher.getPluginState())
}
