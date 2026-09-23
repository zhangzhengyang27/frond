const fs = require('fs')
const path = require('path')
const roots = ['src/main', 'src/preload', 'src/shared']
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name)
    if (e.isDirectory()) return p.startsWith('node_modules') ? [] : walk(p)
    return /\.(ts|js)$/.test(e.name) ? [p] : []
  })
}
const files = roots.flatMap(walk)
const alias = { '@main/': 'src/main/', '@shared/': 'src/shared/', '@preload/': 'src/preload/' }
const missing = new Map()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] || m[2]
    if (!spec || spec.startsWith('node:') || !/[./]/.test(spec)) continue
    let base = null
    if (spec.startsWith('.')) base = path.normalize(path.join(path.dirname(f), spec))
    else
      for (const [a, b] of Object.entries(alias))
        if (spec.startsWith(a)) base = path.normalize(b + spec.slice(a.length))
    if (!base) continue
    if (/\.(png|jpg|svg|json|css|woff2?)\b/.test(base)) {
      if (!fs.existsSync(base)) push(base, f)
      continue
    }
    const cands = [base + '.ts', base + '.js', base + '.json', base + '.css', path.join(base, 'index.ts')]
    if (/\.(ts|js)$/.test(base)) cands.splice(0, 0, base)
    if (!cands.some((c) => fs.existsSync(c))) push(base.replace(/\.(png|jpg|svg)$/, ''), f)
  }
}
function push(base, from) {
  if (!missing.has(base)) missing.set(base, [])
  missing.get(base).push(from)
}
for (const [base, froms] of [...missing].sort()) {
  const pools = [
    '/tmp/cache-dump/src/' + base.replace(/^src\/renderer\/src\//, ''),
    '/Users/xiaoye/Documents/frond-desktop-baseline-2026-09-22/recovery-material/partials--zcode-older/' + base,
    '/Users/xiaoye/Desktop/_recovery-stitched/' + base
  ]
  const hit = pools.find((p) => fs.existsSync(p))
  console.log((hit ? 'COPY ' : 'NONE ') + base.padEnd(52) + froms.length + ' importer(s)' + (hit ? '  <- ' + hit : ''))
}
console.log('unresolved in main/preload/shared:', missing.size)
