import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from '@tailwindcss/node'

/**
 * 幽灵类门禁 · 管线版（2026-09-30 批 1 随 dump 退役重写）。
 *
 * 演进：旧版以「main.css 转储 + recovered-css-gap.css 补口」为 CSS 事实源——
 * 因为那时没有生成管线，类名必须在静态文件里人工登记，转储后新增的类会静默失效
 * （B17 家族、设置页 0×0 开关都栽在这条根上）。
 *
 * 现在 Tailwind 4 管线（styles/tailwind.css）是唯一工具类事实源。本门禁用
 * @tailwindcss/node 的 compile()（与 @tailwindcss/vite 插件同引擎）在测试内编译
 * 管线入口，把从模板扫到的候选类喂给 build()，产物即「管线会生成的全部工具类」。
 * 判定：模板出现、而管线与既有事实源（SFC scoped / global.css /
 * legacy-preflight.css / remixicon）都不认识的类 = 红。这就是路线图批 1 的
 * 「产物 diff = 0」验收门禁化：写对的新工具类天然被管线生成，本测试绿；
 * 写错的类名（TW4 不认识且无自定义定义）→ 红。
 *
 * 已知局限（沿旧版）：运行时拼接的类名扫不到；逃逸口是 inline style。
 */

const repoRoot = join(__dirname, '../../../..')
const stylesDir = join(repoRoot, 'src/renderer/src/styles')

function collectVueFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      out.push(...collectVueFiles(join(dir, e.name)))
    } else if (e.name.endsWith('.vue')) {
      out.push(join(dir, e.name))
    }
  }
  return out
}

/** 候选提取：静态 class="..." + :class 绑定里的字符串字面量（与旧版逐字一致） */
function buildCandidates(): string[] {
  const candidates: string[] = []
  for (const file of collectVueFiles(join(repoRoot, 'src/renderer/src'))) {
    const src = readFileSync(file, 'utf-8')
    for (const m of src.matchAll(/(?<![:@\w-])class="([^"]*)"/g)) {
      candidates.push(...m[1].split(/\s+/))
    }
    for (const m of src.matchAll(/(?<!\w):class="([^"]*)"/g)) {
      for (const lit of m[1].matchAll(/'([^']*)'/g)) {
        const v = lit[1]
        if (/\s/.test(v) || /[-:[]/.test(v)) candidates.push(...v.split(/\s+/))
      }
    }
  }
  return candidates
}

/** 非管线的既有事实源：SFC <style> 段 + 全局自定义 + TW3 preflight 保留 + 图标库 */
function buildExtraFacts(): string {
  let styleText = ''
  for (const f of collectVueFiles(join(repoRoot, 'src/renderer/src'))) {
    const src = readFileSync(f, 'utf-8')
    for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styleText += m[1] + '\n'
  }
  return (
    styleText +
    readFileSync(join(stylesDir, 'global.css'), 'utf-8') +
    readFileSync(join(stylesDir, 'legacy-preflight.css'), 'utf-8') +
    readFileSync(join(repoRoot, 'node_modules/remixicon/fonts/remixicon.css'), 'utf-8')
  )
}

