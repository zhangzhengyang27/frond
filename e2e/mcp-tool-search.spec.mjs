/**
 * Leaf · E2E：MCP 工具进根搜索（P-4② 收尾）
 *
 * 这一段是 P-4② 剩下的那一格：客户端与设置页早就通了，缺的是「工具出现在搜索框里、
 * 参数就地填得完、输出看得见」。参数格用的是 P-1.6b 那套内联槽，所以这条用例同时是
 * 「内联槽第一次接到第三方参数表」上的验证。
 *
 * 真跑：配置指向 `fixture-server.mjs`（一个真的 node 子进程），断言的是
 * 服务器真的回了什么 —— `echo:你好` 那种字符串只能由真进程产生。
 *
 * 用法：先 `npx electron-vite build`，再 `pnpm exec playwright test e2e/mcp-tool-search.spec.mjs`
 */

import { test, expect, _electron as electron } from 'playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_ENTRY = join(ROOT, 'out/main/index.js')
const FIXTURE = join(ROOT, 'src/main/services/mcp/__tests__/fixtures/fixture-server.mjs')

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

/** 当前高亮行的「标题 + 徽标」——回车就作用在这一行上（别猜下标，见仓库 e2e 约定） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const selectedRow = (capsule) =>
  capsule.evaluate(() => {
    const el = document.querySelector('.launcher-result.selected')
    return el
      ? {
          title: el.querySelector('.launcher-result-title')?.textContent?.trim() ?? '',
          badge: el.querySelector('.launcher-result-badge')?.textContent?.trim() ?? ''
        }
      : null
  })

/**
 * 走到「徽标是 MCP 且标题含 text」的那一行再回车。
 *
 * 不盲按 Enter（第 0 行是谁取决于哪一路异步源先到），也不傻乎乎一步步挪：
 * 先等那一行**出现在列表里**，再按 DOM 序算出要按几次 ↓（`moveSelection` 是绕圈的，
 * 圈数 = 列表长度）。列表没渲染完时绕圈只会把测试预算耗光——上一版就是这么超时的。
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const rowIndexes = (capsule, text) =>
  capsule.evaluate((t) => {
    const rows = [...document.querySelectorAll('.launcher-result')]
    const badge = (el) => el.querySelector('.launcher-result-badge')?.textContent?.trim() ?? ''
    const title = (el) => el.querySelector('.launcher-result-title')?.textContent?.trim() ?? ''
    return {
      n: rows.length,
      selected: rows.findIndex((el) => el.classList.contains('selected')),
      target: rows.findIndex((el) => badge(el) === 'MCP' && title(el).includes(t))
    }
  }, text)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const enterOnMcpRow = async (capsule, input, text) => {
  let idx = null
  await expect
    .poll(async () => (idx = await rowIndexes(capsule, text)) && idx.target, { timeout: 30000 })
    .toBeGreaterThanOrEqual(0)
  const { n, selected, target } = idx
  if (selected < 0 || target < 0 || n === 0) throw new Error(`行序读不到：${JSON.stringify(idx)}`)
  const steps = (target - selected + n) % n
  for (let i = 0; i < steps; i++) await input.press('ArrowDown')
  const landed = await rowIndexes(capsule, text)
  expect(landed.selected, `按了 ${steps} 步还没停到 MCP 行`).toBe(target)
  await input.press('Enter')
}

/** 内联槽现场：chip 文案 + 每格的参数名与值 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const slotState = (capsule) =>
  capsule.evaluate(() => ({
    chip: document.querySelector('[data-arg-chip]')?.textContent?.trim() ?? null,
    slots: [...document.querySelectorAll('[data-arg-slot]')].map((el) => ({
      id: el.getAttribute('data-arg-slot'),
      value: /** @type {HTMLInputElement} */ (el).value
    })),
    rows: document.querySelectorAll('.launcher-result').length,
    formPage: !!document.querySelector('.form-page')
  }))

