import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 启动接线的静态审计。
 *
 * 为什么要有这一条：`registerAutomationIpc()` 在、`startAutomationEngine()` 不在，
 * 是这次复原里最难发现的一种缺——IPC 注册了、任务写得进库、单测全绿，
 * 但**到点没人触发**，而唯一能证它的 e2e 又恰好被缺页组件拦着。
 * 同理，「同一段贴两遍」（will-quit 里曾有两行 `stopAllMcpServers()`）是
 * 2026-09-22 恢复事故的签名，靠人眼在几百行启动流程里看不出来。
 *
 * 本文件与 `renderer-api-parity.test.ts` 同一口径：读源码、不启动 Electron。
 */

const repoRoot = join(__dirname, '../../..')
const source = readFileSync(join(repoRoot, 'src/main/index.ts'), 'utf-8')

/** 取 `app.on('will-quit', …)` 回调体（按花括号配对，不靠缩进猜） */
function willQuitBody(src: string): string {
  const start = src.indexOf("app.on('will-quit'")
  expect(start, 'index.ts 里得有一个 will-quit 清理钩子').toBeGreaterThanOrEqual(0)
  const open = src.indexOf('{', src.indexOf('=>', start))
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  throw new Error('will-quit 回调没闭合')
}

const codeLines = (block: string): string[] =>
  block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))

const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1

describe('主进程启动接线（index.ts）', () => {
  it('自动化引擎的心跳真的被起起来，也在退出时被停掉', () => {
    expect(
      countOf(source, 'startAutomationEngine()'),
      '只 registerAutomationIpc() 不起心跳 = 任务写得进库但永远不会触发'
    ).toBe(1)
    expect(countOf(source, 'stopAutomationEngine()')).toBe(1)
    expect(
      source.indexOf('startAutomationEngine()') > source.indexOf('registerAutomationIpc()'),
      '心跳要在 IPC 注册之后起（先起会读到还没接好的执行器）'
    ).toBe(true)
  })

  it('will-quit 的清理没有「同一段贴两遍」（恢复事故的签名）', () => {
    const lines = codeLines(willQuitBody(source))
    const adjacent = lines.slice(1).filter((l, i) => l === lines[i] && /\(/.test(l))
    expect(adjacent, `重复的清理语句：${JSON.stringify(adjacent)}`).toEqual([])
    expect(countOf(willQuitBody(source), 'stopAllMcpServers()'), 'MCP 子进程只该被杀一次').toBe(1)
  })

  it('截图 handler 真的被注册，且只注册一次', () => {
    // 这一条钉的是一个「静态看不见」的缺陷：registerScreenshotHandlers() 定义得好好的，
    // 但全仓零调用方 → `screenshot:startCapture` 从来没注册过，热键和按钮按下去都是空响。
    // 只数代码行：注释里就写着「这一行是补回来的：registerScreenshotHandlers() 此前…」，
    // 拿整份源码去数会被自己的注释骗到（第一版就被骗了一次）。
    const code = codeLines(source).join('\n')
    expect(
      countOf(code, 'registerScreenshotHandlers()'),
      '零调用方 = 截图整条链空转；多于一次 = 重复注册（同类事故见 permissions:probe）'
    ).toBe(1)
  })
})

describe('截图热键（launcher/hotkeys.ts）', () => {
  const hotkeys = readFileSync(join(repoRoot, 'src/main/launcher/hotkeys.ts'), 'utf-8')

  it('截图热键注册成功后要进 registeredAccelerators，否则 unregisterAll 漏掉它', () => {
    // 漏进这张表 = 改热键/重挂时旧加速器解绑不掉：⌥⇧S 会同时命中新旧两条回调。
    // 「注册了却没人记账」正是本仓反复出现的那一类，写死成断言而不是靠读。
    const shot = hotkeys.slice(
      hotkeys.indexOf('if (config.screenshot'),
      hotkeys.indexOf('for (const [accel, spec] of Object.entries(config.commands)')
    )
    expect(shot.length, '找不到截图热键的注册段').toBeGreaterThan(0)
    expect(
      countOf(shot, 'registeredAccelerators.push(config.screenshot)'),
      '截图热键没被登记 → unregisterAll() 不会解绑它'
    ).toBe(1)
    expect(countOf(shot, 'screenshotConflict = true'), '注册失败与抛异常两条都要记冲突').toBe(2)
  })
})
