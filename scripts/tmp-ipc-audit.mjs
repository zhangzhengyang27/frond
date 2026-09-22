// 一次性盘点（不入库）：契约登记 vs preload 实际使用的通道
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const contract = readFileSync(join(root, 'src/shared/ipc-contract.ts'), 'utf8')
const preload = readFileSync(join(root, 'src/preload/index.ts'), 'utf8')

const contractKeys = new Set([...contract.matchAll(/^\s*'([a-zA-Z][\w.:-]*)':\s*\{/gm)].map((m) => m[1]))
// preload 里出现的 ipc 通道串（invoke / send / on 的字面量）
const used = new Set(
  [...preload.matchAll(/ipcRenderer\.(?:invoke|send|sendSync|on)\(\s*'([^']+)'/g)].map((m) => m[1])
)

const dotted = (ch) => ch.replace(':', '.')
const usedDotted = new Map([...used].map((ch) => [dotted(ch), ch]))

const missing = [...usedDotted.keys()].filter((k) => !contractKeys.has(k)).sort()
const unused = [...contractKeys].filter((k) => !usedDotted.has(k)).sort()

console.log(`契约登记 ${contractKeys.size} · preload 使用 ${used.size}`)
console.log(`\n== preload 用了但契约没登记（${missing.length}）==`)
for (const k of missing) console.log('  ', k, ' ←', usedDotted.get(k))
console.log(`\n== 契约登记了但 preload 里没有（${unused.length}）==`)
for (const k of unused) console.log('  ', k)

// main 侧注册的通道数（真实面）
const mainFiles = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (p.endsWith('.ts')) mainFiles.push(p)
  }
}
walk(join(root, 'src/main'))
const mainChannels = new Set()
for (const f of mainFiles) {
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(/ipcMain\.(?:handle|on)\(\s*'([^']+)'/g)) mainChannels.add(m[1])
}
const notInContract = [...mainChannels].filter((c) => !usedDotted.has(dotted(c))).sort()
console.log(`\n== main 注册了 ${mainChannels.size} 个通道；其中契约里没有的 ${notInContract.length} ==`)
for (const k of notInContract) console.log('  ', k)