const CSS_SPECIAL = /([:.[\]()/\\%#,+'~!@*$&|])/g

/** 类名 → CSS 转义形态（.h-\[18px\] 这类） */
function cssEscape(token: string): string {
  return token.replace(CSS_SPECIAL, '\\$1')
}

/** 类名是否真的有定义：必须 `.` 锚定命中（防变体前缀子串掩蔽） */
function isDefined(token: string, facts: string): boolean {
  return facts.includes('.' + cssEscape(token))
}

/** 候选类名形态：小写字母/数字开头 + 工具类字符集 */
const UTILITY_SHAPE = /^[a-z][a-z0-9:.[\]()/:%#!_,-]*$/

/** 确认不是 CSS 类的字符串（测试钩子/组件内部约定），带理由放行 */
const ALLOWLIST = new Map<string, string>([
  // LauncherApp 里 :class 中的动作名比较值（'fallback:ai' 是 AI 通道名，不是类）
  ['fallback:ai', '路由/动作名值字符串，不是 CSS 类'],
  // B3：scrollBehavior 靠它找滚动容器，是 JS 钩子不是样式类
  ['app-scroll', '滚动容器标记类（scrollBehavior 查找用），无样式语义'],
  // snippets 三栏布局全由工具类承担，类名只作语义标记
  ['snippets-main', '布局标记类，样式全部由同行工具类承担']
])

/** 基线（现为空集）：确实还不了的样式债往这里加条目（写明出处），新增基线外幽灵类 = 红 */
const BASELINE = new Set<string>([])

describe('幽灵类门禁（管线版：每个候选类都必须被 TW4 管线或既有事实源定义）', () => {
  it('扫描全部 .vue 的 class/:class，经管线编译后逐 token 查证', async () => {
    const cssInput = readFileSync(join(stylesDir, 'tailwind.css'), 'utf-8')
    const compiler = await compile(cssInput, {
      base: stylesDir,
      onDependency: () => {}
    })
    const candidates = buildCandidates().filter(
      (t) => t && t.length >= 2 && UTILITY_SHAPE.test(t) && !ALLOWLIST.has(t) && !BASELINE.has(t)
    )
    const pipelineCss = compiler.build(candidates)
    const facts = pipelineCss + '\n' + buildExtraFacts()

    const ghosts = new Map<string, Set<string>>() // token -> files
    for (const file of collectVueFiles(join(repoRoot, 'src/renderer/src'))) {
      const src = readFileSync(file, 'utf-8')
      const rel = file.slice(repoRoot.length + 1)
      const local: string[] = []

      for (const m of src.matchAll(/(?<![:@\w-])class="([^"]*)"/g)) {
        local.push(...m[1].split(/\s+/))
      }
      for (const m of src.matchAll(/(?<!\w):class="([^"]*)"/g)) {
        for (const lit of m[1].matchAll(/'([^']*)'/g)) {
          const v = lit[1]
          if (/\s/.test(v) || /[-:[]/.test(v)) local.push(...v.split(/\s+/))
        }
      }

      for (const token of local) {
        if (!token || token.length < 2) continue
        if (!UTILITY_SHAPE.test(token)) continue
        if (ALLOWLIST.has(token)) continue
        if (BASELINE.has(token)) continue
        if (isDefined(token, facts)) continue
        if (!ghosts.has(token)) ghosts.set(token, new Set())
        ghosts.get(token)!.add(rel)
      }
    }

    const detail = [...ghosts.entries()]
      .map(([token, files]) => `  ${token}\n    <- ${[...files].slice(0, 3).join(', ')}`)
      .join('\n')
    expect(
      ghosts.size,
      `发现 ${ghosts.size} 个幽灵类（TW4 管线与既有事实源都不认识，样式会静默失效）。` +
        `新工具类请直接写标准 TW4 类名（管线自动生成）；确属自定义的进 styles/global.css；` +
        `确实不是 CSS 类的加进本文件 ALLOWLIST 并写明理由：\n${detail}`
    ).toBe(0)
  }, 60_000)

  it('解析哨兵：管线编译与查证链路自证能抓到已知类', async () => {
    const cssInput = readFileSync(join(stylesDir, 'tailwind.css'), 'utf-8')
    const compiler = await compile(cssInput, {
      base: stylesDir,
      onDependency: () => {}
    })
    // 管线应能生成这些（标准类 + 桥接语义类 + 变体）
    const probes = ['rounded-md', 'hover:scale-110', 'group-hover:opacity-100', 'bg-surface-1']
    const css = compiler.build(probes)
    for (const token of probes) {
      expect(isDefined(token, css), `${token} 应由管线生成`).toBe(true)
    }
    // `.` 锚定确实在工作：未使用的 hover:opacity-50 不许被 group-hover 定义掩蔽放行
    expect(isDefined('hover:opacity-50', css)).toBe(false)
    // 图标类走 remixicon 事实源
    expect(isDefined('ri-arrow-down-s-line', buildExtraFacts())).toBe(true)
  }, 60_000)
})
