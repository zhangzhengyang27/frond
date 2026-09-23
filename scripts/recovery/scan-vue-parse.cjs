const fs = require('fs')
const path = require('path')
const { parse, errors: _e } = require('/Users/xiaoye/Desktop/electron-tools/node_modules/.pnpm/@vue+compiler-sfc@3.5.43/node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js')
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