/** 结果页现场（在 mcpcall 页上时非 null） */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 无法写 TS 注解
const callState = (capsule) =>
  capsule.evaluate(() => {
    // 以**页面根**为准：出错与运行中都没有 output 元素，那时更要读得到界面说了什么
    const root = document.querySelector('.mcp-call')
    if (!root) return null
    const head = document.querySelector('[data-testid="mcp-call-head"]')?.textContent ?? ''
    return {
      head: head.trim(),
      out: document.querySelector('[data-testid="mcp-call-output"]')?.textContent ?? '',
      running: !!document.querySelector('[data-testid="mcp-call-running"]'),
      error: document.querySelector('[data-testid="mcp-call-error"]')?.textContent?.trim() ?? '',
      noArgs: !!document.querySelector('[data-testid="mcp-call-noargs"]'),
      // 名字与值分开读：textContent 会把两列粘成 'msg你好'，断言就分不清是谁了
      args: [...document.querySelectorAll('.mcp-call-arg')].map((el) => ({
        name: el.querySelector('.mcp-call-arg-name')?.textContent?.trim(),
        value: el.querySelector('.mcp-call-arg-value')?.textContent?.trim()
      })),
      notes: [...document.querySelectorAll('.mcp-call-dropped')].map((el) => el.textContent?.trim())
    }
  })

test.beforeAll(async () => {
  const env = { ...process.env }
  env.LEAF_USER_DATA_DIR = join(ROOT, 'test-results', 'e2e-userdata-mcp-tools')
  env.LEAF_E2E = '1'
  delete env.ELECTRON_RUN_AS_NODE
  rmSync(env.LEAF_USER_DATA_DIR, { recursive: true, force: true })
  app = await electron.launch({ args: [MAIN_ENTRY], env })
  const main = await getMainWindow()
  await expect(main.getByText('跳过引导').first()).toBeVisible({ timeout: 30000 })
  await main.getByText('跳过引导').first().click()
  // 配置 + 连一次：连接是「把工具清单落进缓存」的唯一入口，
  // 而命令表只读缓存——所以这一步之后就算服务器停着，搜索框里也该有这两条工具
  const saved = await main.evaluate(
    async ([cmd, fixture]) =>
      await window.api.ai.mcpSetServers([
        { id: 'fixture', label: '夹具服务器', command: cmd, args: [fixture] }
      ]),
    [process.execPath, FIXTURE]
  )
  expect(saved.rejected).toEqual([])
  const view = await main.evaluate(() => window.api.ai.mcpConnect('fixture'))
  expect(view.status).toBe('ready')
  await main.evaluate(() => window.api.launcher.show())
  await getCapsuleWindow()
}, 120000)

test.afterAll(async () => {
  if (app) await app.close()
})

test.describe.configure({ timeout: 120000 })

test('① 工具行进根搜索：服务器停着也列得出来（读的是缓存，不 spawn）', async () => {
  const main = await getMainWindow()
  const capsule = await getCapsuleWindow()
  // 缓存里就是这两条
  await expect
    .poll(async () => (await main.evaluate(() => window.api.ai.mcpToolCommands())).length, {
      timeout: 15000
    })
    .toBe(2)
  await main.evaluate(() => window.api.ai.mcpStop('fixture'))

  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('ping_no_args')
  await expect
    .poll(
      async () =>
        capsule
          .locator('.launcher-result', { hasText: 'ping_no_args' })
          .evaluateAll((els) =>
            els.map((el) => el.querySelector('.launcher-result-badge')?.textContent?.trim())
          ),
      { timeout: 30000 }
    )
    .toContain('MCP')
  // 副标题带上服务器名：两台服务器有同名工具时这是唯一的区分信息
  const row = capsule.locator('.launcher-result', { hasText: 'ping_no_args' }).first()
  await expect(row).toContainText('夹具服务器')
})

test('② 无参数工具：回车直接跑，结果页显示服务器真的回显与忽略计数', async () => {
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('ping_no_args')
  await expect
    .poll(async () => capsule.locator('.launcher-result').count(), { timeout: 30000 })
    .toBeGreaterThan(0)
  await enterOnMcpRow(capsule, input, 'ping_no_args')
  await expect
    .poll(async () => (await callState(capsule))?.out, { timeout: 40000 })
    .toContain('echo:-')
  const st = await callState(capsule)
  expect(st.head).toContain('ping_no_args')
  expect(st.head).toContain('夹具服务器')
  expect(st.args).toEqual([])
  expect(st.noArgs).toBe(true)
  // 夹具每次都回一张 image：本期只渲染 text，但必须如实报数
  expect(st.notes.join('')).toContain('1 项非文本内容未显示')
  expect(st.error).toBe('')

  // ESC 回根列表（不是关窗）：结果页压在内联页栈上
  await input.press('Escape')
  await expect.poll(async () => (await callState(capsule)) === null, { timeout: 10000 }).toBe(true)
})

