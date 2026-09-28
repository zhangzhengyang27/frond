#!/usr/bin/env node
/**
 * Frond · 常驻内存权威读数
 *
 * 为什么存在：对标 Raycast 的内存数字（官方深潜文自述 v2 为 350-450MB）一直缺
 * Frond 侧的可复算读数——HANDOFF 只有包体积和唤起延迟，没有内存。按
 * snapshot-readings.mjs 的同一原则：**只报能复算的数字**，口径与测量方法都在
 * 本文件里，任何人在干净机器上跑同一条命令应得到同量级结果。
 *
 * 口径（写死在此，勿漂）：
 *   - 测量对象 = `pnpm build:unpack` 产物（out/make 下各 arch 的 Frond.app），非 dev 模式
 *     （electron-vite dev 带 HMR/源码 map，不代表发布形态）；
 *   - 独立临时 userData（FROND_USER_DATA_DIR 环境变量——主进程在 index.ts:10
 *     显式 setPath 钉径，Chromium 的 --user-data-dir 开关不吃；该变量是 e2e
 *     同款官方隔离机制）；
 *     首启状态（空库、默认配置、主窗打开、胶囊未唤起）——Raycast 的 350-450MB
 *     是带用户扩展的常驻态，对比时记住这个不对称；
 *   - RSS（ps 的 rss 字段），含 main / renderer / gpu / utility / crashpad 全部
 *     bundle 内进程，求和取中位数；进程树由本脚本 spawn，也只由本脚本收割；
 *   - 采样 = 启动后 15s 预热（应用扫描/迁移/懒服务）→ 每秒采样 30 次 →
 *     总 RSS 中位数为准，min/max 一起报。
 *
 * 用法：
 *   pnpm build:unpack                       # 先有产物
 *   node scripts/measure-memory.mjs          # 人读输出
 *   node scripts/measure-memory.mjs --json   # 机器可读
 *
 * 安全：脚本若检测到机器上已有 Frond.app 进程（比如用户装着的发布版）会直接
 * 拒绝运行，绝不 kill 不是自己 spawn 的进程。
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const asJson = process.argv.includes('--json')
const WARMUP_MS = 15_000
const SAMPLE_MS = 1_000
const SAMPLE_COUNT = 30

function die(msg) {
  console.error(`measure-memory: ${msg}`)
  process.exit(1)
}

/** 找 build:unpack 产物 */
function findAppBinary() {
  const makeDir = join(ROOT, 'out', 'make')
  if (!existsSync(makeDir)) return null
  const stack = [makeDir]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'Frond.app') {
          const bin = join(full, 'Contents', 'MacOS', 'Frond')
          return existsSync(bin) ? bin : null
        }
        stack.push(full)
      }
    }
  }
  return null
}

/** 机器上是否已有 Frond.app 在跑（有则拒绝——避免把别人的进程算进来/误杀） */
function assertNoRunningInstance() {
  let out = ''
  try {
    out = execFileSync('ps', ['-axo', 'args='], { encoding: 'utf8' })
  } catch (err) {
    die(`无法读取进程表：${err.message}`)
  }
  const foreign = out
    .split('\n')
    .filter((l) => l.includes('Frond.app') && !l.includes('measure-memory'))
  if (foreign.length > 0) {
    die(
      `检测到已有 Frond.app 进程在跑（${foreign.length} 条），拒绝测量——请先退出所有 Frond 实例。\n` +
        foreign.slice(0, 3).join('\n')
    )
  }
}

/** 采样：返回本 run 相关进程 [{pid, rssKB, kind}] */
function sample(bundlePath) {
  let out = ''
  try {
    out = execFileSync('ps', ['-axo', 'pid=,rss=,args='], { encoding: 'utf8' })
  } catch {
    return []
  }
  const rows = []
  for (const line of out.split('\n')) {
    if (!line.includes(bundlePath)) continue
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)
    if (!m) continue
    const [, pid, rss, args] = m
    let kind = 'main'
    const typeMatch = args.match(/--type=(\S+)/)
    if (typeMatch) {
      const t = typeMatch[1]
      const sub = args.match(/--utility-sub-type=(\S+)/)
      kind = sub ? `${t}:${sub[1]}` : t
    }
    rows.push({ pid: Number(pid), rssKB: Number(rss), kind })
  }
  return rows
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
  return false
}

