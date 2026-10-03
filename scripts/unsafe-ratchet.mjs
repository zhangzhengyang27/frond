#!/usr/bin/env node
/**
 * Frond · no-unsafe-* 数量棘轮（B46 战役守门）
 *
 * better-sqlite3 的 .get()/.all() 返回 any/unknown 行 → 全仓 11 个 Repository 及
 * 消费链 no-unsafe-* 家族 2400+ 条 warn。战役打法：
 *   1. 本脚本产出按「规则×文件」计数的快照（lint-unsafe-baseline.json）
 *   2. 之后每次跑棘轮：当前计数 ≤ 快照 → 通过；任何一条上涨 → exit 1
 *   3. 类型化一个 Repository 后跑 `pnpm lint:ratchet --update` 把快照钉到新低
 *
 * 用法：
 *   pnpm lint:ratchet            # 校验（CI / 提交前）
 *   pnpm lint:ratchet --update   # 类型化推进后更新基线（只允许降）
 *   pnpm lint:ratchet --report   # 只打印 top 文件分布，不校验
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(ROOT, 'lint-unsafe-baseline.json')
const RULES = [
  'no-unsafe-assignment',
  'no-unsafe-call',
  'no-unsafe-member-access',
  'no-unsafe-return',
  'no-unsafe-argument'
]
const argv = process.argv.slice(2)
const UPDATE = argv.includes('--update')
const REPORT = argv.includes('--report')

function runEslint() {
  const raw = execFileSync('pnpm', ['exec', 'eslint', 'src', '--format', 'json'], {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024
  })
  return JSON.parse(raw)
}

function collect(results) {
  const byFile = new Map()
  let total = 0
  for (const file of results) {
    const counts = {}
    let fileTotal = 0
    for (const msg of file.messages) {
      const rule = msg.ruleId ?? ''
      const short = RULES.find((r) => rule.endsWith(r))
      if (!short) continue
      counts[short] = (counts[short] ?? 0) + 1
      fileTotal += 1
    }
    if (fileTotal === 0) continue
    const rel = file.filePath.slice(ROOT.length + 1)
    byFile.set(rel, counts)
    total += fileTotal
  }
  return { total, byFile }
}

const results = runEslint()
const current = collect(results)

if (REPORT) {
  const top = [...current.byFile.entries()].sort((a, b) => {
    const sum = (m) => Object.values(m).reduce((x, y) => x + y, 0)
    return sum(b[1]) - sum(a[1])
  })
  for (const [file, counts] of top.slice(0, 25)) {
    console.log(String(Object.values(counts).reduce((x, y) => x + y, 0)).padStart(5), file)
  }
  console.log(`total: ${current.total}`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify({ total: current.total, files: Object.fromEntries(current.byFile) }, null, 2))
  console.log(`基线已建立：${current.total} 条（${BASELINE}）`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf-8'))

// ── 校验：按文件逐规则比较，任何上涨都失败 ──
const violations = []
for (const [file, counts] of current.byFile) {
  const base = baseline.files[file] ?? {}
  for (const rule of RULES) {
    const now = counts[rule] ?? 0
    const was = base[rule] ?? 0
    if (now > was) violations.push(`${file} ${rule}: ${was} → ${now}`)
  }
}
// 基线里有、现在消失的文件属正常（清零），不校验"必须下降"——只挡上涨
if (violations.length > 0) {
  console.error(`棘轮被咬：no-unsafe 计数上涨（B46 只减不增）\n` + violations.map((v) => `  - ${v}`).join('\n'))
  console.error(`如确为类型化推进后的预期状态，请核对后运行 pnpm lint:ratchet --update`)
  process.exit(1)
}

console.log(`棘轮通过：${current.total} 条 ≤ 基线 ${baseline.total} 条`)
if (UPDATE) {
  // 全量更新（更新前已通过上涨校验，说明是净下降）
  writeFileSync(BASELINE, JSON.stringify({ total: current.total, files: Object.fromEntries(current.byFile) }, null, 2))
  console.log(`基线已更新：${baseline.total} → ${current.total}（净降 ${baseline.total - current.total}）`)
}
