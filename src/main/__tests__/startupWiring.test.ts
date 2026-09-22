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
})