test('③ 带一个参数：进内联槽（不跳表单页），填完参数真的到了服务器', async () => {
  const capsule = await getCapsuleWindow()
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  // 查服务器名而不是工具名：'echo' 会被文件索引的上千行同名结果淹掉
  // （根搜索封顶 50 行，MCP 行根本进不了可见区——这是排序问题，不是 MCP 的问题）
  await input.fill('夹具服务器')
  await expect
    .poll(async () => capsule.locator('.launcher-result').count(), { timeout: 30000 })
    .toBeGreaterThan(0)
  await enterOnMcpRow(capsule, input, 'echo')

  // ① 槽态：标题进 chip、格子名是 schema 里那个 msg、列表让位、没有 FormPage
  let st = await slotState(capsule)
  await expect.poll(async () => (await slotState(capsule)).chip, { timeout: 10000 }).toBe('echo')
  st = await slotState(capsule)
  expect(st.slots.map((s) => s.id)).toEqual(['msg'])
  expect(st.rows).toBe(0)
  expect(st.formPage, '一格参数不该跳表单页').toBe(false)

  // ② 填值回车 → 结果页：args 区回显用户填的，输出里能看到服务器真的收到了它
  await capsule.locator('[data-arg-slot="msg"]').type('你好')
  await capsule.locator('[data-arg-slot="msg"]').press('Enter')
  await expect
    .poll(async () => (await callState(capsule))?.out, { timeout: 40000 })
    .toContain('echo:你好')
  const called = await callState(capsule)
  expect(called.args).toEqual([{ name: 'msg', value: '你好' }])
  expect(called.head).toContain('echo')
})

test('④ 停用的服务器：它的工具一条都不摆（回车必失败的行是噪音）', async () => {
  const main = await getMainWindow()
  const capsule = await getCapsuleWindow()
  await main.evaluate(
    async ([cmd, fixture]) =>
      await window.api.ai.mcpSetServers([
        { id: 'fixture', label: '夹具服务器', command: cmd, args: [fixture], enabled: false }
      ]),
    [process.execPath, FIXTURE]
  )
  // 命令表每次唤起胶囊重拉（launcher:shown 那条），所以这里收一次再唤起
  await capsule.evaluate(() => window.api.launcher.hide())
  await main.evaluate(() => window.api.launcher.show())
  const input = capsule.locator('.launcher-search-input')
  await input.click()
  await input.fill('ping_no_args')
  await expect
    .poll(
      async () =>
        capsule
          .locator('.launcher-result')
          .evaluateAll((els) =>
            els
              .map((el) => el.querySelector('.launcher-result-title')?.textContent?.trim() ?? '')
              .filter((t) => t.includes('ping_no_args'))
          ),
      { timeout: 20000 }
    )
    .toEqual([])
  // 收尾把配置恢复成启用，别让后一条用例接手一个停用态
  await main.evaluate(
    async ([cmd, fixture]) =>
      await window.api.ai.mcpSetServers([
        { id: 'fixture', label: '夹具服务器', command: cmd, args: [fixture] }
      ]),
    [process.execPath, FIXTURE]
  )
})

test('⑤ ⌘K 面板那条也交给胶囊跑：两个入口同一个行为', async () => {
  const main = await getMainWindow()
  const capsule = await getCapsuleWindow()
  await capsule.evaluate(() => window.api.launcher.hide())
  await main.keyboard.press('Meta+k')
  const palette = main.locator('[data-testid="command-palette"] input')
  await expect(palette).toBeVisible({ timeout: 15000 })
  await palette.fill('ping_no_args')
  const row = main.locator('[data-palette-key="mcp:fixture:ping_no_args"]')
  await expect
    .poll(async () => row.count(), { timeout: 20000 })
    .toBeGreaterThan(0, '面板与胶囊共用同一份命令源，MCP 行两边都该有')
  await row.first().click()
  // 面板把这条转交胶囊：胶囊窗出现且停在结果页上，而不是「按下去什么都没发生」
  await expect
    .poll(async () => (await callState(capsule))?.out ?? '', { timeout: 40000 })
    .toContain('echo:-')
})
