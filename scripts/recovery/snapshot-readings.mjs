#!/usr/bin/env node
/**
 * Frond · 权威读数快照（P1-10）
 *
 * 为什么存在：`HANDOFF.md` 自称「事实源」，但它的数字是靠人记的 —— 于是必然漂。
 * 实测（2026-09-24）：HANDOFF 写着「836 用例绿 / 8 红」，而当时真实读数是
 * **999 通过 / 0 失败**；迁移数、重建件数、spec 数也都对不上。评审 P1-10 的建议是
 * 「把权威读数从文档里搬成可执行脚本」—— 就是本文件。
 *
 * 用法：
 *   node scripts/recovery/snapshot-readings.mjs           # 静态读数（秒级）
 *   node scripts/recovery/snapshot-readings.mjs --tests    # 附带跑一遍单测拿用例数（约 1 分钟）
 *   node scripts/recovery/snapshot-readings.mjs --json     # 机器可读输出
 *
 * 原则：**只报能复算的数字**。算不出来的（例如「代码行数」这种没有意义的指标）
 * 就不报，而不是编一个。文档里凡是写死数字的地方，都应该改成「跑这条命令」。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const withTests = process.argv.includes('--tests')
const asJson = process.argv.includes('--json')

/** 递归收集文件（跳过 node_modules / 构建产物 / 外部参考仓库） */
function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'out', '.git', 'references'].includes(e.name)) continue
      walk(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

const srcFiles = walk(join(ROOT, 'src'))

/**
 * 1. 单测文件数。
 * 口径必须与 vitest 一致：`vitest.config.mts` 收 src / packages / scripts 下的 `.test.ts`，
 * 排除 e2e / references / 构建产物。只扫 src 会少数（实测 117 vs 122）。
 */
const testRoots = ['src', 'packages', 'scripts']
const allTestFiles = testRoots.flatMap((d) => walk(join(ROOT, d))).filter((f) => /\.test\.ts$/.test(f))
const unitTestFiles = allTestFiles

/** 2. 源文件数（src 下 .ts / .vue，不含测试） */
const sourceFiles = srcFiles.filter(
  (f) => /\.(ts|vue)$/.test(f) && !/\.test\.ts$/.test(f) && !/\.d\.ts$/.test(f)
)

/** 3. 数据库迁移数（逐文件，以 index.ts 的聚合为准更保险 —— 这里两个都报） */
const migrationFiles = readdirSync(join(ROOT, 'src/main/db/migrations')).filter((n) =>
  /^\d{3}_.*\.ts$/.test(n)
)

/** 4. 重建件数（事故后按调用点猜出来的文件，标记形如「2026-09-2X 重建」） */
const REBUILD_MARKER = /2026-09-2[23]\s*重建/
const rebuildFiles = srcFiles.filter((f) => {
  if (f.endsWith('rebuildLedger.test.ts')) return false // 台账自身不是重建件
  try {
    if (statSync(f).size > 2 * 1024 * 1024) return false
    return REBUILD_MARKER.test(readFileSync(f, 'utf-8'))
  } catch {
    return false
  }
})

/** 5. e2e spec 数 */
const e2eSpecs = readdirSync(join(ROOT, 'e2e')).filter((n) => n.endsWith('.spec.mjs'))

/**
 * 6/7. IPC 契约通道数 + 其中 req 非 void 的条数。
 *
 * 只数 key，不做形状解析 —— 这里不需要「req 是什么」，只需要「有几条」。
 * （解析形状请用 ipcContract.test.ts 里那套配平括号的写法，见该文件注释。）
 */
const contractSrc = readFileSync(join(ROOT, 'src/shared/ipc-contract.ts'), 'utf-8')
const contractKeys = [...contractSrc.matchAll(/^\s*'([^']+)'\s*:\s*\{/gm)].map((m) => m[1])

/** 8. 主进程裸 ipcMain.handle 数（应为 0，除契约外那 8 条有意的例外） */
let bareHandle = 0
for (const f of srcFiles) {
  if (!/\.ts$/.test(f) || /\.test\.ts$/.test(f)) continue
  const code = readFileSync(f, 'utf-8')
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !(t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))
    })
    .join('\n')
  bareHandle += (code.match(/ipcMain\.handle\(\s*['"`]/g) ?? []).length
}

const readings = {
  sourceFiles: sourceFiles.length,
  unitTestFiles: unitTestFiles.length,
  migrations: migrationFiles.length,
  rebuildArtifacts: rebuildFiles.length,
  e2eSpecs: e2eSpecs.length,
  ipcContractChannels: contractKeys.length,
  bareIpcHandle: bareHandle
}

if (withTests) {
  // vitest 的 json reporter 把结果写到文件；这里只在需要时跑，避免每次都等一分钟
  execFileSync(
    'npx',
    ['vitest', 'run', '--reporter=json', '--outputFile=/tmp/frond-vitest-readings.json'],
    { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'ignore', 'inherit'] }
  )
  const report = JSON.parse(readFileSync('/tmp/frond-vitest-readings.json', 'utf-8'))
  readings.testSuites = report.numTotalTestSuites
  readings.testsPassed = report.numPassedTests
  readings.testsFailed = report.numFailedTests
  readings.testsTodo = report.numTodoTests
}

if (asJson) {
  console.log(JSON.stringify(readings, null, 2))
} else {
  const rows = [
    ['src 源文件数（.ts/.vue，不含测试）', readings.sourceFiles],
    ['单测文件数（src+packages+scripts）', readings.unitTestFiles],
    ['数据库迁移数', readings.migrations],
    ['重建件数（事故后按调用点猜的）', readings.rebuildArtifacts],
    ['e2e spec 数', readings.e2eSpecs],
    ['IPC 契约通道数', readings.ipcContractChannels],
    ['主进程裸 ipcMain.handle 数', readings.bareIpcHandle]
  ]
  if (withTests) {
    rows.push(
      ['单测套件数', readings.testSuites],
      ['单测通过', readings.testsPassed],
      ['单测失败', readings.testsFailed],
      ['单测 todo', readings.testsTodo]
    )
  }
  // 中文按两格宽算，才能对齐
  const displayWidth = (s) => [...String(s)].reduce((n, ch) => n + (/[^\x00-\xff]/.test(ch) ? 2 : 1), 0)
  const width = Math.max(...rows.map((r) => displayWidth(r[0])))
  console.log('Frond 权威读数（2026-09-24 起以此脚本为准，文档里的写死数字应改为「跑这条命令」）\n')
  for (const [label, value] of rows) {
    console.log(`  ${label}${' '.repeat(width - displayWidth(label) + 2)}${value}`)
  }
  if (!withTests) console.log('\n（单测用例数需加 --tests 才跑，约 1 分钟）')
}
