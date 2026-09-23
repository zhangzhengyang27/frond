const fs = require('fs')
const path = require('path')

/**
 * 2026-09-23 修复：这里原来硬编码了**旧仓库**的绝对路径
 *   /Users/xiaoye/Desktop/electron-tools/node_modules/.pnpm/@vue+compiler-sfc@3.5.43/...
 * 该目录在改名/迁移后已不存在 → 脚本必然 exit 1。而 HANDOFF §10.2 把它列为
 * 「权威口径」之一，于是「脚本坏了」会被误读成「项目坏了」（真实状态当时是健康的）。
 *
 * 改为走 node 解析：找不到依赖时 exit 2 并明确提示，让「脚本坏了」与「项目坏了」
 * 在退出码上可区分（0 = 全部解析通过 / 1 = 真有 .vue 解析不过 / 2 = 脚本自身不可用）。
 *
 * 解析路径优先用 `vue/compiler-sfc`（`vue` 是本仓库的直接依赖，pnpm 严格布局下必然可解析），
 * 再退回 `@vue/compiler-sfc`（它是 @vitejs/plugin-vue 的传递依赖，pnpm 下**不一定**能直接 require）。
 */
let parse
let loadError = null
for (const candidate of ['vue/compiler-sfc', '@vue/compiler-sfc']) {
  try {
    ;({ parse } = require(candidate))
    break
  } catch (err) {
    loadError = err
  }
}
if (typeof parse !== 'function') {
  console.error(
    'scan-vue-parse: 无法加载 Vue SFC 编译器 —— 脚本自身不可用，不代表项目有问题。\n' +
      `  原因：${loadError && loadError.message}\n` +
      '  处理：在仓库根跑 `pnpm install --ignore-scripts`（本机 postinstall 会因 node-gyp 撞 Python 3.14 失败）。'
  )
  process.exit(2)
}

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name)
    if (e.isDirectory()) return p.includes('node_modules') ? [] : walk(p)
    return e.name.endsWith('.vue') ? [p] : []
  })
}
const root = process.cwd() + '/src/renderer/src'
const bad = []
for (const f of walk(root)) {
  const src = fs.readFileSync(f, 'utf8')
  try {
    const { errors } = parse(src, { filename: f })
    if (errors && errors.length) bad.push([f, errors[0].message + ' @' + (errors[0].loc ? errors[0].loc.start.line : '?'), src.split('\n').length])
  } catch (err) {
    bad.push([f, String(err.message).slice(0, 70), src.split('\n').length])
  }
}
const corpus = (process.env.CACHE_SRC || '/tmp/cache-dump/src/')
for (const [f, msg, lines] of bad.sort()) {
  const rel = f.replace(root + '/', '')
  console.log((fs.existsSync(corpus + rel) ? 'CORPUS ' : '       ') + rel.padEnd(56) + lines + ' lines  ' + msg)
}
console.log('unparsable .vue files:', bad.length)