// ---- 主流程 ----

let fatal = false

assertNoRunningInstance()

const bin = findAppBinary()
if (!bin) die('找不到 out/make/**/Frond.app 产物，先跑 `pnpm build:unpack`')

const userData = mkdtempSync(join(tmpdir(), 'frond-mem-'))
console.error(`[measure] 临时 userData：${userData}`)

const bundlePath = bin.slice(0, bin.indexOf('.app') + '.app'.length)
const child = spawn(bin, [], {
  stdio: 'ignore',
  env: { ...process.env, FROND_USER_DATA_DIR: userData }
})

const bundleHasProcess = () => sample(bundlePath).length > 0

try {
  // 1. 等主进程起来
  if (!waitFor(bundleHasProcess, 20_000)) {
    // 注意：spawn 之后禁止 process.exit（会跳过 finally 清理，残留真实例）——一律 throw
    throw new Error('20s 内没等到 Frond 主进程——启动失败？先手动跑一次 out/make 下的产物排查')
  }
  // 2. 校验 --user-data-dir 生效（临时目录应被写入；没写入说明切换没被吃掉，
  //    会污染用户真实数据，必须中止）
  const deadline = Date.now() + 15_000
  let userDataActive = false
  while (Date.now() < deadline) {
    const entries = readdirSync(userData)
    if (entries.length > 0) {
      userDataActive = true
      break
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
  if (!userDataActive) {
    throw new Error('--user-data-dir/FROND_USER_DATA_DIR 未生效（临时目录 15s 内无写入），为保护真实数据中止测量')
  }

  // 3. 预热后采样
  console.error(`[measure] 预热 ${WARMUP_MS / 1000}s（应用扫描/迁移/懒服务）…`)
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, WARMUP_MS)

  const samples = []
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples.push(sample(bundlePath))
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SAMPLE_MS)
  }
  const totals = samples.map((rows) => rows.reduce((acc, r) => acc + r.rssKB, 0))
  const medTotalKB = median(totals)
  // 用总量最接近中位数的那份样本做进程分解
  const medianSample = samples.reduce(
    (best, rows) => {
      const total = rows.reduce((acc, r) => acc + r.rssKB, 0)
      return Math.abs(total - medTotalKB) < Math.abs(best.total - medTotalKB)
        ? { total, rows }
        : best
    },
    { total: Infinity, rows: [] }
  )

  // 4. 产物信息（Electron 版本从 bundle 的 framework 名取）
  let electronVersion = 'unknown'
  try {
    const fw = join(bundlePath, 'Contents', 'Frameworks')
    const fwDir = readdirSync(fw).find((n) => /^Electron Framework/.test(n))
    const plist = readFileSync(join(bundlePath, 'Contents', 'Info.plist'), 'utf8')
    const ver = plist.match(/CFBundleShortVersionString[\s\S]*?>([\d.]+)</)
    electronVersion = ver ? ver[1] : 'unknown'
    void fw
  } catch {}

  /** phys_footprint（与 Activity Monitor「内存」列同口径）：RSS 跨进程求和会把
 *  共享页重复计入（Electron 各进程共享同一份 framework），跨产品对比时
 *  footprint 更公平——两个口径都报 */
function physFootprintMB(pid) {
  try {
    const out = execFileSync('vmmap', ['--summary', String(pid)], { encoding: 'utf8' })
    const m = out.match(/^Physical footprint:\s+([\d.]+)\s*([KMGT]?)/m)
    if (!m) return null
    const mul = { '': 1 / 1048576, K: 1 / 1024, M: 1, G: 1024, T: 1048576 }[m[2] ?? '']
    return +(parseFloat(m[1]) * mul).toFixed(1)
  } catch {
    return null
  }
}

