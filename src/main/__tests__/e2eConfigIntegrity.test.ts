/**
 * Frond · e2e 启动配置完整性门禁
 *
 * 背景（2026-09-23）：`e2e/launch-smoke.spec.mjs` 与 `e2e/pomodoro.spec.mjs` 把
 * env 写成了 `electron.launch({ args, launchOptions: { env } })`，而 Playwright 的
 * Electron 实现是：
 *
 *   const env = options.env ? envArrayToObject(options.env) : process.env;
 *
 * —— `launchOptions` 不是 `LaunchOptions` 的键，于是 `options.env === undefined`，
 * **静默回退到 process.env**，本 spec 想做的覆盖全部失效且不报任何错。
 * 后果：pomodoro 那条自己声明的独立 userData 目录（`e2e-userdata-pomodoro`）
 * 形同虚设，退化成与所有 spec 共用 `playwright.config.mjs` 的公共目录。
 *
 * 本文件把「写错也不报错」变成「构建期失败」。三条断言各自带体量哨兵：
 * 扫描退化（扫到 0 个文件）必须失败，而不是「没有违规所以通过」。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '../../..')
const E2E_DIR = join(REPO_ROOT, 'e2e')

/** 剥离整行注释：本文件自己的注释里就写着 `launchOptions`，不剥会自我绊倒 */
function stripLineComments(src: string): string {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !(t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))
    })
    .join('\n')
}

function listSpecs(): string[] {
  return readdirSync(E2E_DIR)
    .filter((n) => n.endsWith('.spec.mjs'))
    .map((n) => join(E2E_DIR, n))
}

describe('e2e 启动配置完整性', { timeout: 30_000 }, () => {
  it('e2e/*.mjs 不得使用 launchOptions（env 必须是顶层选项）', () => {
    const specs = listSpecs()
    // 体量哨兵：扫到 0 个 spec 说明路径错了，不是「通过」。
    // 基线 29（2026-09-23 移出 4 个 zz-scratch 草稿后）；明显低于基线说明扫描失效或 spec 被大量删。
    expect(specs.length, 'e2e spec 一个都没扫到 = 路径错').toBeGreaterThan(25)

    const offenders: string[] = []
    for (const f of specs) {
      const code = stripLineComments(readFileSync(f, 'utf-8'))
      const rel = f.slice(REPO_ROOT.length + 1)
      code.split('\n').forEach((line, i) => {
        if (line.includes('launchOptions')) offenders.push(`${rel}:${i + 1} ${line.trim()}`)
      })
    }

    expect(
      offenders,
      `以下位置把 env 写进了 launchOptions —— Playwright 会忽略它并静默回退到 process.env：\n  ${offenders.join('\n  ')}\n` +
        `（正确写法：electron.launch({ args: [MAIN_ENTRY], env })）`
    ).toEqual([])
  })

  it('传 env 的 spec 必须展开 process.env（顶层 env 是整体替换，不是合并）', () => {
    const specs = listSpecs()
    const withLaunch = specs.filter((f) =>
      stripLineComments(readFileSync(f, 'utf-8')).includes('electron.launch(')
    )
    // 体量哨兵：真正调用 electron.launch 的 spec 数（基线 28）
    expect(withLaunch.length, '没有任何 spec 调用 electron.launch = 扫描失效').toBeGreaterThan(25)

    const offenders: string[] = []
    for (const f of withLaunch) {
      const code = stripLineComments(readFileSync(f, 'utf-8'))
      // 只检查确实传了 env 的（env 整体替换 process.env，漏展开会丢 PATH 等）
      if (!/\benv\b/.test(code)) continue
      if (!code.includes('...process.env')) offenders.push(f.slice(REPO_ROOT.length + 1))
    }

    expect(
      offenders,
      `这些 spec 传了 env 但没有展开 process.env —— Playwright 的 env 是整体替换，会丢掉 PATH/HOME：\n  ${offenders.join('\n  ')}`
    ).toEqual([])
  })

  it('playwright.config.mjs 必须设置 FROND_USER_DATA_DIR（隔离兜底）', () => {
    const cfg = stripLineComments(readFileSync(join(REPO_ROOT, 'playwright.config.mjs'), 'utf-8'))
    // 这是 e2e 不碰真实用户数据的第一道防线：进程级注入，spec 即使漏传也能兜住
    expect(cfg).toContain('FROND_USER_DATA_DIR')
    expect(cfg).toContain('test-results')
  })

  /**
   * 窗口选择方式（2026-09-24）
   *
   * 曾经有 7 个 spec 用「标题命中 /Frond/」来选主窗口。问题是胶囊窗的 title 是
   * "Frond Launcher"，**同样命中** —— 选到哪个完全取决于窗口创建顺序（实测
   * react-screenshots 覆盖层 → index.html → launcher.html，当前恰好选对），
   * 属潜在竞态。pomodoro 那次 8 条用例全绿而覆盖率为零，病根之一就在这里。
   *
   * 统一改为按 url 匹配 `/\/index\.html/`（本仓 23 个 spec 已在用）。
   */
  it('e2e/*.mjs 不得用窗口标题选窗口（胶囊窗 title 同样命中 /Frond/）', () => {
    const specs = listSpecs()
    expect(specs.length, 'e2e spec 一个都没扫到 = 路径错').toBeGreaterThan(25)

    // 哨兵：必须真有 spec 在用 url 选主窗口，否则本门禁可能扫错了目录
    const withUrlMatch = specs.filter((f) => /index\\\.html/.test(readFileSync(f, 'utf-8')))
    expect(withUrlMatch.length, '没有任何 spec 用 url 选主窗口 = 门禁可能扫错目录').toBeGreaterThan(
      15
    )

    const offenders: string[] = []
    for (const f of specs) {
      const code = stripLineComments(readFileSync(f, 'utf-8'))
      const rel = f.slice(REPO_ROOT.length + 1)
      code.split('\n').forEach((line, i) => {
        if (/\.title\(\)/.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim()}`)
      })
    }

    expect(
      offenders,
      `以下位置用窗口标题选窗口 —— 胶囊窗 title 是 "Frond Launcher"，同样命中 /Frond/，\n` +
        `选到哪个取决于窗口创建顺序（属潜在竞态）：\n  ${offenders.join('\n  ')}\n` +
        `（正确写法：if (/\\/index\\.html/.test(w.url())) return w）`
    ).toEqual([])
  })
})
