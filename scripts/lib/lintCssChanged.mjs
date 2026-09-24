/**
 * lint-css-changed · 纯判定部分（2026-09-24 重建件）
 *
 * 原件随 2026-09-22 删除事故丢失、从未入库。可考的调用点契约（重建依据，改前先读）：
 *   - docs/BUGS.md B16（:224）：porcelain 行必须用 `^(..)\s+(.+)$` 解析，已暂存文件
 *     的路径不得被截掉首字符 —— 原件死在这一步，导致严格 CSS 检查形同虚设
 *   - ci.yml:36-39：增量零容忍（STRICT_CSS_LINT=1 时 warning 也拦），存量渐进清零
 *   - CONTRIBUTING.md:26：只查改动的 .css/.less/.vue
 *
 * 与原件的已知差异：新增 CI diff 口径（push/PR）与 `--base` 参数 —— B16 记载的原件
 * 只有 status 口径，CI 的 checkout 是干净工作区，status 口径下 CI 步骤实际空转；
 * ci.yml 注释声明的「只对增量做零容忍」只有在 diff 口径下才成立。差异刻意在文件头
 * 声明（恢复件文化：与原件的出入必须可见，不许静默漂）。
 */

import { readFileSync } from 'node:fs'

export const STYLE_EXTENSIONS = ['.css', '.less', '.vue']

/**
 * 解析 `git status --porcelain` 输出为路径数组。
 *
 * 三种形态（B16 契约）：
 *   ` M path`  未暂存修改    `M  path`  已暂存修改（行内两个空格——原件 slice(3) 曾把
 *              这类行解析成残路径，existsSync 失败后被静默排除）
 *   `?? path`  未跟踪
 *   `MM path`  双重修改（去重交给 selectStyleFiles）
 *   `R  old -> new`  重命名（取新路径）
 *
 * 不认识的行**不猜**：跳过而不是编出一个路径（宁可漏报，不可错报）。
 */
export function parsePorcelainStatus(output) {
  const out = []
  for (const line of String(output ?? '').split('\n')) {
    if (!line) continue
    const m = /^(..)\s+(.+)$/.exec(line)
    if (!m) continue
    let path = m[2]
    // porcelain 对含特殊字符的路径加 C 风格引号（已用 core.quotePath=false 缓解，
    // 这里兜底解一层；解不开就按原文交给 existsSync 判定，不静默丢）
    if (path.startsWith('"') && path.endsWith('"') && path.length > 1) {
      try {
        path = JSON.parse(path)
      } catch {
        /* 保持原文 */
      }
    }
    const rename = /^(.*) -> (.*)$/.exec(path)
    if (rename) path = rename[2]
    out.push(path)
  }
  return out
}

/** 只留样式文件（.css/.less/.vue），去重且保序 */
export function selectStyleFiles(paths) {
  const seen = new Set()
  const out = []
  for (const p of paths ?? []) {
    const dot = p.lastIndexOf('.')
    if (dot < 0) continue
    if (!STYLE_EXTENSIONS.includes(p.slice(dot).toLowerCase())) continue
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

/**
 * CI 增量口径：返回 `{ range, reason }` 或 null（回退 status 口径）。
 *   pull_request → `origin/<base>...HEAD`（merge-base 起，即「这个 PR 动了什么」）
 *   push         → `<event.before>..HEAD`（before 全零 = 新建分支，无基线可 diff）
 * readEventFile 可注入（测试用）；默认读 GITHUB_EVENT_PATH。
 */
export function resolveDiffRange(env = {}, readEventFile = (p) => readFileSync(p, 'utf8')) {
  if (env.GITHUB_ACTIONS !== 'true' && env.GITHUB_ACTIONS !== '1') return null
  if (env.GITHUB_EVENT_NAME === 'pull_request' && env.GITHUB_BASE_REF) {
    return {
      range: `origin/${env.GITHUB_BASE_REF}...HEAD`,
      reason: `pull_request：与 origin/${env.GITHUB_BASE_REF} 的 merge-base 起 diff`
    }
  }
  if (env.GITHUB_EVENT_NAME === 'push') {
    let before = null
    try {
      before = JSON.parse(readEventFile(env.GITHUB_EVENT_PATH))?.before ?? null
    } catch {
      before = null
    }
    if (before && !/^0+$/.test(String(before))) {
      return { range: `${before}..HEAD`, reason: 'push：与推送前基线 diff' }
    }
  }
  return null
}

/**
 * 门禁判定：error 必拦；STRICT_CSS_LINT=1 时 warning 也拦（增量零容忍）；
 * 非 strict 时 warning 放行（存量 946 warnings 的容忍口径，渐进清零）。
 */
export function decideOutcome({ errorCount, warningCount }, strict) {
  if (errorCount > 0) return { ok: false, kind: 'error' }
  if (strict && warningCount > 0) return { ok: false, kind: 'warning' }
  return { ok: true, kind: warningCount > 0 ? 'warning-tolerated' : 'clean' }
}

/**
 * 收集需要 lint 的样式文件（相对 cwd 的路径）。
 * 口径优先级：显式 --base > CI diff（resolveDiffRange）> 工作区 status。
 * 已删除的路径在这里被 exists 过滤掉（status 里 ` D` 行会进解析结果）。
 */
export async function listChangedStyleFiles({
  runGit,
  fileExists,
  env = {},
  readEventFile,
  base = null
}) {
  const diff = base ? { range: `${base}...HEAD` } : resolveDiffRange(env, readEventFile)
  const raw = diff ? await runGit('diff', diff.range) : await runGit('status')
  // diff 口径的原始输出是按行分隔的路径串；status 口径由 parsePorcelainStatus 解析
  const paths = diff ? String(raw ?? '').split('\n') : parsePorcelainStatus(raw)
  return selectStyleFiles(paths.filter((p) => p && fileExists(p)))
}