const result = {
    date: new Date().toISOString(),
    machine: {
      arch: os.arch(),
      cpu: os.cpus()[0]?.model ?? 'unknown',
      memoryGB: +(os.totalmem() / 2 ** 30).toFixed(1),
      osRelease: os.release()
    },
    appVersion: electronVersion,
    metric: 'RSS，bundle 内全部进程求和，30 次采样取中位数（单位 MB）',
    medianTotalMB: +(medTotalKB / 1024).toFixed(1),
    minTotalMB: +(Math.min(...totals) / 1024).toFixed(1),
    maxTotalMB: +(Math.max(...totals) / 1024).toFixed(1),
    processCount: medianSample.rows.length,
    breakdownMB: Object.fromEntries(
      Object.entries(
        medianSample.rows.reduce((acc, r) => {
          acc[r.kind] = (acc[r.kind] ?? 0) + r.rssKB
          return acc
        }, {})
      )
        .map(([k, v]) => [k, +(v / 1024).toFixed(1)])
        .sort((a, b) => b[1] - a[1])
    ),
    state: '首启（临时空 userData）：主窗打开、胶囊未唤起、无用户数据'
  }

  // phys_footprint：对中位数样本的各进程各测一次（vmmap 会短暂挂起目标进程，
  // 放在 RSS 采样之后做，不影响采样）
  const fpRows = medianSample.rows
    .map((r) => ({ kind: r.kind, mb: physFootprintMB(r.pid) }))
    .filter((f) => f.mb != null)
  if (fpRows.length > 0) {
    result.physFootprintTotalMB = +fpRows.reduce((a, f) => a + f.mb, 0).toFixed(1)
    result.physFootprintBreakdownMB = Object.fromEntries(
      Object.entries(
        fpRows.reduce((acc, f) => {
          acc[f.kind] = (acc[f.kind] ?? 0) + f.mb
          return acc
        }, {})
      )
        .map(([k, v]) => [k, +v.toFixed(1)])
        .sort((a, b) => b[1] - a[1])
    )
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`Frond 常驻内存读数（${result.date}）`)
    console.log(`  机器：${result.machine.cpu} / ${result.machine.arch} / ${result.machine.memoryGB}GB / darwin ${result.machine.osRelease}`)
    console.log(`  口径：${result.metric}`)
    console.log(`  状态：${result.state}`)
    console.log(`  进程数：${result.processCount}`)
    console.log(`  **总 RSS 中位数：${result.medianTotalMB} MB**（min ${result.minTotalMB} / max ${result.maxTotalMB}）`)
    console.log('  分解（RSS）：')
    for (const [k, v] of Object.entries(result.breakdownMB)) {
      console.log(`    ${k.padEnd(40)} ${String(v).padStart(8)} MB`)
    }
    if (result.physFootprintTotalMB != null) {
      console.log(
        `  phys_footprint 合计（Activity Monitor 同口径，跨进程去共享页）：${result.physFootprintTotalMB} MB`
      )
      for (const [k, v] of Object.entries(result.physFootprintBreakdownMB)) {
        console.log(`    ${k.padEnd(40)} ${String(v).padStart(8)} MB`)
      }
    }
  }
} catch (err) {
  console.error(`measure-memory: ${err.message}`)
  fatal = true
} finally {
  // 5. 只收割自己 spawn 的进程树
  try {
    const pids = sample(bundlePath).map((r) => r.pid)
    if (child.pid && !child.killed) {
      try {
        process.kill(child.pid, 'SIGTERM')
      } catch {}
    }
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline && bundleHasProcess()) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300)
    }
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {}
    }
  } catch {}
  try {
    rmSync(userData, { recursive: true, force: true })
  } catch {}
}
if (fatal) process.exit(1)
