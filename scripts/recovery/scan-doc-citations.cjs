#!/usr/bin/env node
/**
 * 文档引用的机械核对：扫 docs/ 里所有 `file.ext:行号` 形式的引用，
 * 逐条对真树解析并判「行号是否装得进那个文件」。
 *
 * 为什么要固化成脚本：手搓一次性核对时踩过两次同一个坑 ——
 * ① 用 basename 递归 glob 兜底，把 `src/main/index.ts` 撞进 references/ueli/ 的同名文件，
 *    误报一堆「编行号」；
 * ② 不认文档里「首次给全路径、后文用简写 `miniWindow.ts:55`」的写法，误报 345 条。
 * 所以这里按 basename 建全树索引，并且**同名文件只要有一个装得下行号就算过**（宁可漏报不误报，
 * 真值核对仍要抽样看内容）。
 *
 * 用法：node scripts/recovery/scan-doc-citations.cjs [docs 相对路径...]
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const CITATION = /`?([\w./-]+\.(?:ts|vue|mjs|json|yml|yaml|mts|cjs|plist|html|less|css))`?:(\d+)/g
// references/ 是外部参考仓库（ueli/vicinae），不在本仓事实来源之列
const SCAN_DIRS = ['src', 'scripts', 'e2e', 'plugins', 'example-plugin', 'packages', 'docs', '.github']

/** @type {Map<string, string[]>} */
const index = new Map()
/** @type {Map<string, number>} */
const lineCount = new Map()

function addFile(rel) {
  const abs = path.join(ROOT, rel)
  if (!fs.statSync(abs).isFile()) return
  const base = path.basename(rel)
  if (!index.has(base)) index.set(base, [])
  index.get(base).push(rel)
  if (!index.has(rel)) index.set(rel, [rel])
}

function walk(dir, depth = 0) {
  if (depth > 8) return
  let entries
  try {
    entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'out' || e.name === 'dist') continue
    const rel = dir ? `${dir}/${e.name}` : e.name
    if (e.isDirectory()) walk(rel, depth + 1)
    else addFile(rel)
  }
}

walk('')
for (const d of SCAN_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(d)

function linesOf(rel) {
  if (!lineCount.has(rel)) {
    try {
      lineCount.set(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').length)
    } catch {
      lineCount.set(rel, -1)
    }
  }
  return lineCount.get(rel)
}

const docArgs = process.argv.slice(2)
const docs = docArgs.length
  ? docArgs
  : fs
      .readdirSync(path.join(ROOT, 'docs'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `docs/${f}`)

let total = 0
const problems = []
const external = []
for (const doc of docs) {
  const abs = path.join(ROOT, doc)
  if (!fs.existsSync(abs)) {
    problems.push(`${doc}: 文件不存在`)
    continue
  }
  const body = fs.readFileSync(abs, 'utf8')
  for (const m of body.matchAll(CITATION)) {
    const [, ref, lnText] = m
    const ln = Number(lnText)
    total++
    const candidates = index.get(ref) ?? index.get(path.basename(ref))
    if (!candidates?.length) {
      // 指向外部参考仓库（references/ueli、vicinae 的 api/ 等）的引用不属本仓事实来源，
      // 单列一类而不是报成问题 —— 否则每次跑都会被噪声盖住真信号
      if (/^api\//.test(ref) || /REFERENCE_/.test(doc)) external.push(`${doc} → ${ref}:${ln}`)
      else problems.push(`${doc} → ${ref}:${ln}（全树找不到同名文件）`)
      continue
    }
    if (!candidates.some((p) => linesOf(p) >= ln && ln >= 1)) {
      const longest = Math.max(...candidates.map((p) => linesOf(p)))
      problems.push(`${doc} → ${ref}:${ln}（越界，同名文件最长 ${longest} 行：${candidates[0]}）`)
    }
  }
}

console.log(
  `扫了 ${docs.length} 份文档、${total} 条引用 → 可疑 ${problems.length} 条`
)
for (const p of problems) console.log('  ' + p)
if (external.length)
  console.log(`\n指向外部参考仓库的 ${external.length} 条（不判对错）：`)
for (const e of external.slice(0, 5)) console.log('  ' + e)
if (problems.length) console.log('\n注：本脚本只判「行号装不装得下」，内容与那句话是否对得上仍需抽样人核。')
process.exit(problems.length ? 1 : 0)
