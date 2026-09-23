import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 渲染端 API 奇偶校验：扫描 renderer 中所有 window.api.<ns>.<method> 调用，
 * 与 preload 实际暴露的对象结构（src/preload/index.ts）逐一比对。
 *
 * 背景：与插件 getClipboardText 同类的风险——渲染端调用 preload 未暴露的
 * 方法时得到 undefined，运行时静默 TypeError。本测试把这类断链变成构建期失败。
 *
 * 已知局限（记录于白名单）：经变量间接访问（如 useScreenRecorder 的
 * `window.api as unknown as {recording...}` 深链写法）不在静态扫描范围内。
 */

const repoRoot = resolveRepoRoot()

function resolveRepoRoot(): string {
  return join(__dirname, '../../..')
}

/** 从 preload/index.ts 静态解析暴露面：'ns.method' / 'ns.sub.method' / 顶层 'method' */
function extractExposedApiSurface(): Set<string> {
  const source = readFileSync(join(repoRoot, 'src/preload/index.ts'), 'utf-8')
  const lines = source.split('\n').filter((l) => {
    const t = l.trimStart()
    return !(t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))
  })

  const exposed = new Set<string>()
  const stack: string[] = []

  for (const line of lines) {
    const m = line.match(/^(\s+)(\w+):\s*(.*)$/)
    if (!m) continue
    const indent = m[1].length
    const name = m[2]
    const rest = m[3]
    // 缩进回退时弹出路径（顶层键缩进 2、子级 4、孙级 6）
    while (stack.length * 2 + 2 > indent) stack.pop()
    const isNamespace = /^\{/.test(rest.trimStart())
    if (isNamespace) {
      stack.push(name)
    } else {
      exposed.add([...stack, name].join('.'))
    }
  }

  // 解析器哨兵：preload 结构大改导致漏抓时先在这里失败
  for (const sentinel of ['pomodoro.projects.getAll', 'recording.segments.open', 'system.info']) {
    expect(exposed.has(sentinel), `API 解析异常：未抓到 ${sentinel}`).toBe(true)
  }
  return exposed
}

/** 递归收集 renderer 源文件（.vue / .ts，排除 .d.ts 与测试） */
function collectRendererFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      out.push(...collectRendererFiles(join(dir, e.name)))
    } else if (e.isFile() && (/\.vue$/.test(e.name) || /\.ts$/.test(e.name))) {
      if (/\.d\.ts$/.test(e.name) || /\.test\.ts$/.test(e.name)) continue
      out.push(join(dir, e.name))
    }
  }
  return out
}

describe('渲染端 window.api 奇偶校验', { timeout: 120_000 }, () => {
  it('renderer 调用的每个 api 路径都在 preload 暴露面中存在', () => {
    const exposed = extractExposedApiSurface()
    // 少了这一行整个测试就是「扫了个空目录」——恢复事故里它被吞过一次，正例计数兜住
    const files = collectRendererFiles(join(repoRoot, 'src/renderer/src'))
    expect(files.length, 'renderer 源文件一个都没扫到 = 路径错，不是通过').toBeGreaterThan(50)
    let matchCount = 0
    const offenders: string[] = []

    for (const file of files) {
      const rel = file.slice(repoRoot.length + 1)
      const src = readFileSync(file, 'utf-8')
      const code = src
        .split('\n')
        .filter((l) => {
          const t = l.trimStart()
          return !(t.startsWith('//') || t.startsWith('*'))
        })
        .join('\n')
      // 捕获 window.api 之后至少两段属性链（window.api.ns.method[.sub]）
      for (const m of code.matchAll(/window\.api\??\.(\w+(?:\.\w+)+)/g)) {
        matchCount++
        const chain = m[1]
        // 命中规则：完整链或其任意前缀在暴露面中（前缀用于「先取子对象再调方法」写法）
        const segs = chain.split('.')
        const ok = segs.some((_, i) => exposed.has(segs.slice(0, i + 1).join('.')))
        if (!ok) offenders.push(`${rel}: window.api.${chain} 不在 preload 暴露面中`)
      }
    }

    // 体量哨兵：防止扫描退化成空转（如 renderer 改为解构/别名访问导致 0 匹配时假绿）。
    // 当前基线约 376 处调用 / 255 条链；显著低于基线说明扫描器或访问模式变了，需人工复核
    expect(matchCount).toBeGreaterThan(200)

    expect(offenders, `发现 ${offenders.length} 处幽灵 API 调用:\n${offenders.join('\n')}`).toEqual(
      []
    )
  })
})
