import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 幽灵类门禁（B17 家族的系统性防线）。
 *
 * 背景：`assets/main.css` 是 2026-09-22 的编译产物静态转储——**没有 Tailwind
 * 生成管线**。转储之后新增的任何工具类都静默失效（B17/B18 幽灵类、设置页
 * 0×0 开关、UModal max-h-[70vh] 底栏顶出屏幕都是这条根上的）。缺口由
 * `styles/recovered-css-gap.css` 手工补（取值依据见其文件头）。
 *
 * 本测试把「类名必须在 CSS 事实源里存在」变成门禁：扫描全部 .vue 的
 * class 与 :class 字符串，逐一在 main.css + gap 文件 + 全部 SFC <style>
 * 里查证。新增幽灵类 = 测试红；要引入新工具类 = 先补进 gap 文件。
 *
 * 已知局限：模板里运行时拼出来的类（变量拼接而非完整字面量）扫不到；
 * 逃逸口是 inline style（如 UModal 的 max-height:70vh）。
 */

const repoRoot = join(__dirname, '../../../..')

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

/** 事实源：转储 + 手工补口 + 全部 SFC <style>（含 scoped）+ remixicon 图标类 */
function buildFactSources(): { text: string; styleText: string } {
  const text =
    readFileSync(join(repoRoot, 'src/renderer/src/assets/main.css'), 'utf-8') +
    readFileSync(join(repoRoot, 'src/renderer/src/styles/recovered-css-gap.css'), 'utf-8') +
    readFileSync(join(repoRoot, 'node_modules/remixicon/fonts/remixicon.css'), 'utf-8')
  let styleText = ''
  for (const f of collectVueFiles(join(repoRoot, 'src/renderer/src'))) {
    const src = readFileSync(f, 'utf-8')
    for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styleText += m[1] + '\n'
  }
  return { text, styleText }
}

