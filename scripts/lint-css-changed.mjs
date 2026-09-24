#!/usr/bin/env node
/**
 * 增量 CSS 门禁 —— 2026-09-24 重建件（原件随 2026-09-22 删除事故丢失、从未入库）
 *
 * 用法：
 *   node scripts/lint-css-changed.mjs              # 工作区改动（staged/unstaged/untracked）
 *   node scripts/lint-css-changed.mjs --base main  # 与 main 的 merge-base 起 diff（分支开发）
 *   STRICT_CSS_LINT=1 node scripts/...             # warning 也算失败（CI 用这个口径）
 *
 * 退出码：0 通过；1 有 error（或 strict 下有 warning）；2 stylelint 跑不起来
 * （配置缺失等 —— 绝不静默跳过，B16 的教训是「静默跳过比失败更危险」）。
 *
 * 契约与已知差异见 scripts/lib/lintCssChanged.mjs 文件头。
 */

import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listChangedStyleFiles, resolveDiffRange, decideOutcome } from './lib/lintCssChanged.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
/** 配置与脚本同仓库根（显式传给 stylelint，临时目录/子目录调用也能命中同一份规则） */
const CONFIG_FILE = join(SCRIPT_DIR, '..', 'stylelint.config.mjs')
const execFileP = promisify(execFile)

async function runGit(sub, range) {
  if (sub === 'status') {
    // quotePath=false：中文等非 ASCII 路径按原文输出，别让 \xxx 八进制转义混进路径
    const { stdout } = await execFileP(
      'git',
      ['-c', 'core.quotePath=false', 'status', '--porcelain'],
      { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024 }
    )
    return stdout
  }
  const { stdout } = await execFileP('git', ['diff', '--name-only', range], {
    cwd: process.cwd(),
    maxBuffer: 64 * 1024 * 1024
  })
  return stdout
}

async function main() {
  const argv = process.argv.slice(2)
  let base = null
  const baseIdx = argv.indexOf('--base')
  if (baseIdx !== -1 && argv[baseIdx + 1]) base = argv[baseIdx + 1]

  const files = await listChangedStyleFiles({
    runGit,
    fileExists: existsSync,
    env: process.env,
    base
  })

  if (files.length === 0) {
    console.log('lint:css:changed：没有需要 lint 的改动样式文件（.css/.less/.vue）')
    return
  }

  const { default: stylelint } = await import('stylelint')
  let result
  try {
    result = await stylelint.lint({
      files,
      configFile: CONFIG_FILE,
      formatter: 'string'
    })
  } catch (err) {
    console.error('lint:css:changed：stylelint 运行失败（不静默跳过）——', err?.message ?? err)
    process.exit(2)
  }

  const results = result.results ?? []
  // stylelint 17 的 result 上没有 errorCount/warningCount 聚合字段，output 也可能为空 ——
  // 报告与计数一律从 warnings 数组自建（这正是重建测试要钉住的：不许「静默 0 问题」）
  const rel = (p) => (p.startsWith('/') ? relative(process.cwd(), p) : p)
  const problems = results.flatMap((r) =>
    (r.warnings ?? []).map((w) => ({
      file: rel(r.source ?? ''),
      line: w.line,
      column: w.column,
      severity: w.severity === 'error' ? 'error' : 'warning',
      text: w.text
    }))
  )
  const errorCount = problems.filter((p) => p.severity === 'error').length
  const warningCount = problems.length - errorCount
  const strict = ['1', 'true'].includes(
    String(process.env.STRICT_CSS_LINT ?? '').trim().toLowerCase()
  )

  for (const p of problems) {
    console.log(`${p.file}:${p.line}:${p.column}  ${p.severity}  ${p.text}`)
  }

  const scope = base ? `--base ${base}` : resolveDiffRange(process.env) ? 'CI 增量' : '工作区改动'
  const outcome = decideOutcome({ errorCount, warningCount }, strict)
  const verdict = outcome.ok
    ? outcome.kind === 'clean'
      ? '通过'
      : '通过（存量 warning 容忍，勿新增）'
    : '失败'
  console.log(
    `lint:css:changed —— ${scope}：${files.length} 个文件，` +
      `${errorCount} error / ${warningCount} warning` +
      `${strict ? '（STRICT_CSS_LINT=1：增量零容忍）' : ''} → ${verdict}`
  )

  if (!outcome.ok) process.exit(1)
}

main().catch((err) => {
  console.error('lint:css:changed：未预期失败 ——', err?.message ?? err)
  process.exit(2)
})