const CSS_SPECIAL = /([:.[\]()/\\%#,+'~!@*$&|])/g

/** 类名 → CSS 里的转义形态（.h-\[18px\] 这类） */
function cssEscape(token: string): string {
  return token.replace(CSS_SPECIAL, '\\$1')
}

/** 类名是否真的有定义：必须 `.` 锚定命中——否则 hover\:opacity-100 会被
 *  group-hover\:opacity-100 的子串掩蔽（变体前缀边界） */
function isDefined(token: string, facts: string): boolean {
  return facts.includes('.' + cssEscape(token))
}

/** 候选类名形态：小写字母/数字开头 + 工具类字符集（含变体冒号、任意值方括号） */
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

/**
 * 幽灵基线（2026-09-29 门禁落地时点存量，80 条）。
 *
 * 全部是「重建件 main.css 转储时刻不存在、gap 文件也未曾补过」的组件样式族：
 * FocusShield（shield- 前缀族）、Markdown 呈现（markdown- / presentation- /
 * controls- 前缀族）、番茄钟统计与任务抽屉（stats- / export- / summary- /
 * timeline- / drawer- 前缀族）、胶囊内联页（dict-content、system-info-content、
 * 各 *-list）等 —— 这些类的样式在 2026-09-22 的仓库事故重建中丢失，组件按当前
 * DOM 结构裸奔（B17 家族的存量债）。
 *
 * 基线是待清台账不是豁免：每重建一个组件样式族，就把对应条目从基线删掉；
 * 新增代码引入基线外的新幽灵类 = 本测试红。逐条重建见 BUGS B17 存量条目。
 */
const BASELINE = new Set([
  'app-scroll',
  'action-btn',
  'action-feedback',
  'action-row',
  'assets-hint',
  'close-btn',
  'code-block',
  'control-btn',
  'controls-left',
  'controls-right',
  'drawer-body',
  'drawer-description',
  'dual-grid',
  'empty',
  'export-bar',
  'export-btn',
  'export-feedback',
  'export-label',
  'external',
  'free-records',
  'hint-actions',
  'hint-text',
  'icon-btn',
  'loading',
  'loading-spinner',
  'markdown-content',
  'markdown-presentation-container',
  'markdown-wrapper',
  'page-indicator',
  'preview-btn',
  'preview-btn-close',
  'preview-content',
  'presentation-content',
  'presentation-controls',
  'priority-bar',
  'range-btn',
  'range-switcher',
  'scale-display',
  'section-header',
  'section-meta',
  'snippets-main',
  'statistics-panel',
  'stats-icon',
  'stats-title-row',
  'stats-topbar',
  'summary-card',
  'summary-card-wide',
  'summary-grid',
  'summary-label',
  'summary-unit',
  'timeline',
  'timeline-card',
  'timeline-card-body',
  'timeline-card-head',
  'timeline-dot',
  'timeline-duration',
  'timeline-item',
  'timeline-meta',
  'timeline-mode',
  'timeline-section',
  'timeline-time'
])

describe('幽灵类门禁（每个 class 都必须能在 CSS 事实源里查到）', () => {
  it('扫描全部 .vue 的 class/:class，逐 token 查证', () => {
    const { text, styleText } = buildFactSources()
    const facts = text + '\n' + styleText
    const ghosts = new Map<string, Set<string>>() // token -> files

    for (const file of collectVueFiles(join(repoRoot, 'src/renderer/src'))) {
      const src = readFileSync(file, 'utf-8')
      const rel = file.slice(repoRoot.length + 1)
      const candidates: string[] = []

      // 静态 class="..."（不能匹配到 :class 的值，那里另抽字符串字面量）
      for (const m of src.matchAll(/(?<![:@\w-])class="([^"]*)"/g)) {
        candidates.push(...m[1].split(/\s+/))
      }
      // :class 绑定里的字符串字面量。只收「像类列表」的：含空白、或带 -/[:/[
      // （三元里 'webm' === fmt 这类比较值与单个自定义类名无法区分，不扫——
      // 已知局限，静态 class="..." 不受此限）
      for (const m of src.matchAll(/(?<!\w):class="([^"]*)"/g)) {
        for (const lit of m[1].matchAll(/'([^']*)'/g)) {
          const v = lit[1]
          if (/\s/.test(v) || /[-:[]/.test(v)) candidates.push(...v.split(/\s+/))
        }
      }

      for (const token of candidates) {
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
      `发现 ${ghosts.size} 个基线外新幽灵类（CSS 事实源里不存在，样式静默失效）。` +
        `新工具类请补进 src/renderer/src/styles/recovered-css-gap.css（取值依据写注释），` +
        `确实不是 CSS 类的加进本文件 ALLOWLIST 并写明理由：\n${detail}`
    ).toBe(0)

    // 基线瘦身边：条目「样式已补上（isDefined）」或「模板里已不再使用」时
    // 提示从 BASELINE 删除（不红，只提示；重建 B39 的工作流就是补样式→划账）
    const usedInTemplates = new Set<string>()
    for (const file of collectVueFiles(join(repoRoot, 'src/renderer/src'))) {
      const src = readFileSync(file, 'utf-8')
      for (const token of BASELINE) {
        if (src.includes(token)) usedInTemplates.add(token)
      }
    }
    const cleared = [...BASELINE].filter(
      (t) => !usedInTemplates.has(t) || isDefined(t, facts + '\n' + styleText)
    )
    if (cleared.length > 0) {
      console.warn(
        `[ghost-baseline] 以下基线条目在模板中已不再出现，请从 BASELINE 删除：${cleared.join(', ')}`
      )
    }
  })

  it('解析哨兵：扫描器自己先证明能抓到已知类与已知幽灵形态', () => {
    // 门禁自身的哨兵：提取器失效（正则被改坏）时会两边都抓不到 → 全绿假象
    const src = readFileSync(
      join(repoRoot, 'src/renderer/src/components/ui/UModal.vue'),
      'utf-8'
    )
    expect(src.length, 'UModal.vue 读不到').toBeGreaterThan(0)
    const { text, styleText } = buildFactSources()
    const facts = text + '\n' + styleText
    // 已知存在的类必须能查到（转义 + 锚定链路正确性）
    expect(isDefined('rounded-md', facts), 'rounded-md 应在事实源里').toBe(true)
    expect(isDefined('hover:scale-110', facts), '变体转义链路应能命中').toBe(true)
    expect(isDefined('ri-arrow-down-s-line', facts), '图标类应经 remixicon 命中').toBe(true)
    // `.` 锚定确实在工作：group-hover 的定义不许掩蔽裸 hover 变体
    expect(isDefined('group-hover:opacity-100', facts)).toBe(true)
    expect(
      isDefined('hover:opacity-50', facts),
      'hover:opacity-50（事实源确无）不该被 .opacity-50 或 group-hover 定义掩蔽放行'
    ).toBe(false)
  })
})
